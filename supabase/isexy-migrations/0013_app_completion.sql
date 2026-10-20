-- ISEXY app completion: the database side of the Discover, Accounts, Chat,
-- Calls and Rewards passes (branches wf/discover, wf/accounts, wf/chat,
-- wf/calls, wf/rewards, integrated on claude/zealous-brown-kv2hmx). NOT
-- applied anywhere yet; later passes may append parts below before it is
-- applied.
--
-- Written as 0004 on the branch, renumbered 0013 when main's 0004-0012
-- (applied on V1) were merged; it runs after them and keeps their fixes
-- (docs/handoff/merge-main.md): 0006 adult profiles (untouched), 0007
-- reset_monthly_allowances (R8 replaces the body with the same "only when
-- due" rule, service role only), 0008 (untouched), 0009/0010 tickets
-- (untouched), 0011/0012 Stripe RPCs (R4: fulfill_stripe_payment has their
-- service-role and session checks and locks; fulfill_stripe_credit_purchase
-- and fulfill_stripe_boost_purchase keep their signatures and answers and
-- credit through fulfill_stripe_payment). R3's unique subscriptions
-- (profile_id) index also makes the live webhook v6 upsert on profile_id work.
--
-- isexy schema only (plus the isexy-photo-verifications bucket and its
-- "isexy: " storage policies, and isexy.call_sessions on the Realtime
-- publication through isexy._realtime_add, which the migrate.sh guard
-- allows). Idempotent: CREATE ... IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP POLICY IF EXISTS before CREATE POLICY, DROP TRIGGER IF EXISTS before
-- CREATE TRIGGER, constraints and unique indexes changed only when the data
-- allows it. No data is deleted or rewritten. Every SECURITY DEFINER function
-- pins search_path = isexy, extensions and either checks auth.uid() itself or
-- is executable by service_role only; EXECUTE is revoked from PUBLIC/anon and
-- granted to authenticated only where the client needs it.
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
-- D. Calls (wf/calls). The wf/calls client calls these RPCs instead of
--    writing the call tables; ship them together.
--    D1. credit_transactions.type also accepts 'spend' (call minutes,
--        unlock_conversation) and 'referral_bonus' (apply_referral_code):
--        every connected call was cut off with "out of minutes". One block
--        for parts D and R.
--    D2. In-app calls (video_call_sessions): start_call, answer_call,
--        decline_call, mark_call_connected, charge_call_minute (server
--        clock), end_call (server duration and settlement). The member
--        INSERT/UPDATE policies on video_call_sessions are dropped (RPCs only).
--    D3. record_missed_call (caller only, once per call) + unique index on
--        missed_calls.call_session_id.
--    D4. Phone Line in-app calls (call_sessions): ring, answer, decline,
--        media connected (billing starts only then), charge, end with
--        settlement; call_sessions on Realtime so the receiver hears it ring;
--        start_phone_line_call_session no longer reads the missing
--        profiles.age.
--    D5. Twilio: one session per CallSid, apply_twilio_call_status (service
--        role, statuses only move forward); members cannot mark phone
--        numbers verified; link_my_verified_phone (SMS-confirmed sign-in
--        number); link_my_phone_line_number fixed and admin-only (no DELETE).
--    D6. Moderation state: greetings, voice replies and banned voice profiles
--        change only through staff RPCs (get_voice_greetings_for_review,
--        review_voice_greeting); a greeting goes only on the member's own
--        voice profile; admins read video_call_sessions.
-- R. Rewards: points, credits, loyalty, boosts and payments (wf/rewards).
--    The browser never decides an amount: balances, plans and limits change
--    only here or in the isexy-* payment functions (which call the
--    service_role functions below).
--    R1. (in D1.)
--    R2. Referrals: one referral per new member (was: one per CODE, so a
--        code worked once), get_my_referral_code(), apply_referral_code()
--        hardened.
--    R3. Plans: plan_grants (codes, rewards, staff), subscriptions one row
--        per member, refresh_member_plan() = the best active source decides
--        profiles.is_premium / subscription_tier / subscription_expires_at;
--        sync_entitlements_unchecked() with the plan table the pages show;
--        perform_like_unchecked() spends weekly then purchased Super Likes.
--    R4. Stripe fulfilment: fulfill_stripe_payment(),
--        apply_stripe_subscription(), apply_chat_subscription() (atomic,
--        idempotent per Stripe session); main's
--        fulfill_stripe_credit_purchase() / fulfill_stripe_boost_purchase()
--        credit through fulfill_stripe_payment() (Super Likes to the balance).
--    R5. get_my_wallet(): every balance in one read.
--    R6. use_boost_unchecked(): Boost, Primetime, monthly and Super Boost.
--    R7. redeem_coupon_unchecked(): locked, never downgrades, no fake
--        "discount".
--    R8. Scheduler: reset_monthly_allowances() only when due (main's 0007
--        rule, plus permanent plans and missing wallets),
--        expire_member_plans(), reset_daily_likes(); the weekly/monthly
--        resets are service_role only (main's 0007).
--    R9. Loyalty points and streaks earned for real actions, rewards
--        redeemed server-side; award_streak_badge() uses the server streak.
--    R10. convert_credits_to_minutes(): credits are spendable (1 credit =
--         1 minute).
--    R11. Protected writes moved to RPCs: request_star_cashout(),
--         set_my_cuban_flag(boolean), staff_set_profile_verified();
--         check_promo_eligibility() (anyone could create promotion rows for
--         any member) is service_role only.
--
-- Known production holes (members can UPDATE their own profiles' plan/limit
-- columns, INSERT their own transactions, etc.) are closed by the next
-- security pass; nothing here depends on them, and after parts D and R no
-- client code writes those columns or tables.

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


-- ===========================================================================
-- D. Calls (wf/calls)
-- ===========================================================================

-- ============================================================================
-- D1. Wallet: credit_transactions.type accepts 'spend' and 'referral_bonus'
-- ----------------------------------------------------------------------------
-- deduct_call_minute, charge_call_session_minute and unlock_conversation insert
-- type 'spend' and apply_referral_code inserts 'referral_bonus', but the CHECK
-- only allows purchase/video_call/bonus/refund, so all of them fail at runtime
-- (every connected call was cut off with "out of minutes"). Add the missing
-- values, keeping any value another migration added. (Also R1.)
-- ============================================================================
DO $$
DECLARE
  v_def text;
  v_val text;
  v_add text := '';
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'isexy.credit_transactions'::regclass
     AND conname = 'credit_transactions_type_check';
  IF v_def IS NULL OR position('ARRAY[' IN v_def) = 0 THEN
    RETURN;
  END IF;
  FOREACH v_val IN ARRAY ARRAY['spend', 'referral_bonus'] LOOP
    IF position(quote_literal(v_val) IN v_def) = 0 THEN
      v_add := v_add || quote_literal(v_val) || '::text, ';
    END IF;
  END LOOP;
  IF v_add <> '' THEN
    ALTER TABLE isexy.credit_transactions DROP CONSTRAINT credit_transactions_type_check;
    EXECUTE 'ALTER TABLE isexy.credit_transactions ADD CONSTRAINT credit_transactions_type_check '
         || replace(v_def, 'ARRAY[', 'ARRAY[' || v_add);
  END IF;
END;
$$;

-- ============================================================================
-- D2. In-app calls (video_call_sessions): lifecycle RPCs, server-side billing
-- ----------------------------------------------------------------------------
-- Before: the caller INSERTed/UPDATEd the row itself (status, duration,
-- credits_used) and called deduct_call_minute every 60 s; skipping that call
-- meant free calls. Now the server stamps connected_at, time-gates each
-- minute (first minute at connect, then one per 60 s) and settles whatever is
-- still owed when either side ends the call.
-- ============================================================================
ALTER TABLE isexy.video_call_sessions
  ADD COLUMN IF NOT EXISTS connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_reason text;

CREATE INDEX IF NOT EXISTS video_call_sessions_caller_created_idx
  ON isexy.video_call_sessions (caller_id, created_at DESC);

-- start_call: ring the other member of an active match.
CREATE OR REPLACE FUNCTION isexy.start_call(p_match_id uuid, p_call_type text DEFAULT 'video')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_match matches%ROWTYPE;
  v_other uuid;
  v_balance int;
  v_recent int;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_call_type IS NULL OR p_call_type NOT IN ('video', 'phone') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_type');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match.id IS NULL OR v_match.is_active IS NOT TRUE
     OR v_me NOT IN (v_match.profile1_id, v_match.profile2_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_unavailable');
  END IF;
  v_other := CASE WHEN v_match.profile1_id = v_me THEN v_match.profile2_id ELSE v_match.profile1_id END;

  IF EXISTS (SELECT 1 FROM blocks
              WHERE (blocker_id = v_me AND blocked_id = v_other)
                 OR (blocker_id = v_other AND blocked_id = v_me)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unavailable');
  END IF;

  -- No ringing someone over and over.
  SELECT count(*) INTO v_recent FROM video_call_sessions
   WHERE caller_id = v_me AND created_at > now() - interval '2 minutes';
  IF v_recent >= 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_calls');
  END IF;

  INSERT INTO user_credits (profile_id) VALUES (v_me) ON CONFLICT (profile_id) DO NOTHING;
  SELECT CASE WHEN p_call_type = 'video' THEN video_minutes ELSE phone_minutes END
    INTO v_balance FROM user_credits WHERE profile_id = v_me;
  IF COALESCE(v_balance, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
  END IF;

  -- One ringing call at a time: an older unanswered call of mine stops ringing.
  UPDATE video_call_sessions
     SET status = 'ended', ended_at = now(), end_reason = 'superseded'
   WHERE match_id = p_match_id AND caller_id = v_me AND status IN ('ringing', 'connecting');

  INSERT INTO video_call_sessions (match_id, caller_id, receiver_id, status, call_type, started_at)
  VALUES (p_match_id, v_me, v_other, 'ringing', p_call_type, now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'call_session_id', v_id,
                            'remaining', v_balance, 'receiver_id', v_other);
END;
$$;

-- answer_call: the receiver picks up (ringing -> connecting).
CREATE OR REPLACE FUNCTION isexy.answer_call(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.receiver_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  -- A ringing call (or a connected one the receiver rejoins after a reload).
  IF NOT ((v_s.status IN ('ringing', 'connecting') AND v_s.created_at > now() - interval '3 minutes')
          OR v_s.status = 'connected')
     OR NOT EXISTS (SELECT 1 FROM matches m WHERE m.id = v_s.match_id AND m.is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  IF v_s.status <> 'connected' THEN
    UPDATE video_call_sessions SET status = 'connecting' WHERE id = p_call_session_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'match_id', v_s.match_id, 'caller_id', v_s.caller_id,
                            'call_type', v_s.call_type, 'status', v_s.status);
END;
$$;

-- decline_call: the receiver says no (the caller's screen shows it at once).
CREATE OR REPLACE FUNCTION isexy.decline_call(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.receiver_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status NOT IN ('ringing', 'connecting') THEN
    RETURN jsonb_build_object('success', true, 'already_ended', true, 'status', v_s.status);
  END IF;
  UPDATE video_call_sessions
     SET status = 'declined', ended_at = now(), end_reason = 'declined'
   WHERE id = p_call_session_id;
  RETURN jsonb_build_object('success', true, 'status', 'declined');
END;
$$;

-- mark_call_connected: media is flowing (either side). Billing starts here.
CREATE OR REPLACE FUNCTION isexy.mark_call_connected(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_me NOT IN (v_s.caller_id, v_s.receiver_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  -- Only after the receiver answered (connecting) or again after a reconnect.
  IF v_s.status NOT IN ('connecting', 'connected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  UPDATE video_call_sessions
     SET status = 'connected', connected_at = COALESCE(connected_at, now())
   WHERE id = p_call_session_id
  RETURNING connected_at INTO v_s.connected_at;
  RETURN jsonb_build_object('success', true, 'connected_at', v_s.connected_at);
END;
$$;

-- charge_call_minute: the caller pays one minute when it is due (server clock).
CREATE OR REPLACE FUNCTION isexy.charge_call_minute(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
  v_allowed int;
  v_balance int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.caller_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status <> 'connected' OR v_s.connected_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;

  -- First minute is owed at connect, then one more every 60 s.
  v_allowed := floor(extract(epoch FROM (now() - v_s.connected_at)) / 60)::int + 1;

  SELECT CASE WHEN v_s.call_type = 'phone' THEN phone_minutes ELSE video_minutes END
    INTO v_balance FROM user_credits WHERE profile_id = v_me FOR UPDATE;
  v_balance := COALESCE(v_balance, 0);

  IF COALESCE(v_s.credits_used, 0) >= v_allowed THEN
    RETURN jsonb_build_object('success', true, 'charged', false, 'remaining', v_balance);
  END IF;
  IF v_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
  END IF;

  IF v_s.call_type = 'phone' THEN
    UPDATE user_credits SET phone_minutes = phone_minutes - 1, updated_at = now() WHERE profile_id = v_me;
  ELSE
    UPDATE user_credits SET video_minutes = video_minutes - 1, updated_at = now() WHERE profile_id = v_me;
  END IF;
  UPDATE video_call_sessions SET credits_used = COALESCE(credits_used, 0) + 1 WHERE id = p_call_session_id;
  INSERT INTO credit_transactions (profile_id, amount, type, category, description, video_call_id)
  VALUES (v_me, -1, 'video_call', v_s.call_type,
          CASE WHEN v_s.call_type = 'phone' THEN 'Phone call minute' ELSE 'Video call minute' END,
          v_s.id);

  RETURN jsonb_build_object('success', true, 'charged', true, 'remaining', v_balance - 1);
END;
$$;

-- end_call: either side hangs up. Duration comes from the server clock; any
-- minute still owed is taken from the caller's balance (never below zero).
CREATE OR REPLACE FUNCTION isexy.end_call(p_call_session_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
  v_status text;
  v_duration int := 0;
  v_due int;
  v_balance int;
  v_take int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_me NOT IN (v_s.caller_id, v_s.receiver_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status IN ('ended', 'missed', 'declined') THEN
    RETURN jsonb_build_object('success', true, 'already_ended', true, 'status', v_s.status,
                              'duration_seconds', v_s.duration_seconds, 'credits_used', v_s.credits_used);
  END IF;

  IF v_s.status = 'connected' AND v_s.connected_at IS NOT NULL THEN
    v_status := 'ended';
    v_duration := GREATEST(0, floor(extract(epoch FROM (now() - v_s.connected_at))))::int;
    v_due := GREATEST(1, ceil(v_duration / 60.0)::int) - COALESCE(v_s.credits_used, 0);
    IF v_due > 0 THEN
      SELECT CASE WHEN v_s.call_type = 'phone' THEN phone_minutes ELSE video_minutes END
        INTO v_balance FROM user_credits WHERE profile_id = v_s.caller_id FOR UPDATE;
      v_take := LEAST(v_due, GREATEST(COALESCE(v_balance, 0), 0));
      IF v_take > 0 THEN
        IF v_s.call_type = 'phone' THEN
          UPDATE user_credits SET phone_minutes = phone_minutes - v_take, updated_at = now() WHERE profile_id = v_s.caller_id;
        ELSE
          UPDATE user_credits SET video_minutes = video_minutes - v_take, updated_at = now() WHERE profile_id = v_s.caller_id;
        END IF;
        INSERT INTO credit_transactions (profile_id, amount, type, category, description, video_call_id)
        VALUES (v_s.caller_id, -v_take, 'video_call', v_s.call_type,
                CASE WHEN v_s.call_type = 'phone' THEN 'Phone call minutes (end of call)' ELSE 'Video call minutes (end of call)' END,
                v_s.id);
      END IF;
    END IF;
  ELSIF v_me = v_s.receiver_id THEN
    v_status := 'declined';
  ELSE
    v_status := 'ended';
  END IF;

  UPDATE video_call_sessions
     SET status = v_status,
         ended_at = now(),
         duration_seconds = v_duration,
         credits_used = COALESCE(credits_used, 0) + v_take,
         end_reason = COALESCE(left(nullif(trim(p_reason), ''), 40), end_reason)
   WHERE id = p_call_session_id;

  RETURN jsonb_build_object('success', true, 'status', v_status, 'duration_seconds', v_duration,
                            'credits_used', COALESCE(v_s.credits_used, 0) + v_take);
END;
$$;

-- ============================================================================
-- D3. Missed calls: recorded by the caller through an RPC, once per call
-- ----------------------------------------------------------------------------
-- Only the caller of a call that is still ringing (rang at least 15 s, so it
-- cannot be used to spam), to the other member of an active match. One row
-- per call session (unique index; the missed-call edge function's own insert
-- then fails harmlessly and it still sends the email/push).
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM isexy.missed_calls
     WHERE call_session_id IS NOT NULL
     GROUP BY call_session_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS missed_calls_call_session_uniq
      ON isexy.missed_calls (call_session_id) WHERE call_session_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'missed_calls has duplicate call_session_id rows; unique index not created';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION isexy.record_missed_call(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
  v_missed uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.caller_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM matches m
     WHERE m.id = v_s.match_id AND m.is_active = true
       AND ((m.profile1_id = v_s.caller_id AND m.profile2_id = v_s.receiver_id)
         OR (m.profile2_id = v_s.caller_id AND m.profile1_id = v_s.receiver_id))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_unavailable');
  END IF;

  IF v_s.status = 'missed' THEN
    SELECT id INTO v_missed FROM missed_calls WHERE call_session_id = v_s.id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'already_recorded', true, 'missed_call_id', v_missed);
  END IF;
  IF v_s.status <> 'ringing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_ringing', 'status', v_s.status);
  END IF;
  IF v_s.created_at > now() - interval '15 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_early');
  END IF;

  UPDATE video_call_sessions
     SET status = 'missed', ended_at = now(), end_reason = 'no_answer'
   WHERE id = v_s.id;

  SELECT id INTO v_missed FROM missed_calls WHERE call_session_id = v_s.id LIMIT 1;
  IF v_missed IS NULL THEN
    INSERT INTO missed_calls (call_session_id, caller_id, receiver_id, match_id)
    VALUES (v_s.id, v_s.caller_id, v_s.receiver_id, v_s.match_id)
    RETURNING id INTO v_missed;
  END IF;

  RETURN jsonb_build_object('success', true, 'missed_call_id', v_missed);
END;
$$;

REVOKE ALL ON FUNCTION isexy.start_call(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.answer_call(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.decline_call(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.mark_call_connected(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.charge_call_minute(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.end_call(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.record_missed_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.start_call(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.answer_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.decline_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.mark_call_connected(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.charge_call_minute(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.end_call(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.record_missed_call(uuid) TO authenticated;

-- Members no longer write video_call_sessions themselves (the RPCs above do):
-- the INSERT policy let a member create sessions outside start_call, and the
-- UPDATE policy let either member rewrite status, duration and credits_used
-- of any of their calls. Reading stays (Realtime + catch-up need it).
DROP POLICY IF EXISTS "Users can insert call sessions" ON isexy.video_call_sessions;
DROP POLICY IF EXISTS "Users can update their call sessions" ON isexy.video_call_sessions;

-- ============================================================================
-- D4. Phone Line calls (call_sessions, provider 'in_app')
-- ----------------------------------------------------------------------------
-- start_phone_line_call_session read profiles.age (no such column: every call
-- failed) and created the session 'connected' with answered_at = now(), so
-- the caller paid per minute for a call nobody received. Now:
--   ringing   --answer_call_session (receiver)-->  connected, answered_at NULL
--   connected --mark_call_session_connected (either side, media flowing)-->
--             answered_at stamped; billing starts (charge_call_session_minute,
--             first minute at once, then one per 60 s, server clock)
--   end_call_session: completed + settlement of unpaid minutes when media
--   flowed; missed / declined / canceled / failed otherwise (never charged).
-- Twilio sessions are written by the status callback only (section 5).
-- ============================================================================
CREATE OR REPLACE FUNCTION isexy.start_phone_line_call_session(
  p_target_profile_id uuid,
  p_call_type text DEFAULT 'phone_line_profile'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_caller profiles%ROWTYPE;
  v_pl phone_line_profiles%ROWTYPE;
  v_balance int;
  v_recent int;
  v_session_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_call_type IS DISTINCT FROM 'phone_line_profile' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unsupported_call_type');
  END IF;
  SELECT * INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  IF v_caller.id = p_target_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_call_self');
  END IF;
  -- 18+ from the birth date (profiles has no age column).
  IF v_caller.birth_date IS NULL OR v_caller.birth_date > (current_date - interval '18 years')::date THEN
    RETURN jsonb_build_object('success', false, 'error', 'age_restricted');
  END IF;
  IF v_caller.first_name IS NULL OR length(trim(v_caller.first_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'incomplete_profile');
  END IF;

  SELECT pl.* INTO v_pl
    FROM phone_line_profiles pl
    JOIN profiles p ON p.id = pl.profile_id
   WHERE pl.profile_id = p_target_profile_id AND pl.status = 'active' AND pl.is_public = true
     AND p.is_active IS NOT FALSE
   LIMIT 1;
  IF v_pl.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'voice_profile_unavailable');
  END IF;

  IF EXISTS (SELECT 1 FROM blocks
              WHERE (blocker_id = v_caller.id AND blocked_id = p_target_profile_id)
                 OR (blocker_id = p_target_profile_id AND blocked_id = v_caller.id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'blocked');
  END IF;

  SELECT count(*) INTO v_recent FROM call_sessions
   WHERE caller_profile_id = v_caller.id AND created_at > now() - interval '2 minutes';
  IF v_recent >= 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_calls');
  END IF;

  -- Phone minutes are pay-as-you-go (no premium bypass).
  INSERT INTO user_credits (profile_id) VALUES (v_caller.id) ON CONFLICT (profile_id) DO NOTHING;
  SELECT phone_minutes INTO v_balance FROM user_credits WHERE profile_id = v_caller.id;
  IF COALESCE(v_balance, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'phone_minutes', 0);
  END IF;

  -- One ringing call at a time.
  UPDATE call_sessions
     SET status = 'canceled', ended_at = now(), end_reason = 'superseded'
   WHERE caller_profile_id = v_caller.id AND provider = 'in_app' AND call_type = 'phone_line_profile'
     AND status IN ('initiating', 'ringing');

  INSERT INTO call_sessions (
    caller_profile_id, receiver_profile_id, phone_line_profile_id,
    call_type, provider, status, started_at
  ) VALUES (
    v_caller.id, p_target_profile_id, v_pl.id,
    'phone_line_profile', 'in_app', 'ringing', now()
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('success', true, 'call_session_id', v_session_id,
                            'phone_minutes', v_balance, 'display_name', v_pl.display_name);
END;
$$;

-- answer_call_session: the receiver picks up (or rejoins after a reload).
CREATE OR REPLACE FUNCTION isexy.answer_call_session(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
  v_caller_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.provider <> 'in_app' OR v_s.receiver_profile_id IS DISTINCT FROM v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.ended_at IS NOT NULL
     OR NOT ((v_s.status IN ('initiating', 'ringing') AND v_s.started_at > now() - interval '3 minutes')
             OR v_s.status = 'connected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  IF EXISTS (SELECT 1 FROM blocks
              WHERE (blocker_id = v_me AND blocked_id = v_s.caller_profile_id)
                 OR (blocker_id = v_s.caller_profile_id AND blocked_id = v_me)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active');
  END IF;
  IF v_s.status <> 'connected' THEN
    UPDATE call_sessions SET status = 'connected', updated_at = now() WHERE id = p_call_session_id;
  END IF;
  SELECT first_name INTO v_caller_name FROM profiles WHERE id = v_s.caller_profile_id;
  RETURN jsonb_build_object('success', true, 'status', 'connected', 'caller_profile_id', v_s.caller_profile_id,
                            'caller_name', v_caller_name, 'call_type', v_s.call_type);
END;
$$;

-- decline_call_session: the receiver says no while it rings.
CREATE OR REPLACE FUNCTION isexy.decline_call_session(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.provider <> 'in_app' OR v_s.receiver_profile_id IS DISTINCT FROM v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status NOT IN ('initiating', 'ringing') THEN
    RETURN jsonb_build_object('success', true, 'already_ended', v_s.ended_at IS NOT NULL, 'status', v_s.status);
  END IF;
  UPDATE call_sessions
     SET status = 'declined', ended_at = now(), end_reason = 'declined', updated_at = now()
   WHERE id = p_call_session_id;
  RETURN jsonb_build_object('success', true, 'status', 'declined');
END;
$$;

-- mark_call_session_connected: media is flowing (either side, after the
-- receiver answered). Billing starts here.
CREATE OR REPLACE FUNCTION isexy.mark_call_session_connected(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.provider <> 'in_app'
     OR (v_me <> v_s.caller_profile_id AND v_s.receiver_profile_id IS DISTINCT FROM v_me) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status <> 'connected' OR v_s.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  UPDATE call_sessions
     SET answered_at = COALESCE(answered_at, now()), updated_at = now()
   WHERE id = p_call_session_id
  RETURNING answered_at INTO v_s.answered_at;
  RETURN jsonb_build_object('success', true, 'answered_at', v_s.answered_at);
END;
$$;

-- charge_call_session_minute: the caller pays one minute when it is due
-- (same contract as before; in-app sessions only, media must have flowed).
CREATE OR REPLACE FUNCTION isexy.charge_call_session_minute(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
  v_before int;
  v_allowed int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_s.id IS NULL OR v_s.provider <> 'in_app' THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;
  IF v_s.caller_profile_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  IF v_s.status IN ('completed', 'canceled', 'missed', 'declined', 'failed') OR v_s.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  IF v_s.status <> 'connected' OR v_s.answered_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_connected', 'status', v_s.status);
  END IF;

  v_allowed := floor(extract(epoch FROM (now() - v_s.answered_at)) / 60)::int + 1;
  SELECT COALESCE(phone_minutes, 0) INTO v_before FROM user_credits WHERE profile_id = v_me FOR UPDATE;
  v_before := COALESCE(v_before, 0);
  IF COALESCE(v_s.minutes_charged, 0) >= v_allowed THEN
    RETURN jsonb_build_object('success', true, 'charged', false, 'reason', 'not_due_yet', 'remaining', v_before);
  END IF;
  IF v_before <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
  END IF;

  UPDATE user_credits SET phone_minutes = phone_minutes - 1, updated_at = now() WHERE profile_id = v_me;
  UPDATE call_sessions SET minutes_charged = minutes_charged + 1, updated_at = now() WHERE id = p_call_session_id;
  INSERT INTO call_minute_transactions
    (profile_id, call_session_id, call_type, minutes_charged, balance_before, balance_after)
  VALUES (v_me, p_call_session_id, v_s.call_type, 1, v_before, v_before - 1);
  INSERT INTO credit_transactions (profile_id, amount, type, category, description)
  VALUES (v_me, -1, 'spend', 'phone', 'Phone Line call minute');

  RETURN jsonb_build_object('success', true, 'charged', true, 'remaining', v_before - 1);
END;
$$;

-- end_call_session: either participant of an in-app session ends it.
CREATE OR REPLACE FUNCTION isexy.end_call_session(
  p_call_session_id uuid,
  p_end_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
  v_new_status text;
  v_duration int := 0;
  v_due int;
  v_before int;
  v_take int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_s.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;
  IF v_s.caller_profile_id <> v_me AND v_s.receiver_profile_id IS DISTINCT FROM v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  IF v_s.provider <> 'in_app' THEN
    -- Twilio calls end with the provider's status callback.
    RETURN jsonb_build_object('success', false, 'error', 'provider_managed', 'status', v_s.status);
  END IF;
  IF v_s.status IN ('completed', 'canceled', 'failed', 'missed', 'declined') OR v_s.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_ended', true, 'status', v_s.status,
                              'duration_seconds', v_s.duration_seconds, 'minutes_charged', v_s.minutes_charged);
  END IF;

  IF v_s.status = 'connected' AND v_s.answered_at IS NOT NULL THEN
    v_new_status := 'completed';
    v_duration := GREATEST(0, floor(extract(epoch FROM (now() - v_s.answered_at))))::int;
    v_due := GREATEST(1, ceil(v_duration / 60.0)::int) - COALESCE(v_s.minutes_charged, 0);
    IF v_due > 0 THEN
      SELECT COALESCE(phone_minutes, 0) INTO v_before
        FROM user_credits WHERE profile_id = v_s.caller_profile_id FOR UPDATE;
      v_take := LEAST(v_due, GREATEST(COALESCE(v_before, 0), 0));
      IF v_take > 0 THEN
        UPDATE user_credits SET phone_minutes = phone_minutes - v_take, updated_at = now()
         WHERE profile_id = v_s.caller_profile_id;
        INSERT INTO call_minute_transactions
          (profile_id, call_session_id, call_type, minutes_charged, balance_before, balance_after)
        VALUES (v_s.caller_profile_id, v_s.id, v_s.call_type, v_take, v_before, v_before - v_take);
        INSERT INTO credit_transactions (profile_id, amount, type, category, description)
        VALUES (v_s.caller_profile_id, -v_take, 'spend', 'phone', 'Phone Line call minutes (end of call)');
      END IF;
    END IF;
  ELSIF v_s.status = 'connected' THEN
    -- Answered, but media never flowed: nobody pays.
    v_new_status := CASE WHEN p_end_reason = 'failed' THEN 'failed' ELSE 'canceled' END;
  ELSIF p_end_reason = 'no_answer' AND v_me = v_s.caller_profile_id
        AND v_s.started_at <= now() - interval '15 seconds' THEN
    v_new_status := 'missed';
  ELSIF v_me = v_s.receiver_profile_id THEN
    v_new_status := 'declined';
  ELSIF p_end_reason = 'failed' THEN
    v_new_status := 'failed';
  ELSE
    v_new_status := 'canceled';
  END IF;

  UPDATE call_sessions
     SET status = v_new_status,
         ended_at = now(),
         duration_seconds = v_duration,
         minutes_charged = COALESCE(minutes_charged, 0) + v_take,
         end_reason = COALESCE(left(nullif(trim(p_end_reason), ''), 40), end_reason),
         updated_at = now()
   WHERE id = p_call_session_id;

  RETURN jsonb_build_object('success', true, 'status', v_new_status, 'duration_seconds', v_duration,
                            'minutes_charged', COALESCE(v_s.minutes_charged, 0) + v_take);
END;
$$;

-- The receiver hears a Phone Line call ring through Realtime (RLS: participants read).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'isexy' AND tablename = 'call_sessions'
  ) THEN
    PERFORM isexy._realtime_add('call_sessions');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_created
  ON isexy.call_sessions (caller_profile_id, created_at DESC);

REVOKE ALL ON FUNCTION isexy.start_phone_line_call_session(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.answer_call_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.decline_call_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.mark_call_session_connected(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.end_call_session(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.charge_call_session_minute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.start_phone_line_call_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.answer_call_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.decline_call_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.mark_call_session_connected(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.end_call_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.charge_call_session_minute(uuid) TO authenticated;

-- ============================================================================
-- D5. Twilio phone line: one session per CallSid, ordered statuses, numbers
-- ----------------------------------------------------------------------------
-- The inbound webhook inserted a new call_sessions row on every Twilio retry;
-- the status callback let a late 'in-progress' move a finished call back to
-- 'connected' and overwrote answered_at. Member-written phone numbers could be
-- marked verified (RLS lets owners INSERT/UPDATE every column), and
-- link_my_phone_line_number used columns that do not exist (always failed),
-- was open to every member and DELETEd other members' rows.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM isexy.call_sessions
     WHERE provider_call_sid IS NOT NULL
     GROUP BY provider_call_sid HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS call_sessions_provider_call_sid_uniq
      ON isexy.call_sessions (provider_call_sid);
  ELSE
    RAISE NOTICE 'call_sessions has duplicate provider_call_sid rows; unique index not created';
  END IF;
END;
$$;

-- Status callback (service role only): statuses only move forward.
CREATE OR REPLACE FUNCTION isexy.apply_twilio_call_status(
  p_call_sid text,
  p_status text,
  p_duration int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_s call_sessions%ROWTYPE;
  v_new text;
BEGIN
  IF p_call_sid IS NULL OR p_call_sid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_call_sid');
  END IF;
  v_new := CASE p_status
    WHEN 'queued' THEN 'initiating'
    WHEN 'initiated' THEN 'initiating'
    WHEN 'ringing' THEN 'ringing'
    WHEN 'in-progress' THEN 'connected'
    WHEN 'answered' THEN 'connected'
    WHEN 'completed' THEN 'completed'
    WHEN 'busy' THEN 'missed'
    WHEN 'no-answer' THEN 'missed'
    WHEN 'failed' THEN 'failed'
    WHEN 'canceled' THEN 'canceled'
    ELSE NULL
  END;
  IF v_new IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unknown_status');
  END IF;

  SELECT * INTO v_s FROM call_sessions WHERE provider_call_sid = p_call_sid FOR UPDATE;
  IF v_s.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;
  IF v_s.status IN ('completed', 'missed', 'declined', 'failed', 'canceled') THEN
    RETURN jsonb_build_object('success', true, 'ignored', true, 'status', v_s.status);
  END IF;
  -- initiating < ringing < connected < terminal
  IF (v_new = 'initiating' AND v_s.status <> 'initiating')
     OR (v_new = 'ringing' AND v_s.status = 'connected') THEN
    RETURN jsonb_build_object('success', true, 'ignored', true, 'status', v_s.status);
  END IF;

  UPDATE call_sessions
     SET status = v_new,
         answered_at = CASE WHEN v_new = 'connected' THEN COALESCE(answered_at, now()) ELSE answered_at END,
         ended_at = CASE WHEN v_new IN ('completed', 'missed', 'failed', 'canceled') THEN COALESCE(ended_at, now()) ELSE ended_at END,
         duration_seconds = CASE WHEN v_new = 'completed' AND COALESCE(p_duration, 0) > 0 THEN p_duration ELSE duration_seconds END,
         end_reason = CASE WHEN v_new IN ('missed', 'failed', 'canceled') THEN COALESCE(end_reason, p_status) ELSE end_reason END,
         updated_at = now()
   WHERE id = v_s.id;
  RETURN jsonb_build_object('success', true, 'status', v_new);
END;
$$;
REVOKE ALL ON FUNCTION isexy.apply_twilio_call_status(text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.apply_twilio_call_status(text, text, int) TO service_role;

-- Members may add or edit their own number, never mark it verified.
CREATE OR REPLACE FUNCTION isexy.phone_line_numbers_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.phone_verified := false;
    ELSE
      NEW.phone_verified := OLD.phone_verified AND NEW.phone_verified
                            AND NEW.phone_number_e164 = OLD.phone_number_e164
                            AND NEW.profile_id = OLD.profile_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phone_line_numbers_member_guard ON isexy.phone_line_numbers;
CREATE TRIGGER phone_line_numbers_member_guard
  BEFORE INSERT OR UPDATE ON isexy.phone_line_numbers
  FOR EACH ROW EXECUTE FUNCTION isexy.phone_line_numbers_member_guard();

-- link_my_verified_phone: the number the member confirmed by SMS code at
-- sign-in (Takatak Auth: auth.users.phone + phone_confirmed_at) lets them use
-- the phone line by phone. A number belongs to one member: an older link of the
-- same number to another profile is switched off (kept, not deleted).
CREATE OR REPLACE FUNCTION isexy.link_my_verified_phone()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile_id uuid;
  v_phone text;
  v_confirmed timestamptz;
  v_norm text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  SELECT u.phone, u.phone_confirmed_at INTO v_phone, v_confirmed FROM auth.users u WHERE u.id = auth.uid();
  v_norm := '+' || regexp_replace(COALESCE(v_phone, ''), '\D', '', 'g');
  IF v_confirmed IS NULL OR v_norm !~ '^\+\d{7,16}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_verified_phone');
  END IF;

  UPDATE phone_line_numbers SET phone_verified = false, updated_at = now()
   WHERE phone_number_e164 = v_norm AND profile_id <> v_profile_id AND phone_verified;
  UPDATE phone_line_numbers SET is_primary = false, updated_at = now()
   WHERE profile_id = v_profile_id AND phone_number_e164 <> v_norm AND is_primary;
  INSERT INTO phone_line_numbers (profile_id, phone_number_e164, phone_verified, is_primary)
  VALUES (v_profile_id, v_norm, true, true)
  ON CONFLICT (profile_id, phone_number_e164) DO UPDATE
    SET phone_verified = true, is_primary = true, updated_at = now();

  RETURN jsonb_build_object('success', true,
                            'phone_masked', left(v_norm, 2) || repeat('•', greatest(length(v_norm) - 6, 0)) || right(v_norm, 4));
END;
$$;
REVOKE ALL ON FUNCTION isexy.link_my_verified_phone() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.link_my_verified_phone() TO authenticated;

-- link_my_phone_line_number (AdminCallTests "Link & verify", IVR testing):
-- admins only; real columns; no DELETE.
CREATE OR REPLACE FUNCTION isexy.link_my_phone_line_number(p_phone_e164 text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile_id uuid;
  v_norm text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  v_norm := trim(COALESCE(p_phone_e164, ''));
  IF v_norm !~ '^\+\d{7,16}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_e164');
  END IF;

  UPDATE phone_line_numbers SET phone_verified = false, updated_at = now()
   WHERE phone_number_e164 = v_norm AND profile_id <> v_profile_id AND phone_verified;
  INSERT INTO phone_line_numbers (profile_id, phone_number_e164, phone_verified, is_primary)
  VALUES (v_profile_id, v_norm, true, true)
  ON CONFLICT (profile_id, phone_number_e164) DO UPDATE
    SET phone_verified = true, is_primary = true, updated_at = now();

  RETURN jsonb_build_object('success', true, 'profile_id', v_profile_id, 'phone', v_norm);
END;
$$;
REVOKE ALL ON FUNCTION isexy.link_my_phone_line_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.link_my_phone_line_number(text) TO authenticated;

-- ============================================================================
-- D6. Phone Line moderation state: only staff change it
-- ----------------------------------------------------------------------------
-- Owners could approve their own greetings and voice replies
-- (moderation_status is writable through the owner policies), and a banned
-- voice profile un-banned itself on "Save draft" (the client writes status).
-- Greetings default to 'pending' and nothing approved them, so Browse voices
-- was always empty: staff now review them with review_voice_greeting().
-- ============================================================================
CREATE OR REPLACE FUNCTION isexy.voice_greetings_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      -- The insert policy only checks profile_id: the greeting must also go
      -- on the member's own voice profile (not on someone else's, where it
      -- would become that person's newest greeting once approved).
      IF NOT EXISTS (SELECT 1 FROM phone_line_profiles plp
                      WHERE plp.id = NEW.phone_line_profile_id AND plp.profile_id = NEW.profile_id) THEN
        RAISE EXCEPTION 'A greeting goes on your own voice profile' USING ERRCODE = '42501';
      END IF;
      NEW.moderation_status := 'pending';
      NEW.rejected_reason := NULL;
      NEW.report_count := 0;
      NEW.is_hidden := false;
    ELSE
      NEW.report_count := OLD.report_count;
      NEW.is_hidden := OLD.is_hidden;
      NEW.profile_id := OLD.profile_id;
      NEW.phone_line_profile_id := OLD.phone_line_profile_id;
      IF NEW.audio_url IS DISTINCT FROM OLD.audio_url THEN
        NEW.moderation_status := 'pending';   -- new audio: reviewed again
        NEW.rejected_reason := NULL;
      ELSE
        NEW.moderation_status := OLD.moderation_status;
        NEW.rejected_reason := OLD.rejected_reason;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS voice_greetings_member_guard ON isexy.voice_greetings;
CREATE TRIGGER voice_greetings_member_guard
  BEFORE INSERT OR UPDATE ON isexy.voice_greetings
  FOR EACH ROW EXECUTE FUNCTION isexy.voice_greetings_member_guard();

CREATE OR REPLACE FUNCTION isexy.voice_replies_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.moderation_status := 'pending';
      NEW.rejected_reason := NULL;
      NEW.report_count := 0;
      NEW.is_hidden := false;
      NEW.is_read := false;
    ELSE
      NEW.moderation_status := OLD.moderation_status;
      NEW.rejected_reason := OLD.rejected_reason;
      NEW.report_count := OLD.report_count;
      NEW.is_hidden := OLD.is_hidden;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS voice_replies_member_guard ON isexy.phone_line_voice_replies;
CREATE TRIGGER voice_replies_member_guard
  BEFORE INSERT OR UPDATE ON isexy.phone_line_voice_replies
  FOR EACH ROW EXECUTE FUNCTION isexy.voice_replies_member_guard();

-- A banned voice profile stays banned (and hidden); the owner cannot delete
-- it to start over. Owners can still pause, edit and go live otherwise. The
-- age shown to callers comes from the member's birth date, not a typed number.
CREATE OR REPLACE FUNCTION isexy.phone_line_profiles_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
DECLARE
  v_age int;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.status = 'banned' THEN
        RAISE EXCEPTION 'This voice profile was removed by moderation' USING ERRCODE = '42501';
      END IF;
      RETURN OLD;
    END IF;
    SELECT date_part('year', age(current_date, p.birth_date))::int INTO v_age
      FROM profiles p WHERE p.id = NEW.profile_id;
    IF v_age IS NOT NULL THEN
      NEW.age := v_age;
    END IF;
    IF TG_OP = 'INSERT' THEN
      IF NEW.status = 'banned' THEN NEW.status := 'draft'; END IF;
    ELSE
      NEW.profile_id := OLD.profile_id;
      IF OLD.status = 'banned' THEN
        NEW.status := 'banned';
        NEW.is_public := false;
      ELSIF NEW.status = 'banned' THEN
        NEW.status := OLD.status;
      END IF;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS phone_line_profiles_member_guard ON isexy.phone_line_profiles;
CREATE TRIGGER phone_line_profiles_member_guard
  BEFORE INSERT OR UPDATE OR DELETE ON isexy.phone_line_profiles
  FOR EACH ROW EXECUTE FUNCTION isexy.phone_line_profiles_member_guard();

-- Staff review queue.
CREATE OR REPLACE FUNCTION isexy.get_voice_greetings_for_review(p_limit int DEFAULT 50)
RETURNS TABLE (
  greeting_id uuid,
  phone_line_profile_id uuid,
  profile_id uuid,
  display_name text,
  age int,
  city text,
  headline text,
  profile_status text,
  duration_seconds int,
  report_count int,
  moderation_status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT g.id, g.phone_line_profile_id, g.profile_id, pl.display_name, pl.age, pl.city, pl.headline,
           pl.status, g.duration_seconds, g.report_count, g.moderation_status, g.created_at
      FROM voice_greetings g
      JOIN phone_line_profiles pl ON pl.id = g.phone_line_profile_id
     WHERE g.is_active AND (g.moderation_status = 'pending' OR g.report_count > 0)
     ORDER BY (g.moderation_status = 'pending') DESC, g.created_at
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$$;

CREATE OR REPLACE FUNCTION isexy.review_voice_greeting(
  p_greeting_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_g voice_greetings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  SELECT * INTO v_g FROM voice_greetings WHERE id = p_greeting_id FOR UPDATE;
  IF v_g.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF p_approve IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_decision');
  END IF;
  UPDATE voice_greetings
     SET moderation_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         rejected_reason = CASE WHEN p_approve THEN NULL ELSE left(nullif(trim(p_reason), ''), 300) END,
         is_hidden = CASE WHEN p_approve THEN false ELSE is_hidden END,
         updated_at = now()
   WHERE id = p_greeting_id;
  RETURN jsonb_build_object('success', true, 'moderation_status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$$;

REVOKE ALL ON FUNCTION isexy.get_voice_greetings_for_review(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.review_voice_greeting(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_voice_greetings_for_review(int) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.review_voice_greeting(uuid, boolean, text) TO authenticated;

-- AdminCallTests lists in-app calls too.
DROP POLICY IF EXISTS "Admins can read all video call sessions" ON isexy.video_call_sessions;
CREATE POLICY "Admins can read all video call sessions"
  ON isexy.video_call_sessions FOR SELECT
  TO authenticated
  USING (isexy.has_role(auth.uid(), 'admin'::isexy.app_role));


-- ===========================================================================
-- R. Rewards (wf/rewards)
-- ===========================================================================

-- ===========================================================================
-- R1. credit_transactions.type
-- ===========================================================================
-- 'spend' and 'referral_bonus' are added to the CHECK in D1 (one block).

-- ===========================================================================
-- R2. Referrals
-- ===========================================================================
-- referrals.referral_code was UNIQUE although every row of one referrer
-- carries the same code: the second friend using a code hit a unique
-- violation. The rule that matters is one referral per referred member.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM isexy.referrals WHERE referred_id IS NOT NULL
    GROUP BY referred_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_once_idx
      ON isexy.referrals (referred_id) WHERE referred_id IS NOT NULL;
    IF EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = 'isexy.referrals'::regclass AND conname = 'referrals_referral_code_key'
    ) THEN
      ALTER TABLE isexy.referrals DROP CONSTRAINT referrals_referral_code_key;
    END IF;
  ELSE
    RAISE NOTICE 'referrals: duplicate referred_id rows, unique code constraint kept';
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON isexy.referrals (referrer_id, created_at DESC);

-- The caller's referral code, created on first use (the page used to write
-- profiles.referral_code from the browser).
CREATE OR REPLACE FUNCTION isexy.get_my_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me UUID;
  v_code TEXT;
  i INTEGER;
BEGIN
  SELECT id, referral_code INTO v_me, v_code FROM isexy.profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;
  FOR i IN 1..8 LOOP
    BEGIN
      UPDATE isexy.profiles SET referral_code = isexy.generate_referral_code()
       WHERE id = v_me AND referral_code IS NULL
      RETURNING referral_code INTO v_code;
      IF v_code IS NULL THEN
        SELECT referral_code INTO v_code FROM isexy.profiles WHERE id = v_me;
      END IF;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- another member already has this random code: try again
    END;
  END LOOP;
  RAISE EXCEPTION 'could not create a referral code';
END;
$$;
REVOKE ALL ON FUNCTION isexy.get_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_referral_code() TO authenticated;

-- Apply a friend's code: new members only (profile younger than 30 days),
-- once, never your own code or a code of someone you referred, the referrer
-- must be an active member. Both get 10 credits; a referrer earns at most 20
-- referral bonuses per 30 days (the friend still gets theirs).
CREATE OR REPLACE FUNCTION isexy.apply_referral_code(p_friend_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me profiles%ROWTYPE;
  v_referrer profiles%ROWTYPE;
  v_code text := upper(btrim(coalesce(p_friend_code, '')));
  v_amount integer := 10;
  v_referrer_paid boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No profile');
  END IF;
  IF v_code !~ '^[A-Z0-9]{4,16}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  SELECT * INTO v_referrer FROM profiles
   WHERE referral_code = v_code AND is_active = true AND coalesce(shadow_banned, false) = false;
  IF v_referrer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  IF v_referrer.id = v_me.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own code');
  END IF;
  IF v_me.created_at < now() - interval '30 days' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral codes are for new members (first 30 days)');
  END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referrer_id = v_me.id AND referred_id = v_referrer.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You invited this member: codes cannot be swapped');
  END IF;

  BEGIN
    INSERT INTO referrals (referrer_id, referred_id, referral_code, status, completed_at)
    VALUES (v_referrer.id, v_me.id, v_code, 'completed', now());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already used a referral code');
  END;

  v_referrer_paid := (
    SELECT count(*) FROM credit_transactions
     WHERE profile_id = v_referrer.id AND type = 'referral_bonus'
       AND description = 'Referral bonus' AND created_at > now() - interval '30 days'
  ) < 20;

  INSERT INTO user_credits (profile_id, credits, lifetime_credits)
  VALUES (v_me.id, v_amount, v_amount)
  ON CONFLICT (profile_id) DO UPDATE
    SET credits = user_credits.credits + v_amount,
        lifetime_credits = user_credits.lifetime_credits + v_amount,
        updated_at = now();
  INSERT INTO credit_transactions (profile_id, type, amount, description)
  VALUES (v_me.id, 'referral_bonus', v_amount, 'Welcome referral bonus');

  IF v_referrer_paid THEN
    INSERT INTO user_credits (profile_id, credits, lifetime_credits)
    VALUES (v_referrer.id, v_amount, v_amount)
    ON CONFLICT (profile_id) DO UPDATE
      SET credits = user_credits.credits + v_amount,
          lifetime_credits = user_credits.lifetime_credits + v_amount,
          updated_at = now();
    INSERT INTO credit_transactions (profile_id, type, amount, description)
    VALUES (v_referrer.id, 'referral_bonus', v_amount, 'Referral bonus');
  END IF;

  RETURN jsonb_build_object('success', true, 'credits', v_amount);
END;
$$;
REVOKE ALL ON FUNCTION isexy.apply_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.apply_referral_code(text) TO authenticated;

-- ===========================================================================
-- R3. Plans and limits
-- ===========================================================================
-- Plan table (the one Compare Plans shows):
--   Plus:     unlimited Likes and Rewinds, Passport, visibility controls, no ads
--   Gold:     + See who likes you, Top Picks, 5 Super Likes a week, 1 Boost a month
--   Platinum: + Priority Likes, message before matching, unlimited Super Likes,
--             3 First Impressions a week, 1 Boost a month
-- Free: 100 Likes a day; Super Likes only from the balance (1 to start,
-- bought, or earned with loyalty points).

CREATE OR REPLACE FUNCTION isexy.tier_rank(p_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = isexy, extensions
AS $$
  SELECT CASE p_tier WHEN 'plus' THEN 1 WHEN 'gold' THEN 2 WHEN 'platinum' THEN 3 ELSE 0 END;
$$;

-- Stripe keeps one subscription row per member (the webhook upserts on
-- profile_id, which had no unique constraint, so it never wrote the row).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM isexy.subscriptions GROUP BY profile_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_profile_id_key ON isexy.subscriptions (profile_id);
  ELSE
    RAISE NOTICE 'subscriptions: several rows for one member, unique index not created';
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_idx
  ON isexy.subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Plans that do not come from Stripe: redeemed codes, loyalty rewards, staff.
CREATE TABLE IF NOT EXISTS isexy.plan_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES isexy.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('plus', 'gold', 'platinum')),
  source TEXT NOT NULL CHECK (source IN ('coupon', 'loyalty', 'staff')),
  source_ref TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,  -- NULL: permanent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE isexy.plan_grants ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS plan_grants_profile_idx ON isexy.plan_grants (profile_id, expires_at DESC);
DROP POLICY IF EXISTS "Members view own plan grants" ON isexy.plan_grants;
CREATE POLICY "Members view own plan grants" ON isexy.plan_grants
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));
REVOKE ALL ON isexy.plan_grants FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON isexy.plan_grants FROM authenticated;
GRANT SELECT ON isexy.plan_grants TO authenticated;

-- Entitlements and allowances for the member's current tier.
CREATE OR REPLACE FUNCTION isexy.sync_entitlements_unchecked(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_tier text;
  v_rank integer;
  v_super integer;
  v_fi integer;
  v_boosts integer;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  v_tier := CASE WHEN coalesce(v_profile.is_premium, false)
                 THEN coalesce(nullif(v_profile.subscription_tier, ''), 'free') ELSE 'free' END;
  IF tier_rank(v_tier) = 0 THEN v_tier := 'free'; END IF;
  v_rank := tier_rank(v_tier);
  v_super := CASE v_tier WHEN 'gold' THEN 5 ELSE 0 END;  -- Platinum: unlimited (perform_like)
  v_fi := CASE v_tier WHEN 'platinum' THEN 3 ELSE 0 END;
  v_boosts := CASE WHEN v_rank >= 2 THEN 1 ELSE 0 END;

  INSERT INTO entitlements_cache (profile_id, tier, unlimited_likes, unlimited_rewinds, passport_enabled,
    visibility_controls, ads_disabled, see_who_liked, priority_likes, top_picks_enabled,
    pre_match_message, priority_score_multiplier, weekly_super_likes, weekly_first_impressions, monthly_boosts)
  VALUES (
    p_profile_id, v_tier,
    v_rank >= 1, v_rank >= 1, v_rank >= 1, v_rank >= 1, v_rank >= 1,
    v_rank >= 2,
    v_rank >= 3,
    v_rank >= 2,
    v_rank >= 3,
    CASE v_tier WHEN 'platinum' THEN 2.0 WHEN 'gold' THEN 1.5 WHEN 'plus' THEN 1.2 ELSE 1.0 END,
    v_super, v_fi, v_boosts
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    unlimited_likes = EXCLUDED.unlimited_likes,
    unlimited_rewinds = EXCLUDED.unlimited_rewinds,
    passport_enabled = EXCLUDED.passport_enabled,
    visibility_controls = EXCLUDED.visibility_controls,
    ads_disabled = EXCLUDED.ads_disabled,
    see_who_liked = EXCLUDED.see_who_liked,
    priority_likes = EXCLUDED.priority_likes,
    top_picks_enabled = EXCLUDED.top_picks_enabled,
    pre_match_message = EXCLUDED.pre_match_message,
    priority_score_multiplier = EXCLUDED.priority_score_multiplier,
    weekly_super_likes = EXCLUDED.weekly_super_likes,
    weekly_first_impressions = EXCLUDED.weekly_first_impressions,
    monthly_boosts = EXCLUDED.monthly_boosts,
    last_synced_at = now(),
    updated_at = now();

  -- Weekly allowances: a member who moves up gets the new allowance at once;
  -- moving down caps what is left at the new maximum.
  INSERT INTO allowances (profile_id, weekly_super_likes, weekly_super_likes_max,
    weekly_first_impressions, weekly_first_impressions_max, monthly_boosts, monthly_boosts_max)
  VALUES (p_profile_id, v_super, v_super, v_fi, v_fi, v_boosts, v_boosts)
  ON CONFLICT (profile_id) DO UPDATE SET
    weekly_super_likes = CASE WHEN EXCLUDED.weekly_super_likes_max > allowances.weekly_super_likes_max
                              THEN EXCLUDED.weekly_super_likes_max
                              ELSE least(allowances.weekly_super_likes, EXCLUDED.weekly_super_likes_max) END,
    weekly_super_likes_max = EXCLUDED.weekly_super_likes_max,
    weekly_first_impressions = CASE WHEN EXCLUDED.weekly_first_impressions_max > allowances.weekly_first_impressions_max
                                    THEN EXCLUDED.weekly_first_impressions_max
                                    ELSE least(allowances.weekly_first_impressions, EXCLUDED.weekly_first_impressions_max) END,
    weekly_first_impressions_max = EXCLUDED.weekly_first_impressions_max,
    monthly_boosts = least(allowances.monthly_boosts, EXCLUDED.monthly_boosts_max),
    monthly_boosts_max = EXCLUDED.monthly_boosts_max,
    updated_at = now();

  -- Monthly Boost (Gold/Platinum): the first one comes with the plan, then
  -- reset_monthly_allowances() grants one every 30 days. Lost on downgrade.
  IF v_boosts > 0 THEN
    INSERT INTO boost_wallets (profile_id, monthly_boost_available, monthly_boost_reset_at)
    VALUES (p_profile_id, true, now() + interval '30 days')
    ON CONFLICT (profile_id) DO UPDATE SET
      monthly_boost_available = CASE WHEN boost_wallets.monthly_boost_reset_at IS NULL THEN true
                                     ELSE boost_wallets.monthly_boost_available END,
      monthly_boost_reset_at = coalesce(boost_wallets.monthly_boost_reset_at, now() + interval '30 days'),
      updated_at = now();
  ELSE
    UPDATE boost_wallets SET monthly_boost_available = false, monthly_boost_reset_at = NULL, updated_at = now()
     WHERE profile_id = p_profile_id AND (monthly_boost_available OR monthly_boost_reset_at IS NOT NULL);
  END IF;

  RETURN jsonb_build_object('success', true, 'tier', v_tier);
END;
$$;
REVOKE ALL ON FUNCTION isexy.sync_entitlements_unchecked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.sync_entitlements_unchecked(uuid) TO service_role;

-- The best active plan source decides the member's plan: an active Stripe
-- subscription (1 day of grace after the period end while Stripe renews),
-- a plan grant (code, reward, staff) or a code redeemed before plan_grants
-- existed. Highest tier wins, then the longest. Nothing active: free.
CREATE OR REPLACE FUNCTION isexy.refresh_member_plan(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_tier text;
  v_expires timestamptz;
  v_source text;
  v_found boolean := false;
BEGIN
  SELECT c.tier, c.expires_at, c.source, true INTO v_tier, v_expires, v_source, v_found
  FROM (
    SELECT s.tier, s.current_period_end AS expires_at, 'stripe' AS source
      FROM subscriptions s
     WHERE s.profile_id = p_profile_id
       AND s.status IN ('active', 'trialing')
       AND tier_rank(s.tier) > 0
       AND (s.current_period_end IS NULL OR s.current_period_end + interval '1 day' > now())
    UNION ALL
    SELECT g.tier, g.expires_at, g.source
      FROM plan_grants g
     WHERE g.profile_id = p_profile_id
       AND g.starts_at <= now()
       AND (g.expires_at IS NULL OR g.expires_at > now())
    UNION ALL
    SELECT split_part(r.applied_benefit, ':', 2), r.expires_at, 'coupon'
      FROM coupon_redemptions r
     WHERE r.profile_id = p_profile_id
       AND split_part(r.applied_benefit, ':', 1) IN ('trial', 'permanent', 'vip')
       AND tier_rank(split_part(r.applied_benefit, ':', 2)) > 0
       AND (r.expires_at IS NULL OR r.expires_at > now())
       AND NOT EXISTS (SELECT 1 FROM plan_grants g2 WHERE g2.source = 'coupon' AND g2.source_ref = r.id::text)
  ) c
  ORDER BY tier_rank(c.tier) DESC, (c.expires_at IS NULL) DESC, c.expires_at DESC
  LIMIT 1;

  IF v_found THEN
    UPDATE profiles SET is_premium = true, subscription_tier = v_tier, subscription_expires_at = v_expires,
           updated_at = now()
     WHERE id = p_profile_id
       AND (is_premium IS DISTINCT FROM true OR subscription_tier IS DISTINCT FROM v_tier
            OR subscription_expires_at IS DISTINCT FROM v_expires);
  ELSE
    v_tier := 'free';
    v_expires := NULL;
    v_source := NULL;
    UPDATE profiles SET is_premium = false, subscription_tier = 'free', subscription_expires_at = NULL,
           updated_at = now()
     WHERE id = p_profile_id
       AND (is_premium IS DISTINCT FROM false OR subscription_tier IS DISTINCT FROM 'free'
            OR subscription_expires_at IS NOT NULL);
  END IF;

  PERFORM sync_entitlements_unchecked(p_profile_id);
  RETURN jsonb_build_object('tier', v_tier, 'expires_at', v_expires, 'source', v_source);
END;
$$;
REVOKE ALL ON FUNCTION isexy.refresh_member_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.refresh_member_plan(uuid) TO service_role;

-- Likes and Super Likes (called through the perform_like ownership wrapper).
-- Likes: unlimited on any paid plan, otherwise profiles.likes_remaining.
-- Super Likes: unlimited on Platinum; otherwise this week's allowance first
-- (Gold: 5), then the member's balance (profiles.super_likes_remaining:
-- bought, earned, or the 1 every member starts with). Before, every paid
-- plan (Plus too) had unlimited Super Likes.
CREATE OR REPLACE FUNCTION isexy.perform_like_unchecked(p_swiper_id uuid, p_swiped_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_paid boolean;
  v_weekly integer;
  v_super_total integer;
BEGIN
  IF p_action NOT IN ('like', 'super_like', 'pass') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
  IF p_swiper_id = p_swiped_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot swipe on yourself');
  END IF;
  IF EXISTS (SELECT 1 FROM swipes WHERE swiper_id = p_swiper_id AND swiped_id = p_swiped_id) THEN
    RETURN jsonb_build_object('success', true, 'already_swiped', true);
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_swiper_id FOR UPDATE;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  v_paid := coalesce(v_profile.is_premium, false) AND tier_rank(v_profile.subscription_tier) > 0;

  IF p_action = 'like' AND NOT v_paid THEN
    IF coalesce(v_profile.likes_remaining, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_likes_remaining', 'likes_remaining', 0);
    END IF;
    UPDATE profiles SET likes_remaining = greatest(0, coalesce(likes_remaining, 0) - 1)
     WHERE id = p_swiper_id;
  ELSIF p_action = 'super_like' AND NOT (v_paid AND v_profile.subscription_tier = 'platinum') THEN
    SELECT weekly_super_likes INTO v_weekly FROM allowances WHERE profile_id = p_swiper_id FOR UPDATE;
    IF coalesce(v_weekly, 0) > 0 THEN
      UPDATE allowances SET weekly_super_likes = weekly_super_likes - 1, updated_at = now()
       WHERE profile_id = p_swiper_id;
    ELSIF coalesce(v_profile.super_likes_remaining, 0) > 0 THEN
      UPDATE profiles SET super_likes_remaining = super_likes_remaining - 1 WHERE id = p_swiper_id;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'no_super_likes_remaining', 'super_likes_remaining', 0);
    END IF;
  END IF;

  INSERT INTO swipes (swiper_id, swiped_id, action) VALUES (p_swiper_id, p_swiped_id, p_action);

  SELECT p.likes_remaining, coalesce(p.super_likes_remaining, 0) + coalesce(a.weekly_super_likes, 0)
    INTO v_profile.likes_remaining, v_super_total
    FROM profiles p LEFT JOIN allowances a ON a.profile_id = p.id
   WHERE p.id = p_swiper_id;

  RETURN jsonb_build_object(
    'success', true,
    'likes_remaining', v_profile.likes_remaining,
    'super_likes_remaining', v_super_total
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.perform_like_unchecked(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.perform_like_unchecked(uuid, uuid, text) TO service_role;

-- ===========================================================================
-- R4. Stripe fulfilment (service_role only; called by isexy-stripe-webhook
--     and isexy-check-subscription)
-- ===========================================================================
-- Chat subscriptions renew on Stripe: keep the Stripe subscription id so a
-- renewal extends the row instead of letting it expire after 30 days.
ALTER TABLE isexy.chat_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS chat_subscriptions_stripe_subscription_key
  ON isexy.chat_subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_subscriptions_profile_idx ON isexy.chat_subscriptions (profile_id, expires_at DESC);

-- One-time purchase. The server catalog decides what a product gives; the
-- ledger row is written first with the Stripe session id (unique), so a
-- retried or duplicated event changes nothing. All or nothing.
CREATE OR REPLACE FUNCTION isexy.fulfill_stripe_payment(
  p_session_id text,
  p_profile_id uuid,
  p_product text,
  p_amount_cents integer DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_kind text;
  v_qty integer;
  v_ledger uuid;
  v_gift gift_packages%ROWTYPE;
  v_recipient uuid;
  v_stars integer;
  v_amount numeric := round(coalesce(p_amount_cents, 0) / 100.0, 2);
BEGIN
  -- main's 0011/0012 rules: service role only (also checked here, not only
  -- by the grant) and a well-formed Stripe Checkout session id.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Stripe fulfillment is service-only' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_session_id, '') = '' OR p_profile_id IS NULL OR coalesce(p_product, '') = '' THEN
    RAISE EXCEPTION 'session, profile and product are required' USING ERRCODE = '22023';
  END IF;
  IF length(p_session_id) < 8 OR length(p_session_id) > 255 OR p_session_id NOT LIKE 'cs\_%' THEN
    RAISE EXCEPTION 'Invalid Stripe session reference' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'unknown profile %', p_profile_id USING ERRCODE = '22023';
  END IF;

  -- Catalog: quantities live here, never in the Stripe metadata.
  SELECT k, q INTO v_kind, v_qty FROM (VALUES
    ('credits_10', 'credits', 10), ('credits_25', 'credits', 30),
    ('credits_50', 'credits', 65), ('credits_100', 'credits', 140),
    ('phone_20', 'phone', 20), ('phone_150', 'phone', 150), ('phone_450', 'phone', 450),
    ('video_20', 'video', 20), ('video_150', 'video', 150), ('video_450', 'video', 450),
    ('super_likes_3', 'super_like', 3), ('super_likes_15', 'super_like', 15), ('super_likes_30', 'super_like', 30),
    ('boost_1', 'boost', 1), ('boost_10', 'boost', 10), ('boost_20', 'boost', 20),
    ('primetime_1', 'primetime_boost', 1), ('primetime_3', 'primetime_boost', 3), ('primetime_5', 'primetime_boost', 5),
    ('superboost_3h', 'super_boost', 3), ('superboost_6h', 'super_boost', 6), ('superboost_12h', 'super_boost', 12)
  ) AS c(product, k, q)
  WHERE c.product = p_product;

  -- Serialize deliveries of one session with the same locks as main's
  -- fulfill_stripe_credit_purchase / fulfill_stripe_boost_purchase (the
  -- unique session ledgers below make a replay change nothing anyway).
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    CASE WHEN v_kind IN ('super_like', 'boost', 'primetime_boost', 'super_boost')
         THEN 'isexy:boost:' ELSE 'isexy:' END || p_session_id, 0));

  IF v_kind IN ('credits', 'phone', 'video') THEN
    INSERT INTO credit_transactions (profile_id, amount, type, category, description, stripe_session_id)
    VALUES (p_profile_id, v_qty, 'purchase',
            CASE v_kind WHEN 'credits' THEN 'general' ELSE v_kind END,
            CASE v_kind WHEN 'credits' THEN format('Purchased %s credits (%s)', v_qty, p_product)
                        ELSE format('Purchased %s %s minutes (%s)', v_qty, v_kind, p_product) END,
            p_session_id)
    ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_ledger;
    IF v_ledger IS NULL THEN
      RETURN jsonb_build_object('success', true, 'already_fulfilled', true, 'product', p_product);
    END IF;
    INSERT INTO user_credits (profile_id, credits, lifetime_credits, phone_minutes, video_minutes, last_purchase_at)
    VALUES (p_profile_id,
            CASE WHEN v_kind = 'credits' THEN v_qty ELSE 0 END,
            CASE WHEN v_kind = 'credits' THEN v_qty ELSE 0 END,
            CASE WHEN v_kind = 'phone' THEN v_qty ELSE 0 END,
            CASE WHEN v_kind = 'video' THEN v_qty ELSE 0 END,
            now())
    ON CONFLICT (profile_id) DO UPDATE SET
      credits = user_credits.credits + EXCLUDED.credits,
      lifetime_credits = user_credits.lifetime_credits + EXCLUDED.lifetime_credits,
      phone_minutes = user_credits.phone_minutes + EXCLUDED.phone_minutes,
      video_minutes = user_credits.video_minutes + EXCLUDED.video_minutes,
      last_purchase_at = now(),
      updated_at = now();
    RETURN jsonb_build_object('success', true, 'product', p_product, 'kind', v_kind, 'quantity', v_qty);
  END IF;

  IF v_kind IN ('super_like', 'boost', 'primetime_boost', 'super_boost') THEN
    INSERT INTO boost_transactions (profile_id, boost_type, action, quantity, stripe_session_id)
    VALUES (p_profile_id, v_kind, 'purchase', v_qty, p_session_id)
    ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_ledger;
    IF v_ledger IS NULL THEN
      RETURN jsonb_build_object('success', true, 'already_fulfilled', true, 'product', p_product);
    END IF;
    IF v_kind = 'super_like' THEN
      UPDATE profiles SET super_likes_remaining = coalesce(super_likes_remaining, 0) + v_qty
       WHERE id = p_profile_id;
    ELSE
      INSERT INTO boost_wallets (profile_id, boosts, primetime_boosts, super_boost_hours)
      VALUES (p_profile_id,
              CASE WHEN v_kind = 'boost' THEN v_qty ELSE 0 END,
              CASE WHEN v_kind = 'primetime_boost' THEN v_qty ELSE 0 END,
              CASE WHEN v_kind = 'super_boost' THEN v_qty ELSE 0 END)
      ON CONFLICT (profile_id) DO UPDATE SET
        boosts = boost_wallets.boosts + EXCLUDED.boosts,
        primetime_boosts = boost_wallets.primetime_boosts + EXCLUDED.primetime_boosts,
        super_boost_hours = boost_wallets.super_boost_hours + EXCLUDED.super_boost_hours,
        updated_at = now();
    END IF;
    RETURN jsonb_build_object('success', true, 'product', p_product, 'kind', v_kind, 'quantity', v_qty);
  END IF;

  -- Gifts (Cuba features are on hold: bug fixes only). A Stars package now
  -- really credits the receiver's Stars balance.
  IF p_product LIKE 'gift\_%' THEN
    BEGIN
      SELECT * INTO v_gift FROM gift_packages WHERE id = substr(p_product, 6)::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_gift := NULL;
    END;
    BEGIN
      v_recipient := nullif(p_meta->>'recipient_profile_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_recipient := NULL;
    END;
    IF v_gift.id IS NULL OR v_recipient IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_recipient) THEN
      RETURN jsonb_build_object('success', false, 'error', 'gift_metadata_invalid', 'product', p_product);
    END IF;
    INSERT INTO gift_transactions (sender_profile_id, receiver_profile_id, gift_package_id, amount_usd,
                                   message, status, stripe_session_id, completed_at)
    VALUES (p_profile_id, v_recipient, v_gift.id, v_amount, left(p_meta->>'message', 200),
            'completed', p_session_id, now())
    ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_ledger;
    IF v_ledger IS NULL THEN
      UPDATE gift_transactions SET status = 'completed', completed_at = coalesce(completed_at, now())
       WHERE stripe_session_id = p_session_id AND status <> 'completed';
      RETURN jsonb_build_object('success', true, 'already_fulfilled', true, 'product', p_product);
    END IF;
    IF v_gift.category = 'stars' THEN
      v_stars := nullif(substring(v_gift.name FROM '^([0-9]+)'), '')::integer;
      IF coalesce(v_stars, 0) > 0 THEN
        INSERT INTO star_transactions (sender_profile_id, receiver_profile_id, stars_amount, usd_value,
                                       transaction_type, status, stripe_session_id, message)
        VALUES (p_profile_id, v_recipient, v_stars, round(v_stars * 0.01, 2), 'gift', 'completed',
                p_session_id, left(p_meta->>'message', 200));
        INSERT INTO user_stars (profile_id, stars_balance, lifetime_stars_received)
        VALUES (v_recipient, v_stars, v_stars)
        ON CONFLICT (profile_id) DO UPDATE SET
          stars_balance = user_stars.stars_balance + v_stars,
          lifetime_stars_received = user_stars.lifetime_stars_received + v_stars,
          updated_at = now();
        INSERT INTO user_stars (profile_id, lifetime_stars_sent)
        VALUES (p_profile_id, v_stars)
        ON CONFLICT (profile_id) DO UPDATE SET
          lifetime_stars_sent = user_stars.lifetime_stars_sent + v_stars,
          updated_at = now();
      END IF;
    END IF;
    RETURN jsonb_build_object('success', true, 'product', p_product, 'kind', 'gift', 'stars', v_stars);
  END IF;

  -- Donations, mobile top-ups, food packages (Cuba, on hold: recorded as before).
  IF p_product ~ '^(donation|topup|food)_[0-9]+$' THEN
    INSERT INTO donations (donor_profile_id, recipient_profile_id, amount_usd, donation_type, phone_number,
                           recipient_name, status, stripe_session_id, completed_at)
    VALUES (p_profile_id,
            CASE WHEN coalesce(p_meta->>'recipient_profile_id', '') ~ '^[0-9a-f-]{36}$'
                 THEN (p_meta->>'recipient_profile_id')::uuid END,
            v_amount,
            CASE split_part(p_product, '_', 1) WHEN 'topup' THEN 'topup' WHEN 'food' THEN 'food' ELSE 'cash' END,
            left(p_meta->>'phone_number', 40), left(p_meta->>'recipient_name', 120),
            'completed', p_session_id, now())
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING id INTO v_ledger;
    IF v_ledger IS NULL THEN
      UPDATE donations SET status = 'completed', completed_at = coalesce(completed_at, now())
       WHERE stripe_session_id = p_session_id AND status <> 'completed';
      RETURN jsonb_build_object('success', true, 'already_fulfilled', true, 'product', p_product);
    END IF;
    RETURN jsonb_build_object('success', true, 'product', p_product, 'kind', 'donation');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'unknown_product', 'product', p_product);
END;
$$;
REVOKE ALL ON FUNCTION isexy.fulfill_stripe_payment(text, uuid, text, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.fulfill_stripe_payment(text, uuid, text, integer, text, jsonb) TO service_role;

-- main's 0011 fulfill_stripe_credit_purchase and 0012
-- fulfill_stripe_boost_purchase (called by the live webhook v6 until this
-- branch's webhook is deployed): same signatures, same boolean answer (true:
-- credited now, false: this session was already credited), same service-role
-- check, session check, product lists and 22023 for an unknown product; the
-- crediting itself is fulfill_stripe_payment's, so there is one definition of
-- what a product gives and one idempotency rule per Stripe session whichever
-- function a delivery reaches. Difference from the 0012 body: purchased Super
-- Likes go to the spendable balance (profiles.super_likes_remaining, spent by
-- perform_like after the weekly allowance) instead of raising
-- allowances.weekly_super_likes_max, which refilled them every week and which
-- sync_entitlements resets to the plan's value.
CREATE OR REPLACE FUNCTION isexy.fulfill_stripe_credit_purchase(
  p_profile_id uuid,
  p_stripe_session_id text,
  p_package_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Stripe fulfillment is service-only' USING ERRCODE='42501';
  END IF;
  IF p_profile_id IS NULL OR p_stripe_session_id IS NULL
     OR length(p_stripe_session_id) < 8 OR length(p_stripe_session_id) > 255
     OR p_stripe_session_id NOT LIKE 'cs_%' THEN
    RAISE EXCEPTION 'Invalid Stripe session reference' USING ERRCODE='22023';
  END IF;
  IF p_package_id IS NULL OR p_package_id NOT IN (
       'credits_10', 'credits_25', 'credits_50', 'credits_100',
       'phone_20', 'phone_150', 'phone_450', 'video_20', 'video_150', 'video_450') THEN
    RAISE EXCEPTION 'Unknown ISEXY package' USING ERRCODE='22023';
  END IF;
  v_result := isexy.fulfill_stripe_payment(p_stripe_session_id, p_profile_id, p_package_id);
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'ISEXY package not fulfilled: %', coalesce(v_result->>'error', 'unknown') USING ERRCODE='22023';
  END IF;
  RETURN NOT coalesce((v_result->>'already_fulfilled')::boolean, false);
END;
$function$;
REVOKE ALL ON FUNCTION isexy.fulfill_stripe_credit_purchase(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.fulfill_stripe_credit_purchase(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION isexy.fulfill_stripe_boost_purchase(
  p_profile_id uuid,
  p_stripe_session_id text,
  p_product_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'ISEXY Stripe boost fulfillment is service-only' USING ERRCODE='42501';
  END IF;
  IF p_profile_id IS NULL OR p_stripe_session_id IS NULL
     OR length(p_stripe_session_id) < 8 OR length(p_stripe_session_id) > 255
     OR p_stripe_session_id NOT LIKE 'cs_%' THEN
    RAISE EXCEPTION 'Invalid Stripe session reference' USING ERRCODE='22023';
  END IF;
  IF p_product_id IS NULL OR p_product_id NOT IN (
       'super_likes_3', 'super_likes_15', 'super_likes_30',
       'boost_1', 'boost_10', 'boost_20',
       'primetime_1', 'primetime_3', 'primetime_5',
       'superboost_3h', 'superboost_6h', 'superboost_12h') THEN
    RAISE EXCEPTION 'Unknown ISEXY boost product' USING ERRCODE='22023';
  END IF;
  v_result := isexy.fulfill_stripe_payment(p_stripe_session_id, p_profile_id, p_product_id);
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'ISEXY boost product not fulfilled: %', coalesce(v_result->>'error', 'unknown') USING ERRCODE='22023';
  END IF;
  RETURN NOT coalesce((v_result->>'already_fulfilled')::boolean, false);
END;
$function$;
REVOKE ALL ON FUNCTION isexy.fulfill_stripe_boost_purchase(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.fulfill_stripe_boost_purchase(uuid,text,text) TO service_role;

-- A plan subscription's state from Stripe (checkout completed, updated,
-- deleted, or a member's "Restore purchases"). The row of that Stripe
-- subscription is updated; an active subscription with no row yet becomes
-- the member's row. Then the member's plan is recomputed.
CREATE OR REPLACE FUNCTION isexy.apply_stripe_subscription(
  p_profile_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_tier text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile uuid;
  v_active boolean := coalesce(p_status, '') IN ('active', 'trialing');
  v_tier text := CASE WHEN tier_rank(p_tier) > 0 THEN p_tier END;
BEGIN
  IF coalesce(p_subscription_id, '') = '' THEN
    RAISE EXCEPTION 'subscription id required' USING ERRCODE = '22023';
  END IF;

  UPDATE subscriptions SET
      status = coalesce(p_status, status),
      tier = coalesce(v_tier, tier),
      stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
      current_period_start = coalesce(p_period_start, current_period_start),
      current_period_end = coalesce(p_period_end, current_period_end),
      updated_at = now()
   WHERE stripe_subscription_id = p_subscription_id
  RETURNING profile_id INTO v_profile;

  IF v_profile IS NULL THEN
    IF p_profile_id IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unknown_subscription');
    END IF;
    IF NOT v_active OR v_tier IS NULL THEN
      RETURN jsonb_build_object('success', true, 'ignored', true);
    END IF;
    v_profile := p_profile_id;
    INSERT INTO subscriptions (profile_id, stripe_customer_id, stripe_subscription_id, tier, status,
                               current_period_start, current_period_end)
    VALUES (v_profile, p_customer_id, p_subscription_id, v_tier, p_status, p_period_start, p_period_end)
    ON CONFLICT (profile_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      tier = EXCLUDED.tier,
      status = EXCLUDED.status,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = now();
  END IF;

  IF v_active THEN
    UPDATE profiles SET first_purchase_promo_used = true
     WHERE id = v_profile AND first_purchase_promo_used IS DISTINCT FROM true;
  END IF;

  RETURN jsonb_build_object('success', true, 'profile_id', v_profile) || refresh_member_plan(v_profile);
END;
$$;
REVOKE ALL ON FUNCTION isexy.apply_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.apply_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz) TO service_role;

-- Chat subscription (chat_1mo): created at checkout, extended or ended by the
-- Stripe subscription's later events.
CREATE OR REPLACE FUNCTION isexy.apply_chat_subscription(
  p_profile_id uuid,
  p_subscription_id text,
  p_session_id text,
  p_status text,
  p_expires_at timestamptz,
  p_plan_months integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_status text := CASE WHEN coalesce(p_status, '') IN ('active', 'trialing') THEN 'active'
                        WHEN coalesce(p_status, '') IN ('past_due', 'unpaid') THEN 'past_due'
                        ELSE 'canceled' END;
  v_id uuid;
BEGIN
  IF coalesce(p_subscription_id, '') = '' AND coalesce(p_session_id, '') = '' THEN
    RAISE EXCEPTION 'subscription or session id required' USING ERRCODE = '22023';
  END IF;

  UPDATE chat_subscriptions SET
      status = v_status,
      expires_at = coalesce(p_expires_at, expires_at),
      stripe_subscription_id = coalesce(stripe_subscription_id, nullif(p_subscription_id, '')),
      updated_at = now()
   WHERE (p_subscription_id <> '' AND stripe_subscription_id = p_subscription_id)
      OR (coalesce(p_session_id, '') <> '' AND stripe_session_id = p_session_id)
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    IF p_profile_id IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unknown_subscription');
    END IF;
    IF v_status <> 'active' THEN
      RETURN jsonb_build_object('success', true, 'ignored', true);
    END IF;
    INSERT INTO chat_subscriptions (profile_id, plan_months, status, expires_at, stripe_session_id, stripe_subscription_id)
    VALUES (p_profile_id, greatest(coalesce(p_plan_months, 1), 1), 'active',
            coalesce(p_expires_at, now() + make_interval(days => 30 * greatest(coalesce(p_plan_months, 1), 1))),
            nullif(p_session_id, ''), nullif(p_subscription_id, ''))
    RETURNING id INTO v_id;
    IF coalesce(p_session_id, '') <> '' THEN
      INSERT INTO credit_transactions (profile_id, amount, type, category, description, stripe_session_id)
      VALUES (p_profile_id, 0, 'purchase', 'chat_sub', 'Chat subscription', p_session_id)
      ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION isexy.apply_chat_subscription(uuid, text, text, text, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.apply_chat_subscription(uuid, text, text, text, timestamptz, integer) TO service_role;

-- ===========================================================================
-- R5. Wallet: every balance of the caller in one read
-- ===========================================================================
CREATE OR REPLACE FUNCTION isexy.get_my_wallet()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_c user_credits%ROWTYPE;
  v_w boost_wallets%ROWTYPE;
  v_a allowances%ROWTYPE;
  v_paid boolean;
  v_source text;
  v_boost_until timestamptz;
  v_chat_until timestamptz;
  v_stars integer;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE user_id = auth.uid();
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_c FROM user_credits WHERE profile_id = v_p.id;
  SELECT * INTO v_w FROM boost_wallets WHERE profile_id = v_p.id;
  SELECT * INTO v_a FROM allowances WHERE profile_id = v_p.id;
  v_paid := coalesce(v_p.is_premium, false) AND tier_rank(v_p.subscription_tier) > 0;

  IF v_paid THEN
    SELECT src INTO v_source FROM (
      SELECT 'stripe' AS src, tier_rank(s.tier) AS r, s.current_period_end AS e
        FROM subscriptions s
       WHERE s.profile_id = v_p.id AND s.status IN ('active', 'trialing') AND s.tier = v_p.subscription_tier
      UNION ALL
      SELECT g.source, tier_rank(g.tier), g.expires_at
        FROM plan_grants g
       WHERE g.profile_id = v_p.id AND g.tier = v_p.subscription_tier
         AND g.starts_at <= now() AND (g.expires_at IS NULL OR g.expires_at > now())
    ) x ORDER BY (x.src = 'stripe') DESC LIMIT 1;
  END IF;

  v_boost_until := greatest(
    CASE WHEN v_p.last_boost_at > now() - interval '30 minutes' THEN v_p.last_boost_at + interval '30 minutes' END,
    CASE WHEN v_p.super_boost_until > now() THEN v_p.super_boost_until END);

  SELECT max(expires_at) INTO v_chat_until FROM chat_subscriptions
   WHERE profile_id = v_p.id AND status = 'active' AND expires_at > now();
  SELECT stars_balance INTO v_stars FROM user_stars WHERE profile_id = v_p.id;

  RETURN jsonb_build_object(
    'profile_id', v_p.id,
    'tier', CASE WHEN v_paid THEN v_p.subscription_tier ELSE 'free' END,
    'is_premium', v_paid,
    'plan_expires_at', CASE WHEN v_paid THEN v_p.subscription_expires_at END,
    'plan_source', v_source,
    'credits', coalesce(v_c.credits, 0),
    'phone_minutes', coalesce(v_c.phone_minutes, 0),
    'video_minutes', coalesce(v_c.video_minutes, 0),
    'boosts', coalesce(v_w.boosts, 0),
    'primetime_boosts', coalesce(v_w.primetime_boosts, 0),
    'super_boost_hours', coalesce(v_w.super_boost_hours, 0),
    'monthly_boost_available', coalesce(v_w.monthly_boost_available, false)
                               AND v_paid AND tier_rank(v_p.subscription_tier) >= 2,
    'monthly_boost_reset_at', v_w.monthly_boost_reset_at,
    'boost_active_until', v_boost_until,
    'super_likes', coalesce(v_p.super_likes_remaining, 0),
    'weekly_super_likes', coalesce(v_a.weekly_super_likes, 0),
    'weekly_super_likes_max', coalesce(v_a.weekly_super_likes_max, 0),
    'super_likes_unlimited', v_paid AND v_p.subscription_tier = 'platinum',
    'weekly_first_impressions', coalesce(v_a.weekly_first_impressions, 0),
    'weekly_first_impressions_max', coalesce(v_a.weekly_first_impressions_max, 0),
    'weekly_reset_at', v_a.weekly_reset_at,
    'likes_remaining', coalesce(v_p.likes_remaining, 0),
    'likes_unlimited', v_paid,
    'chat_subscription_until', v_chat_until,
    'stars', coalesce(v_stars, 0)
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.get_my_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_wallet() TO authenticated;

-- ===========================================================================
-- R6. Boosts (called through the use_boost ownership wrapper)
-- ===========================================================================
-- boost / primetime / monthly: 30 minutes at the top of Discover (the
-- ranking reads profiles.last_boost_at). super: all banked Super Boost hours
-- at once (profiles.super_boost_until, extended if one is running). A Boost
-- is not spent while another one is still running.
CREATE OR REPLACE FUNCTION isexy.use_boost_unchecked(p_profile_id uuid, p_boost_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_w boost_wallets%ROWTYPE;
  v_until timestamptz;
  v_hours integer;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  SELECT * INTO v_w FROM boost_wallets WHERE profile_id = p_profile_id FOR UPDATE;

  IF p_boost_type IN ('boost', 'primetime', 'monthly') THEN
    v_until := greatest(
      CASE WHEN v_p.last_boost_at > now() - interval '30 minutes' THEN v_p.last_boost_at + interval '30 minutes' END,
      CASE WHEN v_p.super_boost_until > now() THEN v_p.super_boost_until END);
    IF v_until IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'boost_active', 'active_until', v_until);
    END IF;
  END IF;

  IF p_boost_type = 'boost' THEN
    IF coalesce(v_w.boosts, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_boosts', 'remaining', 0);
    END IF;
    UPDATE boost_wallets SET boosts = boosts - 1, updated_at = now() WHERE profile_id = p_profile_id;
  ELSIF p_boost_type = 'primetime' THEN
    IF coalesce(v_w.primetime_boosts, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_primetime_boosts', 'remaining', 0);
    END IF;
    UPDATE boost_wallets SET primetime_boosts = primetime_boosts - 1, updated_at = now() WHERE profile_id = p_profile_id;
  ELSIF p_boost_type = 'monthly' THEN
    IF NOT coalesce(v_w.monthly_boost_available, false)
       OR NOT (coalesce(v_p.is_premium, false) AND tier_rank(v_p.subscription_tier) >= 2) THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_monthly_boost');
    END IF;
    UPDATE boost_wallets SET monthly_boost_available = false, updated_at = now() WHERE profile_id = p_profile_id;
  ELSIF p_boost_type = 'super' THEN
    v_hours := coalesce(v_w.super_boost_hours, 0);
    IF v_hours <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_super_boost', 'remaining', 0);
    END IF;
    v_until := greatest(now(), coalesce(v_p.super_boost_until, now())) + make_interval(hours => v_hours);
    UPDATE boost_wallets SET super_boost_hours = 0, updated_at = now() WHERE profile_id = p_profile_id;
    UPDATE profiles SET super_boost_until = v_until WHERE id = p_profile_id;
    INSERT INTO boost_transactions (profile_id, boost_type, action, quantity)
    VALUES (p_profile_id, 'super_boost', 'use', v_hours);
    RETURN jsonb_build_object('success', true, 'boost_type', 'super', 'hours', v_hours, 'active_until', v_until);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_boost_type');
  END IF;

  UPDATE profiles SET last_boost_at = now() WHERE id = p_profile_id;
  INSERT INTO boost_transactions (profile_id, boost_type, action, quantity)
  VALUES (p_profile_id, CASE p_boost_type WHEN 'primetime' THEN 'primetime_boost' ELSE p_boost_type END, 'use', 1);

  RETURN jsonb_build_object('success', true, 'boost_type', p_boost_type,
                            'duration', 1800, 'active_until', now() + interval '30 minutes');
END;
$$;
REVOKE ALL ON FUNCTION isexy.use_boost_unchecked(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.use_boost_unchecked(uuid, text) TO service_role;

-- ===========================================================================
-- R7. Redeem a code (called through the redeem_coupon ownership wrapper)
-- ===========================================================================
-- Checked server-side as before (active, dates, max uses, once per member),
-- now with the code row locked (no over-redeeming), checkout discount codes
-- refused instead of "redeemed" with no effect, and a plan the member
-- already has (same or higher tier, lasting at least as long) refused rather
-- than wasted. The plan comes as a plan_grant: a paid plan is never
-- overwritten or shortened.
CREATE OR REPLACE FUNCTION isexy.redeem_coupon_unchecked(p_code text, p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_coupon coupon_codes%ROWTYPE;
  v_p profiles%ROWTYPE;
  v_tier text;
  v_expires timestamptz;
  v_redemption uuid;
  v_plan jsonb;
BEGIN
  SELECT * INTO v_coupon FROM coupon_codes
   WHERE code = upper(btrim(coalesce(p_code, '')))
     AND is_active = true
     AND (starts_at IS NULL OR starts_at <= now())
     AND (expires_at IS NULL OR expires_at > now())
   FOR UPDATE;
  IF v_coupon.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired code');
  END IF;
  IF v_coupon.code_type = 'discount' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This is a checkout discount code, it cannot be redeemed here');
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND coalesce(v_coupon.current_uses, 0) >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This code has reached its maximum uses');
  END IF;
  IF EXISTS (SELECT 1 FROM coupon_redemptions WHERE coupon_id = v_coupon.id AND profile_id = p_profile_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this code');
  END IF;

  v_tier := coalesce(v_coupon.subscription_tier, 'platinum');
  IF tier_rank(v_tier) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired code');
  END IF;
  v_expires := CASE WHEN v_coupon.duration_days IS NOT NULL
                    THEN now() + make_interval(days => v_coupon.duration_days) END;

  SELECT * INTO v_p FROM profiles WHERE id = p_profile_id FOR UPDATE;
  IF coalesce(v_p.is_premium, false) AND tier_rank(v_p.subscription_tier) >= tier_rank(v_tier)
     AND (v_p.subscription_expires_at IS NULL OR (v_expires IS NOT NULL AND v_p.subscription_expires_at >= v_expires)) THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Your %s plan already includes everything this code gives', initcap(v_p.subscription_tier)));
  END IF;

  INSERT INTO coupon_redemptions (coupon_id, profile_id, applied_benefit, expires_at)
  VALUES (v_coupon.id, p_profile_id, v_coupon.code_type || ':' || v_tier, v_expires)
  RETURNING id INTO v_redemption;
  INSERT INTO plan_grants (profile_id, tier, source, source_ref, expires_at)
  VALUES (p_profile_id, v_tier, 'coupon', v_redemption::text, v_expires);
  UPDATE coupon_codes SET current_uses = coalesce(current_uses, 0) + 1, updated_at = now() WHERE id = v_coupon.id;

  v_plan := refresh_member_plan(p_profile_id);
  RETURN jsonb_build_object(
    'success', true,
    'code_type', v_coupon.code_type,
    'subscription_tier', v_tier,
    'expires_at', v_expires,
    'description', v_coupon.description,
    'plan', v_plan
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.redeem_coupon_unchecked(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.redeem_coupon_unchecked(text, uuid) TO service_role;

-- ===========================================================================
-- R8. Scheduler (isexy-reset-allowances, isexy-subscription-resets)
-- ===========================================================================
-- Monthly Boost every 30 days for Gold/Platinum. Replaces main's 0007 body
-- (same rule: only when the wallet is due, service role only) and adds: the
-- plan must be active (is_premium), permanent plans (no end date) get it too,
-- and a Gold/Platinum member without a wallet row gets one. Keeps 0007's
-- empty search_path (every name schema-qualified).
CREATE OR REPLACE FUNCTION isexy.reset_monthly_allowances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE isexy.allowances SET
    monthly_boosts = monthly_boosts_max,
    monthly_reset_at = now() + interval '30 days',
    updated_at = now()
  WHERE monthly_reset_at <= now();

  INSERT INTO isexy.boost_wallets (profile_id)
  SELECT p.id FROM isexy.profiles p
   WHERE p.is_premium AND p.subscription_tier IN ('gold', 'platinum')
     AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE isexy.boost_wallets w SET
    monthly_boost_available = true,
    monthly_boost_reset_at = now() + interval '30 days',
    updated_at = now()
  FROM isexy.profiles p
  WHERE p.id = w.profile_id
    AND p.is_premium AND p.subscription_tier IN ('gold', 'platinum')
    AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
    AND (w.monthly_boost_reset_at IS NULL OR w.monthly_boost_reset_at <= now());
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
-- Service role only, as main's 0007 (which also made reset_weekly_allowances
-- service-only); repeated after the CREATE OR REPLACE for the reader.
REVOKE ALL ON FUNCTION isexy.reset_monthly_allowances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.reset_monthly_allowances() TO service_role;

-- Plans whose end date passed: recompute (another source may still be
-- active) so the plan, entitlements and allowances follow.
CREATE OR REPLACE FUNCTION isexy.expire_member_plans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM profiles
     WHERE is_premium = true AND subscription_expires_at IS NOT NULL AND subscription_expires_at < now()
  LOOP
    PERFORM refresh_member_plan(r.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION isexy.expire_member_plans() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.expire_member_plans() TO service_role;

-- 100 Likes a day for members without a paid plan (run once a day).
CREATE OR REPLACE FUNCTION isexy.reset_daily_likes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE profiles SET likes_remaining = 100
   WHERE is_active = true
     AND NOT (coalesce(is_premium, false) AND tier_rank(subscription_tier) > 0)
     AND coalesce(likes_remaining, 0) < 100;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION isexy.reset_daily_likes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.reset_daily_likes() TO service_role;

-- ===========================================================================
-- R9. Loyalty points and streaks
-- ===========================================================================
-- Points are earned for real actions, checked on the server when the member
-- opens the app or the Rewards page (no trigger on busy tables):
--   daily visit +5 (once per day, Toronto time), profile with 3+ photos,
--   a bio and 3+ interests +50 (once), verified profile +100 (once),
--   first message sent +10 (once), each new mutual match +25 (4 a day at
--   most), each friend who joined with your code +200 (5 a month at most).
-- Streak: consecutive days with a visit; badges at 3/7/14/30/100 days with
-- the rewards the Consistency Challenge shows.
CREATE TABLE IF NOT EXISTS isexy.loyalty_accounts (
  profile_id UUID PRIMARY KEY REFERENCES isexy.profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_visit_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS isexy.loyalty_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES isexy.profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, reason, ref)
);
CREATE INDEX IF NOT EXISTS loyalty_events_profile_idx ON isexy.loyalty_events (profile_id, created_at DESC);
ALTER TABLE isexy.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE isexy.loyalty_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view own loyalty account" ON isexy.loyalty_accounts;
CREATE POLICY "Members view own loyalty account" ON isexy.loyalty_accounts
  FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Members view own loyalty events" ON isexy.loyalty_events;
CREATE POLICY "Members view own loyalty events" ON isexy.loyalty_events
  FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));
REVOKE ALL ON isexy.loyalty_accounts, isexy.loyalty_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON isexy.loyalty_accounts, isexy.loyalty_events FROM authenticated;
GRANT SELECT ON isexy.loyalty_accounts, isexy.loyalty_events TO authenticated;

-- Add points once per (reason, ref). Returns the points added (0 if already counted).
CREATE OR REPLACE FUNCTION isexy.loyalty_earn(p_profile_id uuid, p_reason text, p_ref text, p_points integer, p_detail text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF coalesce(p_points, 0) <= 0 THEN RETURN 0; END IF;
  INSERT INTO loyalty_events (profile_id, points, reason, ref, detail)
  VALUES (p_profile_id, p_points, p_reason, coalesce(p_ref, ''), p_detail)
  ON CONFLICT (profile_id, reason, ref) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN 0; END IF;
  INSERT INTO loyalty_accounts (profile_id, points, lifetime_points)
  VALUES (p_profile_id, p_points, p_points)
  ON CONFLICT (profile_id) DO UPDATE SET
    points = loyalty_accounts.points + p_points,
    lifetime_points = loyalty_accounts.lifetime_points + p_points,
    updated_at = now();
  RETURN p_points;
END;
$$;
REVOKE ALL ON FUNCTION isexy.loyalty_earn(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.loyalty_earn(uuid, text, text, integer, text) TO service_role;

-- Check the one-time achievements, matches and referrals; returns points added.
CREATE OR REPLACE FUNCTION isexy.loyalty_sync(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_added integer := 0;
  r record;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE id = p_profile_id;
  IF v_p.id IS NULL THEN RETURN 0; END IF;

  IF char_length(btrim(coalesce(v_p.bio, ''))) >= 10
     AND coalesce(array_length(v_p.interests, 1), 0) >= 3
     AND (SELECT count(*) FROM profile_photos WHERE profile_id = v_p.id) >= 3 THEN
    v_added := v_added + loyalty_earn(v_p.id, 'profile_complete', '', 50, 'Complete profile');
  END IF;
  IF coalesce(v_p.is_verified, false) THEN
    v_added := v_added + loyalty_earn(v_p.id, 'verified', '', 100, 'Verified profile');
  END IF;
  IF EXISTS (SELECT 1 FROM messages WHERE sender_id = v_p.id) THEN
    v_added := v_added + loyalty_earn(v_p.id, 'first_message', '', 10, 'First message sent');
  END IF;

  -- Mutual matches of the last 30 days, at most 4 per day count.
  FOR r IN
    SELECT id FROM (
      SELECT m.id, row_number() OVER (PARTITION BY (m.matched_at AT TIME ZONE 'America/Toronto')::date
                                      ORDER BY m.matched_at, m.id) AS n
        FROM matches m
       WHERE (m.profile1_id = v_p.id OR m.profile2_id = v_p.id)
         AND m.matched_at > now() - interval '30 days'
         AND EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = m.profile1_id AND s.swiped_id = m.profile2_id AND s.action <> 'pass')
         AND EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = m.profile2_id AND s.swiped_id = m.profile1_id AND s.action <> 'pass')
    ) x WHERE x.n <= 4
  LOOP
    v_added := v_added + loyalty_earn(v_p.id, 'match', r.id::text, 25, 'New match');
  END LOOP;

  -- Friends who joined with this member's code, at most 5 per calendar month.
  FOR r IN
    SELECT referred_id FROM (
      SELECT f.referred_id, row_number() OVER (PARTITION BY date_trunc('month', f.completed_at)
                                               ORDER BY f.completed_at, f.id) AS n
        FROM referrals f
       WHERE f.referrer_id = v_p.id AND f.status = 'completed' AND f.referred_id IS NOT NULL
    ) x WHERE x.n <= 5
  LOOP
    v_added := v_added + loyalty_earn(v_p.id, 'referral', r.referred_id::text, 200, 'Friend joined');
  END LOOP;

  RETURN v_added;
END;
$$;
REVOKE ALL ON FUNCTION isexy.loyalty_sync(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.loyalty_sync(uuid) TO service_role;

-- Streak badges and their rewards (Consistency Challenge):
--   3 days: 25 points · 7: 1 Super Like · 14: 1 Boost · 30: 3 Super Likes · 100: 5 Boosts.
CREATE OR REPLACE FUNCTION isexy.loyalty_award_badges(p_profile_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_streak integer;
  v_new text[] := '{}';
  v_badge text;
  t record;
BEGIN
  SELECT current_streak INTO v_streak FROM loyalty_accounts WHERE profile_id = p_profile_id;
  FOR t IN SELECT * FROM (VALUES (3, '3_day'), (7, '7_day'), (14, '14_day'), (30, '30_day'), (100, '100_day')) AS b(days, badge)
  LOOP
    EXIT WHEN coalesce(v_streak, 0) < t.days;
    INSERT INTO streak_badges (profile_id, badge_type, streak_count)
    VALUES (p_profile_id, t.badge, t.days)
    ON CONFLICT (profile_id, badge_type) DO NOTHING
    RETURNING badge_type INTO v_badge;
    IF v_badge IS NOT NULL THEN
      v_new := v_new || v_badge;
      IF t.badge = '3_day' THEN
        PERFORM loyalty_earn(p_profile_id, 'streak_badge', t.badge, 25, '3-day streak');
      ELSIF t.badge IN ('7_day', '30_day') THEN
        UPDATE profiles SET super_likes_remaining = coalesce(super_likes_remaining, 0) + CASE t.badge WHEN '7_day' THEN 1 ELSE 3 END
         WHERE id = p_profile_id;
      ELSE
        INSERT INTO boost_wallets (profile_id, boosts) VALUES (p_profile_id, CASE t.badge WHEN '14_day' THEN 1 ELSE 5 END)
        ON CONFLICT (profile_id) DO UPDATE SET boosts = boost_wallets.boosts + EXCLUDED.boosts, updated_at = now();
      END IF;
      v_badge := NULL;
    END IF;
  END LOOP;
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION isexy.loyalty_award_badges(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.loyalty_award_badges(uuid) TO service_role;

-- Called once when the app opens: counts today's visit for the streak and
-- the daily points, checks achievements, awards streak badges.
CREATE OR REPLACE FUNCTION isexy.record_daily_visit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_acc loyalty_accounts%ROWTYPE;
  v_streak integer;
  v_first_today boolean := false;
  v_before integer;
  v_badges text[];
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO loyalty_accounts (profile_id) VALUES (v_me) ON CONFLICT (profile_id) DO NOTHING;
  SELECT * INTO v_acc FROM loyalty_accounts WHERE profile_id = v_me FOR UPDATE;
  v_before := v_acc.points;
  IF v_acc.last_visit_on IS DISTINCT FROM v_today THEN
    v_first_today := true;
    v_streak := CASE WHEN v_acc.last_visit_on = v_today - 1 THEN v_acc.current_streak + 1 ELSE 1 END;
    UPDATE loyalty_accounts SET
      current_streak = v_streak,
      longest_streak = greatest(longest_streak, v_streak),
      last_visit_on = v_today,
      updated_at = now()
    WHERE profile_id = v_me;
    UPDATE profiles SET last_active_at = now() WHERE id = v_me;
    PERFORM loyalty_earn(v_me, 'daily_visit', v_today::text, 5, 'Daily visit');
  END IF;

  PERFORM loyalty_sync(v_me);
  v_badges := loyalty_award_badges(v_me);
  SELECT * INTO v_acc FROM loyalty_accounts WHERE profile_id = v_me;

  RETURN jsonb_build_object(
    'streak', v_acc.current_streak,
    'longest_streak', v_acc.longest_streak,
    'first_visit_today', v_first_today,
    'points', v_acc.points,
    'points_earned', v_acc.points - v_before,
    'new_badges', to_jsonb(v_badges),
    'badges', (SELECT coalesce(jsonb_agg(badge_type ORDER BY streak_count), '[]'::jsonb)
                 FROM streak_badges WHERE profile_id = v_me)
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.record_daily_visit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.record_daily_visit() TO authenticated;

-- The Rewards page: balance, streak, recent activity (after a sync).
CREATE OR REPLACE FUNCTION isexy.get_my_loyalty()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_acc loyalty_accounts%ROWTYPE;
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  INSERT INTO loyalty_accounts (profile_id) VALUES (v_me) ON CONFLICT (profile_id) DO NOTHING;
  PERFORM loyalty_sync(v_me);
  SELECT * INTO v_acc FROM loyalty_accounts WHERE profile_id = v_me;
  RETURN jsonb_build_object(
    'points', v_acc.points,
    'lifetime_points', v_acc.lifetime_points,
    'streak', v_acc.current_streak,
    'longest_streak', v_acc.longest_streak,
    'history', (SELECT coalesce(jsonb_agg(jsonb_build_object('reason', e.reason, 'points', e.points,
                                                             'detail', e.detail, 'created_at', e.created_at)
                                          ORDER BY e.created_at DESC), '[]'::jsonb)
                  FROM (SELECT * FROM loyalty_events WHERE profile_id = v_me ORDER BY created_at DESC LIMIT 20) e),
    'earned', (SELECT coalesce(jsonb_agg(DISTINCT reason), '[]'::jsonb) FROM loyalty_events
                WHERE profile_id = v_me AND reason IN ('profile_complete', 'verified', 'first_message'))
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.get_my_loyalty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_loyalty() TO authenticated;

-- Spend points. The catalog lives here; plan rewards are plan_grants that
-- follow on from a reward plan of the same tier still running.
CREATE OR REPLACE FUNCTION isexy.redeem_loyalty_reward(p_reward text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_cost integer;
  v_kind text;
  v_qty integer;
  v_tier text;
  v_points integer;
  v_start timestamptz;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE user_id = auth.uid();
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT c.cost, c.kind, c.qty, c.tier INTO v_cost, v_kind, v_qty, v_tier FROM (VALUES
    ('super_like_1', 100, 'super_like', 1, NULL),
    ('boost_1', 250, 'boost', 1, NULL),
    ('super_like_5', 400, 'super_like', 5, NULL),
    ('boost_3', 600, 'boost', 3, NULL),
    ('gold_week', 1000, 'plan', 7, 'gold'),
    ('platinum_week', 2000, 'plan', 7, 'platinum'),
    ('gold_month', 3000, 'plan', 30, 'gold'),
    ('platinum_month', 5000, 'plan', 30, 'platinum')
  ) AS c(id, cost, kind, qty, tier)
  WHERE c.id = p_reward;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unknown_reward');
  END IF;

  INSERT INTO loyalty_accounts (profile_id) VALUES (v_p.id) ON CONFLICT (profile_id) DO NOTHING;
  SELECT points INTO v_points FROM loyalty_accounts WHERE profile_id = v_p.id FOR UPDATE;
  IF v_points < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_points', 'points', v_points, 'cost', v_cost);
  END IF;

  IF v_kind = 'plan' THEN
    SELECT max(expires_at) INTO v_start FROM plan_grants
     WHERE profile_id = v_p.id AND source = 'loyalty' AND tier = v_tier AND expires_at > now();
    v_start := greatest(now(), coalesce(v_start, now()));
    v_expires := v_start + make_interval(days => v_qty);
    IF coalesce(v_p.is_premium, false) AND tier_rank(v_p.subscription_tier) >= tier_rank(v_tier)
       AND (v_p.subscription_expires_at IS NULL OR v_p.subscription_expires_at >= v_expires) THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_covered');
    END IF;
  END IF;

  UPDATE loyalty_accounts SET points = points - v_cost, updated_at = now() WHERE profile_id = v_p.id;
  INSERT INTO loyalty_events (profile_id, points, reason, ref, detail)
  VALUES (v_p.id, -v_cost, 'redeem', gen_random_uuid()::text, p_reward);

  IF v_kind = 'super_like' THEN
    UPDATE profiles SET super_likes_remaining = coalesce(super_likes_remaining, 0) + v_qty WHERE id = v_p.id;
  ELSIF v_kind = 'boost' THEN
    INSERT INTO boost_wallets (profile_id, boosts) VALUES (v_p.id, v_qty)
    ON CONFLICT (profile_id) DO UPDATE SET boosts = boost_wallets.boosts + v_qty, updated_at = now();
  ELSE
    INSERT INTO plan_grants (profile_id, tier, source, source_ref, starts_at, expires_at)
    VALUES (v_p.id, v_tier, 'loyalty', p_reward, v_start, v_expires);
    PERFORM refresh_member_plan(v_p.id);
  END IF;

  RETURN jsonb_build_object('success', true, 'reward', p_reward, 'points', v_points - v_cost,
                            'expires_at', v_expires);
END;
$$;
REVOKE ALL ON FUNCTION isexy.redeem_loyalty_reward(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.redeem_loyalty_reward(text) TO authenticated;

-- Same signature as before; the streak now comes from the server, never from
-- the browser's count (p_streak_count is ignored).
CREATE OR REPLACE FUNCTION isexy.award_streak_badge(p_badge_type text, p_streak_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No profile');
  END IF;
  IF p_badge_type NOT IN ('3_day', '7_day', '14_day', '30_day', '100_day') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid badge');
  END IF;
  PERFORM loyalty_award_badges(v_me);
  RETURN jsonb_build_object('success',
    EXISTS (SELECT 1 FROM streak_badges WHERE profile_id = v_me AND badge_type = p_badge_type));
END;
$$;
REVOKE ALL ON FUNCTION isexy.award_streak_badge(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.award_streak_badge(text, integer) TO authenticated;

-- ===========================================================================
-- R10. Credits are spendable: 1 credit = 1 minute of video or phone calls
-- ===========================================================================
CREATE OR REPLACE FUNCTION isexy.convert_credits_to_minutes(p_credits integer, p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_c user_credits%ROWTYPE;
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('video', 'phone') OR p_credits IS NULL OR p_credits < 1 OR p_credits > 10000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_request');
  END IF;
  SELECT * INTO v_c FROM user_credits WHERE profile_id = v_me FOR UPDATE;
  IF coalesce(v_c.credits, 0) < p_credits THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_credits', 'credits', coalesce(v_c.credits, 0));
  END IF;
  UPDATE user_credits SET
    credits = credits - p_credits,
    video_minutes = video_minutes + CASE WHEN p_type = 'video' THEN p_credits ELSE 0 END,
    phone_minutes = phone_minutes + CASE WHEN p_type = 'phone' THEN p_credits ELSE 0 END,
    updated_at = now()
  WHERE profile_id = v_me
  RETURNING * INTO v_c;
  INSERT INTO credit_transactions (profile_id, amount, type, category, description) VALUES
    (v_me, -p_credits, 'spend', 'general', format('%s credits converted to %s minutes', p_credits, p_type)),
    (v_me, p_credits, 'bonus', p_type, format('%s %s minutes from credits', p_credits, p_type));
  RETURN jsonb_build_object('success', true, 'credits', v_c.credits,
                            'video_minutes', v_c.video_minutes, 'phone_minutes', v_c.phone_minutes);
END;
$$;
REVOKE ALL ON FUNCTION isexy.convert_credits_to_minutes(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.convert_credits_to_minutes(integer, text) TO authenticated;

-- ===========================================================================
-- R11. Protected writes moved to RPCs
-- ===========================================================================
-- Stars cash-out (Cuba, on hold: bug fix only). The amount in dollars is
-- computed here (1 star = $0.01), the request must fit in the balance minus
-- requests still open. MyStars used to INSERT the row with its own amount.
CREATE OR REPLACE FUNCTION isexy.request_star_cashout(p_stars integer, p_method text, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_balance integer;
  v_open integer;
  v_id uuid;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE user_id = auth.uid();
  IF v_p.id IS NULL OR NOT coalesce(v_p.is_cuban, false) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_method NOT IN ('mobile_topup', 'bank_transfer', 'western_union') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_method');
  END IF;
  SELECT stars_balance INTO v_balance FROM user_stars WHERE profile_id = v_p.id FOR UPDATE;
  SELECT coalesce(sum(stars_amount), 0) INTO v_open FROM star_cashout_requests
   WHERE profile_id = v_p.id AND status IN ('pending', 'processing');
  IF p_stars IS NULL OR p_stars < 1000 OR p_stars > coalesce(v_balance, 0) - v_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount',
                              'available', greatest(coalesce(v_balance, 0) - v_open, 0));
  END IF;
  INSERT INTO star_cashout_requests (profile_id, stars_amount, usd_amount, cashout_method, cashout_details)
  VALUES (v_p.id, p_stars, round(p_stars * 0.01, 2), p_method,
          jsonb_build_object('method', p_method, 'requestedAt', now())
            || CASE WHEN jsonb_typeof(p_details) = 'object' AND octet_length(p_details::text) <= 4096
                    THEN p_details - 'usd_amount' - 'stars_amount' ELSE '{}'::jsonb END)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'id', v_id, 'usd_amount', round(p_stars * 0.01, 2));
END;
$$;
REVOKE ALL ON FUNCTION isexy.request_star_cashout(integer, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.request_star_cashout(integer, text, jsonb) TO authenticated;

-- Cuban signup (on hold, unchanged behaviour): a member may still declare
-- themselves Cuban at signup (CubanSignup), or switch back when finishing the
-- tourist signup (TouristSignup); this only sets the caller's own is_cuban.
-- is_verified stays staff-only.
DROP FUNCTION IF EXISTS isexy.set_my_cuban_flag();
CREATE OR REPLACE FUNCTION isexy.set_my_cuban_flag(p_is_cuban boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  UPDATE profiles SET is_cuban = coalesce(p_is_cuban, true)
   WHERE user_id = auth.uid() AND is_cuban IS DISTINCT FROM coalesce(p_is_cuban, true);
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION isexy.set_my_cuban_flag(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.set_my_cuban_flag(boolean) TO authenticated;

-- Staff (admin or moderator) mark a member verified, e.g. after approving a
-- Cuban ID check in AdminVerifications (photo checks use
-- review_photo_verification).
CREATE OR REPLACE FUNCTION isexy.staff_set_profile_verified(p_profile_id uuid, p_verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (isexy.has_role(auth.uid(), 'admin') OR isexy.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE profiles SET is_verified = coalesce(p_verified, false), updated_at = now() WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown profile' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_set_profile_verified(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_set_profile_verified(uuid, boolean) TO authenticated;

-- check_promo_eligibility(p_profile_id, p_tier) had the default EXECUTE grant
-- (anon too) and no caller check: anyone could create or reset "50% off"
-- promotion rows for any member. No client calls it (the first-week offer is
-- a Stripe coupon applied by isexy-create-checkout), so it is service_role only.
REVOKE ALL ON FUNCTION isexy.check_promo_eligibility(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.check_promo_eligibility(uuid, text) TO service_role;
