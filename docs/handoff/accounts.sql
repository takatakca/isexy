-- ISEXY accounts area (branch wf/accounts): SQL the client code on this branch expects.
-- Not a migration file: the integrator copies it into the next isexy migration.
-- Idempotent, isexy schema (plus the isexy-photo-verifications storage bucket),
-- RLS on every new table, no data deleted or dropped.

SET LOCAL search_path = isexy, extensions;

-- 1. Private member settings --------------------------------------------------
-- useMemberSettings (src/hooks/useMemberSettings.ts) keeps the choices that have
-- no profile column here: Settings discovery toggles and "who I'd like to see"
-- filters, Email and Push notification choices, Active Status, the private
-- Block Contacts list, Passport home city, the account deletion request date.
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
  'Private member settings (discovery, email, push, activeStatus, blockedContacts, passport, deletionRequestedAt). Owner-only via RLS.';

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
