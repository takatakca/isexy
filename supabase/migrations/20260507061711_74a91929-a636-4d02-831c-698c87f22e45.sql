
-- =========================================
-- 1. coupon_codes: remove broad SELECT
-- =========================================
DROP POLICY IF EXISTS "Users can view active coupon codes" ON public.coupon_codes;
-- Admin-only read remains via existing "Admins can manage coupon codes"

-- =========================================
-- 2. email_templates: admin-only read
-- =========================================
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.email_templates;

-- =========================================
-- 3. user_credits: lock down writes
-- =========================================
DROP POLICY IF EXISTS "Users can insert own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;
-- SELECT policy stays so users see balance; writes only via SECURITY DEFINER fns / service role

-- =========================================
-- 4. streak_badges: lock down writes
-- =========================================
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.streak_badges;
DROP POLICY IF EXISTS "Users can update their own badges" ON public.streak_badges;

-- =========================================
-- 5. apply_referral_code RPC
-- =========================================
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_friend_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_profile profiles%ROWTYPE;
  v_referrer profiles%ROWTYPE;
  v_credit_amount integer := 10;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_caller_profile FROM profiles WHERE user_id = auth.uid();
  IF v_caller_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No profile');
  END IF;

  SELECT * INTO v_referrer FROM profiles
  WHERE referral_code = upper(trim(p_friend_code));
  IF v_referrer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer.id = v_caller_profile.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own code');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_caller_profile.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already used a referral code');
  END IF;

  INSERT INTO referrals (referrer_id, referred_id, referral_code, status, completed_at)
  VALUES (v_referrer.id, v_caller_profile.id, upper(trim(p_friend_code)), 'completed', now());

  -- Grant credits to both
  INSERT INTO user_credits (profile_id, credits)
  VALUES (v_referrer.id, v_credit_amount)
  ON CONFLICT (profile_id) DO UPDATE SET credits = user_credits.credits + v_credit_amount, updated_at = now();

  INSERT INTO user_credits (profile_id, credits)
  VALUES (v_caller_profile.id, v_credit_amount)
  ON CONFLICT (profile_id) DO UPDATE SET credits = user_credits.credits + v_credit_amount, updated_at = now();

  INSERT INTO credit_transactions (profile_id, type, amount, description) VALUES
    (v_referrer.id, 'referral_bonus', v_credit_amount, 'Referral bonus'),
    (v_caller_profile.id, 'referral_bonus', v_credit_amount, 'Welcome referral bonus');

  RETURN jsonb_build_object('success', true, 'credits', v_credit_amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;

-- =========================================
-- 6. award_streak_badge RPC
-- =========================================
CREATE OR REPLACE FUNCTION public.award_streak_badge(p_badge_type text, p_streak_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_threshold integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No profile');
  END IF;

  v_threshold := CASE p_badge_type
    WHEN '3_day' THEN 3
    WHEN '7_day' THEN 7
    WHEN '14_day' THEN 14
    WHEN '30_day' THEN 30
    WHEN '100_day' THEN 100
    ELSE NULL
  END;

  IF v_threshold IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid badge');
  END IF;

  IF p_streak_count < v_threshold OR p_streak_count > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'streak count not valid');
  END IF;

  -- Idempotent insert
  INSERT INTO streak_badges (profile_id, badge_type, streak_count)
  VALUES (v_profile.id, p_badge_type, v_threshold)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_streak_badge(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_streak_badge(text, integer) TO authenticated;

-- =========================================
-- 7. deduct_video_credit RPC (uses credits column)
-- =========================================
CREATE OR REPLACE FUNCTION public.deduct_video_credit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_credits user_credits%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No profile');
  END IF;

  SELECT * INTO v_credits FROM user_credits WHERE profile_id = v_profile_id FOR UPDATE;

  IF v_credits IS NULL OR v_credits.credits <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_credits', 'remaining', 0);
  END IF;

  UPDATE user_credits SET credits = credits - 1, updated_at = now()
  WHERE profile_id = v_profile_id;

  INSERT INTO credit_transactions (profile_id, amount, type, description)
  VALUES (v_profile_id, -1, 'video_call', 'Video call minute');

  RETURN jsonb_build_object('success', true, 'remaining', v_credits.credits - 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_video_credit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deduct_video_credit() TO authenticated;

-- =========================================
-- 8. ensure_user_credits RPC (initializes wallet without granting credits)
-- =========================================
CREATE OR REPLACE FUNCTION public.ensure_user_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false); END IF;
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN RETURN jsonb_build_object('success', false); END IF;
  INSERT INTO user_credits (profile_id, credits)
  VALUES (v_profile_id, 0)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_user_credits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_credits() TO authenticated;

-- =========================================
-- 9. ticket-attachments storage policies
-- =========================================
DROP POLICY IF EXISTS "Anyone can upload ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own ticket attachments" ON storage.objects;

CREATE POLICY "Users upload own ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users read own ticket attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
  )
);

-- =========================================
-- 10. Realtime channel authorization (basic)
-- Require auth + caller must be involved when topic encodes a match/profile id.
-- =========================================
DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_match_topics" ON realtime.messages;

CREATE POLICY "realtime_authenticated_only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- topic is opaque text; we permit when:
  -- 1) topic doesn't reference a sensitive id, OR
  -- 2) caller is involved in the referenced match / chat / profile.
  CASE
    WHEN realtime.topic() LIKE 'messages-%' OR realtime.topic() LIKE 'typing-%' OR realtime.topic() LIKE 'video-call-%' THEN
      EXISTS (
        SELECT 1 FROM public.matches m
        JOIN public.profiles p ON p.id IN (m.profile1_id, m.profile2_id)
        WHERE p.user_id = auth.uid()
          AND m.id::text = split_part(realtime.topic(), '-', 2)
      )
    WHEN realtime.topic() LIKE 'incoming-calls-%' THEN
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.id::text = substring(realtime.topic() from 16)
      )
    WHEN realtime.topic() LIKE 'group-%' THEN
      EXISTS (
        SELECT 1 FROM public.group_chat_members gcm
        JOIN public.profiles p ON p.id = gcm.profile_id
        WHERE p.user_id = auth.uid()
          AND gcm.group_chat_id::text = substring(realtime.topic() from 7)
      )
    ELSE TRUE
  END
);
