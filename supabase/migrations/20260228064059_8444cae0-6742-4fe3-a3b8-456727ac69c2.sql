
-- Add super boost tracking and swipe rate limiting to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS super_boost_until timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS swipe_cooldown_until timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS daily_swipe_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_swipe_reset_at timestamp with time zone DEFAULT now();

-- Function to check and enforce swipe rate limiting
CREATE OR REPLACE FUNCTION public.check_swipe_rate_limit(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_max_swipes integer := 100;
  v_cooldown_minutes integer := 720; -- 12 hours
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Profile not found');
  END IF;

  -- Premium users have no rate limit
  IF COALESCE(v_profile.is_premium, false) THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', 999);
  END IF;

  -- Check if in cooldown
  IF v_profile.swipe_cooldown_until IS NOT NULL AND v_profile.swipe_cooldown_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'error', 'rate_limited',
      'cooldown_until', v_profile.swipe_cooldown_until,
      'remaining', 0
    );
  END IF;

  -- Reset daily count if over 24 hours since last reset
  IF v_profile.last_swipe_reset_at IS NULL OR v_profile.last_swipe_reset_at < now() - interval '24 hours' THEN
    UPDATE profiles SET daily_swipe_count = 0, last_swipe_reset_at = now(), swipe_cooldown_until = NULL
    WHERE id = p_profile_id;
    RETURN jsonb_build_object('allowed', true, 'remaining', v_max_swipes);
  END IF;

  -- Increment and check
  IF v_profile.daily_swipe_count >= v_max_swipes THEN
    -- Set cooldown
    UPDATE profiles SET swipe_cooldown_until = now() + (v_cooldown_minutes || ' minutes')::interval
    WHERE id = p_profile_id;
    RETURN jsonb_build_object(
      'allowed', false, 
      'error', 'rate_limited',
      'cooldown_until', now() + (v_cooldown_minutes || ' minutes')::interval,
      'remaining', 0
    );
  END IF;

  UPDATE profiles SET daily_swipe_count = daily_swipe_count + 1 WHERE id = p_profile_id;
  RETURN jsonb_build_object('allowed', true, 'remaining', v_max_swipes - v_profile.daily_swipe_count - 1);
END;
$$;
