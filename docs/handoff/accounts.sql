-- FOLDED INTO supabase/isexy-migrations/0004_app_completion.sql (part B). Kept as the branch notes; do not apply this file.
-- ISEXY accounts area (branch wf/accounts): SQL the client code on this branch expects.
-- Not a migration file: the integrator copies it into the next isexy migration.
-- Idempotent, isexy schema (plus the isexy-photo-verifications storage bucket),
-- RLS on every new table, no data deleted or dropped.

SET LOCAL search_path = isexy, extensions;

-- 1. Private member settings --------------------------------------------------
-- useMemberSettings (src/hooks/useMemberSettings.ts) keeps the choices that have
-- no profile column here: Settings discovery toggles and "who I'd like to see"
-- filters, Active Status, the private Block Contacts list, Passport home city,
-- the account deletion request date. Email and push choices are NOT here: they
-- are wf/chat's user_preferences.notification_settings column.
-- Existing RLS on user_preferences already limits rows to their owner.
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

-- 2. Photo verification ------------------------------------------------------
-- /photo-verification: the member takes a selfie, it is stored privately in
-- isexy-photo-verifications/{auth uid}/..., a pending request is added here, and
-- a moderator approves or rejects it with isexy.review_photo_verification().
-- Approval is the only path that sets profiles.is_verified from this flow.
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

DO $$
BEGIN
  -- Members read their own requests (status, rejection reason).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'isexy' AND tablename = 'photo_verifications'
                 AND policyname = 'Members view own photo verifications') THEN
    CREATE POLICY "Members view own photo verifications" ON isexy.photo_verifications
      FOR SELECT TO authenticated
      USING (profile_id = (SELECT auth.uid()));
  END IF;

  -- Members file a pending request for their own profile, with a selfie from their own folder.
  -- They can never set the status, the reviewer or the review date.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'isexy' AND tablename = 'photo_verifications'
                 AND policyname = 'Members request own photo verification') THEN
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
  END IF;

  -- Staff read every request (the review itself goes through the function below).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'isexy' AND tablename = 'photo_verifications'
                 AND policyname = 'Staff view photo verifications') THEN
    CREATE POLICY "Staff view photo verifications" ON isexy.photo_verifications
      FOR SELECT TO authenticated
      USING (isexy.has_role((SELECT auth.uid()), 'admin') OR isexy.has_role((SELECT auth.uid()), 'moderator'));
  END IF;
END $$;

-- No UPDATE or DELETE policy: members cannot approve themselves.
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

-- Private bucket for the selfies: 5 MB images, members write and read their own folder only,
-- staff read everything. No update or delete policy (a new selfie is a new file).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('isexy-photo-verifications', 'isexy-photo-verifications', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'isexy: members upload own verification selfie') THEN
    CREATE POLICY "isexy: members upload own verification selfie" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'isexy-photo-verifications'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
                 AND policyname = 'isexy: members and staff view verification selfies') THEN
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
  END IF;
END $$;

-- 3. Discover respects the privacy settings ---------------------------------
-- Replaces isexy.get_discover_feed (0001_isexy_baseline.sql) with the same
-- signature, columns and ranking; it only adds: a member with Settings ›
-- Enable Discovery off, or Incognito, is left out of other decks except for
-- people they already liked; the caller's "Minimum number of photos" and
-- "Has a bio" preferences filter their own deck, "Recently Active" sorts it;
-- Block Contacts keeps two people out of each other's deck when either one
-- listed the other's sign-in email or phone (auth.users, read by this
-- SECURITY DEFINER function only; nothing is revealed to either member). If another branch also
-- replaces this function, merge both sets of conditions.
/**
 * The caller's Discover deck, ranked, with photos, in one call.
 * (accounts: + the candidates' privacy settings and the caller's
 * "Minimum number of photos", "Has a bio" and "Recently Active" preferences,
 * from user_preferences.settings.discovery.)
 * Mutual gender preferences, the caller's age range (always 18+), blocks in
 * both directions, already-swiped and shadow-banned profiles are excluded.
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
