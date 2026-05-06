
-- 1. PROFILES: Restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Users can view active profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view active profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (is_active = true);

-- 2. SUPPORT_TICKETS: Tighten anonymous insert; enforce ownership when user_id set + length limits
DROP POLICY IF EXISTS "Anyone can create tickets" ON public.support_tickets;
CREATE POLICY "Users can create tickets with proper ownership"
ON public.support_tickets FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND char_length(coalesce(name,'')) BETWEEN 1 AND 200
  AND char_length(email) BETWEEN 3 AND 320
  AND char_length(coalesce(subject,'')) BETWEEN 1 AND 300
  AND char_length(coalesce(message,'')) BETWEEN 1 AND 10000
);

-- 3. OTP_CODES: Add explicit deny-all policy for normal roles (service role bypasses RLS)
CREATE POLICY "Deny all client access to otp_codes - select"
ON public.otp_codes FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny all client access to otp_codes - insert"
ON public.otp_codes FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny all client access to otp_codes - update"
ON public.otp_codes FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny all client access to otp_codes - delete"
ON public.otp_codes FOR DELETE TO anon, authenticated USING (false);

-- 4. PROFILE-PHOTOS bucket: make private, restrict to authenticated users
UPDATE storage.buckets SET public = false WHERE id = 'profile-photos';
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
CREATE POLICY "Authenticated users can view profile photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');

-- 5. Match-creation trigger: validate swiper ownership
CREATE OR REPLACE FUNCTION public.check_and_create_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mutual_swipe RECORD;
BEGIN
  -- Defense-in-depth: ensure caller owns the swiper profile (skipped for service role calls where auth.uid() is null)
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.swiper_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized swipe insert';
  END IF;

  IF NEW.action IN ('like', 'super_like') THEN
    SELECT * INTO mutual_swipe FROM public.swipes
    WHERE swiper_id = NEW.swiped_id
      AND swiped_id = NEW.swiper_id
      AND action IN ('like', 'super_like');
    IF FOUND THEN
      INSERT INTO public.matches (profile1_id, profile2_id)
      VALUES (
        LEAST(NEW.swiper_id, NEW.swiped_id),
        GREATEST(NEW.swiper_id, NEW.swiped_id)
      )
      ON CONFLICT (profile1_id, profile2_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
