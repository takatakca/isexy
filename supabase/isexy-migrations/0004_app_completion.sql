-- ISEXY app completion: the database side of the Discover, Accounts and Chat
-- passes (branches wf/discover, wf/accounts, wf/chat, integrated on
-- claude/zealous-brown-kv2hmx). NOT applied anywhere yet; later passes may
-- append parts below before it is applied.
--
-- isexy schema only (plus the isexy-photo-verifications bucket and its
-- "isexy: " storage policies, which the migrate.sh guard allows). Idempotent:
-- CREATE ... IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS
-- before CREATE POLICY, DROP TRIGGER IF EXISTS before CREATE TRIGGER. No data
-- is deleted or rewritten. Every SECURITY DEFINER function pins
-- search_path = isexy, extensions and checks auth.uid() itself; EXECUTE is
-- revoked from PUBLIC/anon and granted only where the client needs it.
--
-- A. Discover (wf/discover)
--    A1. get_likes_received(p_limit, p_before): "Who liked you" and the Likes
--        tab. swipes RLS only shows a member the swipes they made, so these
--        screens were always empty. Gold/Platinum get each liker; other plans
--        get anonymous rows (locked) for the count and the blurred teaser.
--        + index swipes (swiped_id, created_at DESC) (also serves C3).
--    A2. set_first_impression(p_swiped_id, p_message): the Platinum First
--        Impression was a client UPDATE on swipes with no UPDATE policy, so it
--        was silently dropped. Platinum only, 1-140 chars, once per Super Like,
--        spends allowances.weekly_first_impressions.
-- B. Accounts (wf/accounts)
--    B1. user_preferences.settings jsonb (object, max 64 KB): private member
--        settings (Discover privacy and deck preferences, Active Status, Block
--        Contacts list, Passport, deletion request date).
--    B2. Photo verification: table photo_verifications (RLS: a member files
--        one pending request for themselves; staff read all), private bucket
--        isexy-photo-verifications (own folder = auth uid), and
--        review_photo_verification(id, approve, reason) for admin/moderator,
--        the only path in this flow that sets profiles.is_verified.
--    B3. get_discover_feed replaced (same signature, columns and ranking) so
--        Settings take effect: Discovery off / Incognito, the caller's minimum
--        photos / has a bio / recently active, and Block Contacts both ways.
-- C. Chat, messages and notifications (wf/chat)
--    C1. mark_messages_read(match_id): flips is_read only on the other
--        member's messages, so the client no longer UPDATEs isexy.messages.
--    C2. Trigger messages_touch_match: matches.last_message_at follows new
--        messages server-side (no client UPDATE of matches after a send).
--    C3. get_my_badge_counts(): bottom-nav unread messages and pending likes
--        (same liker filters as A1, so the badge matches "Who liked you").
--    C4. Group chat RLS: the self-referencing policy on group_chat_members made
--        every group query fail ("infinite recursion detected in policy");
--        replaced by is_group_chat_member(), and sending checks sender_id.
--    C5. Index message_translations (message_id, target_language) for the
--        isexy-translate-message cache.
--    C6. user_preferences.notification_settings jsonb, honoured by
--        isexy-send-notification-email and isexy-send-push-notification.
--
-- Known production holes (members can UPDATE their own profiles' plan/limit
-- columns, INSERT their own transactions, etc.) are closed by the next
-- security pass; nothing here depends on them.

SET LOCAL search_path = isexy, extensions;

-- ===========================================================================
-- A. Discover
-- ===========================================================================

-- A1. Who liked me -----------------------------------------------------------
-- Members who liked or super-liked the caller and are still waiting for an
-- answer (the caller has not swiped them): active, not shadow-banned, 18+, no
-- block either way; newest first, paged with p_before (the last row's
-- liked_at). Identity (id, name, photo, First Impression message...) only for
-- Gold / Platinum; other plans get anonymous rows (locked = true).
CREATE INDEX IF NOT EXISTS swipes_swiped_created_idx ON isexy.swipes (swiped_id, created_at DESC);

CREATE OR REPLACE FUNCTION isexy.get_likes_received(
  p_limit INTEGER DEFAULT 30,
  p_before TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  liker_id UUID,
  first_name TEXT,
  birth_date DATE,
  city TEXT,
  is_verified BOOLEAN,
  photo_url TEXT,
  action TEXT,
  message TEXT,
  liked_at TIMESTAMPTZ,
  locked BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  WITH me AS (
    SELECT p.id, coalesce(p.subscription_tier, 'free') IN ('gold', 'platinum') AS can_see
    FROM isexy.profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
  SELECT
    CASE WHEN me.can_see THEN s.swiper_id END,
    CASE WHEN me.can_see THEN o.first_name END,
    CASE WHEN me.can_see THEN o.birth_date END,
    CASE WHEN me.can_see THEN o.city END,
    CASE WHEN me.can_see THEN coalesce(o.is_verified, false) END,
    CASE WHEN me.can_see THEN (
      SELECT ph.photo_url FROM isexy.profile_photos ph
      WHERE ph.profile_id = o.id ORDER BY ph.position LIMIT 1
    ) END,
    s.action,
    CASE WHEN me.can_see THEN s.message END,
    s.created_at,
    NOT me.can_see
  FROM me
  JOIN isexy.swipes s ON s.swiped_id = me.id AND s.action IN ('like', 'super_like')
  JOIN isexy.profiles o ON o.id = s.swiper_id
  WHERE o.is_active = true
    AND coalesce(o.shadow_banned, false) = false
    AND o.birth_date <= (current_date - interval '18 years')::date
    AND (p_before IS NULL OR s.created_at < p_before)
    AND NOT EXISTS (
      SELECT 1 FROM isexy.swipes mine
      WHERE mine.swiper_id = me.id AND mine.swiped_id = s.swiper_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM isexy.blocks b
      WHERE (b.blocker_id = me.id AND b.blocked_id = o.id)
         OR (b.blocker_id = o.id AND b.blocked_id = me.id)
    )
  ORDER BY s.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 30), 100));
$$;

REVOKE ALL ON FUNCTION isexy.get_likes_received(INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_likes_received(INTEGER, TIMESTAMPTZ) TO authenticated;

-- A2. Platinum First Impression ---------------------------------------------
-- Attaches the message to the caller's own Super Like (once), for Platinum
-- only, 1-140 characters, and spends one weekly First Impression
-- (allowances.weekly_first_impressions) when the member has an allowances row.
CREATE OR REPLACE FUNCTION isexy.set_first_impression(p_swiped_id UUID, p_message TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me isexy.profiles%ROWTYPE;
  v_message TEXT := btrim(coalesce(p_message, ''));
  v_left INTEGER;
BEGIN
  SELECT * INTO v_me FROM isexy.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF coalesce(v_me.subscription_tier, 'free') <> 'platinum' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_platinum');
  END IF;
  IF char_length(v_message) = 0 OR char_length(v_message) > 140 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_message');
  END IF;

  SELECT a.weekly_first_impressions INTO v_left
  FROM isexy.allowances a WHERE a.profile_id = v_me.id FOR UPDATE;
  IF v_left IS NOT NULL AND v_left <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_first_impressions', 'remaining', 0);
  END IF;

  UPDATE isexy.swipes SET message = v_message
  WHERE swiper_id = v_me.id
    AND swiped_id = p_swiped_id
    AND action = 'super_like'
    AND message IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_super_like');
  END IF;

  IF v_left IS NOT NULL THEN
    UPDATE isexy.allowances
    SET weekly_first_impressions = weekly_first_impressions - 1, updated_at = now()
    WHERE profile_id = v_me.id;
    v_left := v_left - 1;
  END IF;

  RETURN jsonb_build_object('success', true, 'remaining', v_left);
END;
$$;

REVOKE ALL ON FUNCTION isexy.set_first_impression(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.set_first_impression(UUID, TEXT) TO authenticated;

-- ===========================================================================
-- B. Accounts
-- ===========================================================================

-- B1. Private member settings ------------------------------------------------
-- useMemberSettings (src/hooks/useMemberSettings.ts). Email and push choices
-- are NOT here: they are C6 (notification_settings). Existing RLS on
-- user_preferences already limits rows to their owner.
ALTER TABLE isexy.user_preferences
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_settings_shape'
      AND conrelid = 'isexy.user_preferences'::regclass
  ) THEN
    ALTER TABLE isexy.user_preferences
      ADD CONSTRAINT user_preferences_settings_shape
      CHECK (jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 65536);
  END IF;
END $$;

COMMENT ON COLUMN isexy.user_preferences.settings IS
  'Private member settings (discovery, activeStatus, blockedContacts, passport, deletionRequestedAt). Owner-only via RLS.';

-- B2. Photo verification -----------------------------------------------------
-- /photo-verification: the member takes a selfie, stored privately in
-- isexy-photo-verifications/{auth uid}/..., a pending request is added here,
-- and a moderator approves or rejects it with review_photo_verification().
CREATE TABLE IF NOT EXISTS isexy.photo_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES isexy.profiles(id) ON DELETE CASCADE,
  selfie_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE isexy.photo_verifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS photo_verifications_profile_idx
  ON isexy.photo_verifications (profile_id, submitted_at DESC);
-- One open request per member.
CREATE UNIQUE INDEX IF NOT EXISTS photo_verifications_one_pending_idx
  ON isexy.photo_verifications (profile_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS photo_verifications_pending_idx
  ON isexy.photo_verifications (submitted_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS photo_verifications_reviewed_by_idx
  ON isexy.photo_verifications (reviewed_by) WHERE reviewed_by IS NOT NULL;

-- Members read their own requests (status, rejection reason).
DROP POLICY IF EXISTS "Members view own photo verifications" ON isexy.photo_verifications;
CREATE POLICY "Members view own photo verifications" ON isexy.photo_verifications
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

-- Members file a pending request for their own profile, with a selfie from
-- their own folder. They can never set the status, the reviewer or the date.
DROP POLICY IF EXISTS "Members request own photo verification" ON isexy.photo_verifications;
CREATE POLICY "Members request own photo verification" ON isexy.photo_verifications
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND status = 'pending'
    AND rejection_reason IS NULL
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND selfie_path LIKE (SELECT auth.uid())::text || '/%'
    AND selfie_path NOT LIKE '%..%'
  );

-- Staff read every request (the review itself goes through the function below).
DROP POLICY IF EXISTS "Staff view photo verifications" ON isexy.photo_verifications;
CREATE POLICY "Staff view photo verifications" ON isexy.photo_verifications
  FOR SELECT TO authenticated
  USING (isexy.has_role((SELECT auth.uid()), 'admin') OR isexy.has_role((SELECT auth.uid()), 'moderator'));

-- No UPDATE or DELETE policy: members cannot approve themselves. The schema's
-- default privileges grant ALL on new tables; keep only what the app uses.
REVOKE ALL ON isexy.photo_verifications FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON isexy.photo_verifications FROM authenticated;
GRANT SELECT, INSERT ON isexy.photo_verifications TO authenticated;

CREATE OR REPLACE FUNCTION isexy.review_photo_verification(
  p_request_id UUID,
  p_approve BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS isexy.photo_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_row isexy.photo_verifications;
BEGIN
  IF v_caller IS NULL OR NOT (isexy.has_role(v_caller, 'admin') OR isexy.has_role(v_caller, 'moderator')) THEN
    RAISE EXCEPTION 'Only ISEXY staff can review photo verifications' USING ERRCODE = '42501';
  END IF;

  UPDATE isexy.photo_verifications
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      rejection_reason = CASE WHEN p_approve THEN NULL ELSE left(nullif(btrim(p_reason), ''), 500) END,
      reviewed_at = now(),
      reviewed_by = v_caller
  WHERE id = p_request_id AND status = 'pending'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending photo verification with this id' USING ERRCODE = 'P0002';
  END IF;

  IF p_approve THEN
    UPDATE isexy.profiles SET is_verified = true WHERE id = v_row.profile_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION isexy.review_photo_verification(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.review_photo_verification(UUID, BOOLEAN, TEXT) TO authenticated;

-- Private bucket for the selfies: 5 MB images; members write and read their
-- own folder only, staff read everything. No update or delete policy (a new
-- selfie is a new file).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('isexy-photo-verifications', 'isexy-photo-verifications', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "isexy: members upload own verification selfie" ON storage.objects;
CREATE POLICY "isexy: members upload own verification selfie" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'isexy-photo-verifications'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "isexy: members and staff view verification selfies" ON storage.objects;
CREATE POLICY "isexy: members and staff view verification selfies" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'isexy-photo-verifications'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR isexy.has_role((SELECT auth.uid()), 'admin')
      OR isexy.has_role((SELECT auth.uid()), 'moderator')
    )
  );

-- B3. Discover respects the privacy settings ---------------------------------
-- Replaces isexy.get_discover_feed (0001_isexy_baseline.sql) with the same
-- signature, columns and ranking; it only adds: a member with Settings ›
-- Enable Discovery off, or Incognito, is left out of other decks except for
-- people they already liked; the caller's "Minimum number of photos" and
-- "Has a bio" preferences filter their own deck, "Recently Active" sorts it;
-- Block Contacts keeps two people out of each other's deck when either one
-- listed the other's sign-in email or phone (auth.users, read by this
-- SECURITY DEFINER function only; nothing is revealed to either member).
-- The feed also serves Explore categories and Top Picks.
/**
 * The caller's Discover deck, ranked, with photos, in one call.
 * Mutual gender preferences, the caller's age range (always 18+), blocks in
 * both directions, already-swiped and shadow-banned profiles are excluded,
 * plus the candidates' privacy settings and the caller's deck preferences
 * (user_preferences.settings.discovery) and Block Contacts lists.
 * p_exclude lets the client page without re-receiving cards it already holds.
 * p_interests (optional) keeps profiles with at least one matching interest
 * (case-insensitive substring), used by Explore categories.
 */
CREATE OR REPLACE FUNCTION isexy.get_discover_feed(
  p_limit INTEGER DEFAULT 30,
  p_exclude UUID[] DEFAULT '{}',
  p_verified_only BOOLEAN DEFAULT false,
  p_interests TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  birth_date DATE,
  bio TEXT,
  city TEXT,
  job_title TEXT,
  company TEXT,
  school TEXT,
  is_verified BOOLEAN,
  interests TEXT[],
  distance_km INTEGER,
  photos TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  WITH me AS (
    SELECT p.*
    FROM profiles p
    WHERE p.user_id = auth.uid()
    LIMIT 1
  ),
  -- Caller's preferences (Settings). Parsed defensively: a malformed value
  -- falls back to the default instead of breaking the deck.
  my_prefs AS (
    SELECT
      CASE WHEN (up.settings #>> '{discovery,minPhotos}') ~ '^[0-9]{1,2}$'
           THEN least(9, greatest(1, (up.settings #>> '{discovery,minPhotos}')::int)) ELSE 1 END AS min_photos,
      coalesce(up.settings #>> '{discovery,requireBio}', 'false') = 'true' AS require_bio,
      coalesce(up.settings #>> '{discovery,sortBy}', '') = 'recent' AS recent_first
    FROM me LEFT JOIN user_preferences up ON up.user_id = me.user_id
  ),
  -- Settings › Block Contacts: the caller's private list (emails, phone digits)…
  my_contacts AS (
    SELECT
      nullif(lower(btrim(coalesce(x->>'email', ''))), '') AS email,
      nullif(regexp_replace(coalesce(x->>'phone', ''), '[^0-9]', '', 'g'), '') AS phone
    FROM me
    JOIN user_preferences up ON up.user_id = me.user_id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(up.settings -> 'blockedContacts') = 'array'
           THEN up.settings -> 'blockedContacts' ELSE '[]'::jsonb END
    ) x
    WHERE jsonb_typeof(x) = 'object'
  ),
  -- …and the caller's own sign-in email and phone, to honour other members' lists.
  my_identity AS (
    SELECT
      nullif(lower(btrim(coalesce(au.email, ''))), '') AS email,
      nullif(regexp_replace(coalesce(au.phone, ''), '[^0-9]', '', 'g'), '') AS phone
    FROM auth.users au
    WHERE au.id = auth.uid()
  ),
  window_ AS (
    SELECT
      (current_date - make_interval(years => greatest(18, coalesce(me.age_min, 18))))::date AS max_birth,
      ((current_date - make_interval(years => least(99, coalesce(me.age_max, 99)) + 1))::date + 1) AS min_birth
    FROM me
  ),
  candidates AS (
    SELECT
      c.*,
      (SELECT array_agg(ph.photo_url ORDER BY ph.position)
         FROM profile_photos ph WHERE ph.profile_id = c.id) AS photo_urls,
      CASE
        WHEN me.latitude IS NOT NULL AND c.latitude IS NOT NULL THEN
          round(6371 * 2 * asin(sqrt(
            power(sin(radians(c.latitude - me.latitude) / 2), 2) +
            cos(radians(me.latitude)) * cos(radians(c.latitude)) *
            power(sin(radians(coalesce(c.longitude, 0) - coalesce(me.longitude, 0)) / 2), 2)
          )))::int
      END AS dist
    FROM profiles c, me, window_
    WHERE c.id <> me.id
      AND c.is_active = true
      AND coalesce(c.shadow_banned, false) = false
      AND c.first_name IS NOT NULL
      AND c.birth_date BETWEEN window_.min_birth AND window_.max_birth
      AND (NOT p_verified_only OR c.is_verified = true)
      AND NOT (c.id = ANY (coalesce(p_exclude, '{}')))
      AND (
        p_interests IS NULL OR cardinality(p_interests) = 0 OR EXISTS (
          SELECT 1 FROM unnest(coalesce(c.interests, '{}')) i, unnest(p_interests) q
          WHERE lower(i) LIKE '%' || lower(q) || '%'
        )
      )
      AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = me.id AND s.swiped_id = c.id)
      -- Block Contacts, both ways: nobody on my list, nobody who listed me.
      -- (Never shown to either side; it only keeps them out of each other's deck.)
      AND NOT EXISTS (
        SELECT 1 FROM auth.users au, my_contacts mc
        WHERE au.id = c.user_id
          AND (
            (mc.email IS NOT NULL AND lower(au.email) = mc.email)
            OR (mc.phone IS NOT NULL AND regexp_replace(coalesce(au.phone, ''), '[^0-9]', '', 'g') = mc.phone)
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM user_preferences up2
        CROSS JOIN my_identity mi
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(up2.settings -> 'blockedContacts') = 'array'
               THEN up2.settings -> 'blockedContacts' ELSE '[]'::jsonb END
        ) x
        WHERE up2.user_id = c.user_id
          AND jsonb_typeof(x) = 'object'
          AND (
            (mi.email IS NOT NULL AND lower(btrim(coalesce(x->>'email', ''))) = mi.email)
            OR (mi.phone IS NOT NULL AND regexp_replace(coalesce(x->>'phone', ''), '[^0-9]', '', 'g') = mi.phone)
          )
      )
      -- Their choice: Discovery off or Incognito hides them from the deck,
      -- except from people they already liked.
      AND NOT EXISTS (
        SELECT 1 FROM user_preferences up
        WHERE up.user_id = c.user_id
          AND (
            (up.settings #>> '{discovery,enabled}') = 'false'
            OR (up.settings #>> '{discovery,visibility}') = 'incognito'
          )
          AND NOT EXISTS (
            SELECT 1 FROM swipes l
            WHERE l.swiper_id = c.id AND l.swiped_id = me.id AND l.action IN ('like', 'super_like')
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = me.id AND b.blocked_id = c.id)
           OR (b.blocker_id = c.id AND b.blocked_id = me.id)
      )
      -- They match what I'm looking for…
      AND EXISTS (
        SELECT 1 FROM unnest(coalesce(me.interested_in, '{}')) pref
        WHERE normalize_gender(pref) IN ('everyone', normalize_gender(c.gender))
      )
      -- …and I match what they're looking for.
      AND EXISTS (
        SELECT 1 FROM unnest(coalesce(c.interested_in, '{}')) pref
        WHERE normalize_gender(pref) IN ('everyone', normalize_gender(me.gender))
      )
  ),
  scored AS (
    SELECT
      c.*,
      (
        (coalesce(cardinality(c.photo_urls), 0) * 7
         + CASE WHEN length(coalesce(c.bio, '')) >= 10 THEN 20 ELSE 0 END
         + CASE WHEN coalesce(cardinality(c.interests), 0) >= 3 THEN 12 ELSE 0 END
         + CASE WHEN c.is_verified THEN 8 ELSE 0 END
         + CASE WHEN c.job_title IS NOT NULL AND c.job_title <> '' THEN 8 ELSE 0 END
         + CASE WHEN c.school IS NOT NULL AND c.school <> '' THEN 6 ELSE 0 END
         + CASE WHEN c.city IS NOT NULL AND c.city <> '' THEN 6 ELSE 0 END)
        * CASE c.subscription_tier WHEN 'platinum' THEN 2.0 WHEN 'gold' THEN 1.5 WHEN 'plus' THEN 1.2 ELSE 1.0 END
        * CASE
            WHEN c.super_boost_until > now() THEN 5
            WHEN c.last_boost_at > now() - interval '30 minutes' THEN 3
            ELSE 1
          END
      ) AS score
    FROM candidates c, my_prefs mp
    WHERE cardinality(c.photo_urls) >= mp.min_photos
      AND (NOT mp.require_bio OR length(btrim(coalesce(c.bio, ''))) >= 10)
  )
  SELECT
    s.id, s.first_name, s.birth_date, s.bio, s.city, s.job_title, s.company, s.school,
    coalesce(s.is_verified, false), s.interests, s.dist, s.photo_urls
  FROM scored s, my_prefs mp
  -- "Recently Active" (Settings › Control Who You See) puts recent members first.
  ORDER BY CASE WHEN mp.recent_first THEN s.last_active_at END DESC NULLS LAST,
           s.score DESC, s.dist ASC NULLS LAST, s.id
  LIMIT greatest(1, least(coalesce(p_limit, 30), 50));
$$;

REVOKE ALL ON FUNCTION isexy.get_discover_feed(INTEGER, UUID[], BOOLEAN, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_discover_feed(INTEGER, UUID[], BOOLEAN, TEXT[]) TO authenticated;

-- ===========================================================================
-- C. Chat, messages and notifications
-- ===========================================================================

-- C1. Read state without a direct UPDATE on messages ---------------------------
-- "Users can update message read status" lets a member UPDATE any column of
-- any message in their matches. The client now calls this RPC instead; it only
-- flips is_read, only on messages the other member sent. Once this is live the
-- security pass can drop that UPDATE policy (no client code UPDATEs messages).
CREATE OR REPLACE FUNCTION isexy.mark_messages_read(p_match_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me UUID;
  v_count INTEGER;
BEGIN
  SELECT p.id INTO v_me FROM isexy.profiles p WHERE p.user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM isexy.matches m
    WHERE m.id = p_match_id AND (m.profile1_id = v_me OR m.profile2_id = v_me)
  ) THEN
    RAISE EXCEPTION 'Not part of this conversation' USING ERRCODE = '42501';
  END IF;

  UPDATE isexy.messages
     SET is_read = true
   WHERE match_id = p_match_id
     AND sender_id <> v_me
     AND is_read = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION isexy.mark_messages_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.mark_messages_read(UUID) TO authenticated, service_role;

-- C2. matches.last_message_at follows new messages server-side ---------------
CREATE OR REPLACE FUNCTION isexy.touch_match_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  UPDATE isexy.matches
     SET last_message_at = NEW.created_at
   WHERE id = NEW.match_id
     AND (last_message_at IS NULL OR last_message_at < NEW.created_at);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION isexy.touch_match_last_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messages_touch_match ON isexy.messages;
CREATE TRIGGER messages_touch_match
  AFTER INSERT ON isexy.messages
  FOR EACH ROW EXECUTE FUNCTION isexy.touch_match_last_message();

-- C3. Bottom-nav badges in one call -------------------------------------------
-- Unread messages (same rules as the inbox: active matches, no blocks) and
-- likes received that the member has not answered yet, with the same liker
-- filters as get_likes_received (A1) so the badge matches "Who liked you".
-- Uses swipes_swiped_created_idx (A1) for the swiped_id lookup.
CREATE OR REPLACE FUNCTION isexy.get_my_badge_counts()
RETURNS TABLE (unread_messages INTEGER, new_likes INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  WITH me AS (
    SELECT p.id FROM isexy.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  ),
  blocked AS (
    SELECT CASE WHEN b.blocker_id = me.id THEN b.blocked_id ELSE b.blocker_id END AS other_id
    FROM isexy.blocks b, me
    WHERE b.blocker_id = me.id OR b.blocked_id = me.id
  )
  SELECT
    (SELECT count(*)::int
       FROM isexy.matches m
       JOIN isexy.messages msg ON msg.match_id = m.id
      WHERE m.is_active = true
        AND (m.profile1_id = me.id OR m.profile2_id = me.id)
        AND msg.sender_id <> me.id
        AND msg.is_read = false
        AND msg.sender_id NOT IN (SELECT other_id FROM blocked)),
    (SELECT count(*)::int
       FROM isexy.swipes s
       JOIN isexy.profiles liker ON liker.id = s.swiper_id
      WHERE s.swiped_id = me.id
        AND s.action IN ('like', 'super_like')
        AND liker.is_active = true
        AND coalesce(liker.shadow_banned, false) = false
        AND liker.birth_date <= (current_date - interval '18 years')::date
        AND NOT EXISTS (
          SELECT 1 FROM isexy.swipes mine
          WHERE mine.swiper_id = me.id AND mine.swiped_id = s.swiper_id
        )
        AND s.swiper_id NOT IN (SELECT other_id FROM blocked))
  FROM me;
$$;

REVOKE ALL ON FUNCTION isexy.get_my_badge_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_badge_counts() TO authenticated;

-- C4. Group chat RLS ----------------------------------------------------------
-- The SELECT policy on group_chat_members queried group_chat_members itself,
-- so every group query failed with "infinite recursion detected in policy".
-- A SECURITY DEFINER membership check replaces the self-reference. Sending
-- also checks the sender is the caller (before, any member could post as
-- another member). Policies are for signed-in members only.
CREATE OR REPLACE FUNCTION isexy.is_group_chat_member(p_group_chat_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM isexy.group_chat_members gcm
    JOIN isexy.profiles p ON p.id = gcm.profile_id
    WHERE gcm.group_chat_id = p_group_chat_id AND p.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION isexy.is_group_chat_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.is_group_chat_member(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Members can view group chats" ON isexy.group_chats;
CREATE POLICY "Members can view group chats" ON isexy.group_chats
  FOR SELECT TO authenticated
  USING (isexy.is_group_chat_member(id));

DROP POLICY IF EXISTS "Members can view group members" ON isexy.group_chat_members;
CREATE POLICY "Members can view group members" ON isexy.group_chat_members
  FOR SELECT TO authenticated
  USING (isexy.is_group_chat_member(group_chat_id));

DROP POLICY IF EXISTS "Members can view group messages" ON isexy.group_messages;
CREATE POLICY "Members can view group messages" ON isexy.group_messages
  FOR SELECT TO authenticated
  USING (isexy.is_group_chat_member(group_chat_id));

DROP POLICY IF EXISTS "Members can send group messages" ON isexy.group_messages;
CREATE POLICY "Members can send group messages" ON isexy.group_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    isexy.is_group_chat_member(group_chat_id)
    AND sender_id IN (SELECT p.id FROM isexy.profiles p WHERE p.user_id = (SELECT auth.uid()))
  );

-- C5. Translation cache lookups (isexy-translate-message) ----------------------
CREATE INDEX IF NOT EXISTS message_translations_lookup_idx
  ON isexy.message_translations (message_id, target_language);

-- C6. Notification preferences ------------------------------------------------
-- Shape: {"email": {"new_matches": bool, "new_messages": bool, "promotions": bool},
--         "push":  {"messages": bool, "newMatches": bool, ...}}
-- user_preferences already has own-row RLS (user_id = auth.uid()).
ALTER TABLE isexy.user_preferences
  ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN isexy.user_preferences.notification_settings IS
  'Email and push notification choices, read by isexy-send-notification-email and isexy-send-push-notification. Owner-only via RLS.';
