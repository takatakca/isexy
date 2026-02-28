
-- Update calculate_profile_score to handle super boosts (5x multiplier)
CREATE OR REPLACE FUNCTION public.calculate_profile_score(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_photo_count integer;
  v_score integer := 0;
  v_tier_multiplier numeric := 1.0;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;
  IF v_profile IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_photo_count FROM profile_photos WHERE profile_id = p_profile_id;
  v_score := v_score + LEAST(v_photo_count * 7, 28);

  IF v_profile.bio IS NOT NULL AND length(v_profile.bio) >= 10 THEN v_score := v_score + 20; END IF;
  IF v_profile.interests IS NOT NULL AND array_length(v_profile.interests, 1) >= 3 THEN v_score := v_score + 12; END IF;
  IF COALESCE(v_profile.is_verified, false) THEN v_score := v_score + 8; END IF;
  IF v_profile.job_title IS NOT NULL AND v_profile.job_title != '' THEN v_score := v_score + 8; END IF;
  IF v_profile.school IS NOT NULL AND v_profile.school != '' THEN v_score := v_score + 6; END IF;
  IF v_profile.city IS NOT NULL AND v_profile.city != '' THEN v_score := v_score + 6; END IF;
  IF v_profile.prompts IS NOT NULL AND v_profile.prompts::text != 'null' AND v_profile.prompts::text != '[]' THEN v_score := v_score + 6; END IF;
  IF v_profile.drinking IS NOT NULL OR v_profile.workout IS NOT NULL OR (v_profile.pets IS NOT NULL AND array_length(v_profile.pets, 1) > 0) THEN v_score := v_score + 6; END IF;

  CASE COALESCE(v_profile.subscription_tier, 'free')
    WHEN 'platinum' THEN v_tier_multiplier := 2.0;
    WHEN 'gold' THEN v_tier_multiplier := 1.5;
    WHEN 'plus' THEN v_tier_multiplier := 1.2;
    ELSE v_tier_multiplier := 1.0;
  END CASE;

  -- Super Boost (5x) takes priority over regular Boost (3x)
  IF v_profile.super_boost_until IS NOT NULL AND v_profile.super_boost_until > now() THEN
    v_tier_multiplier := v_tier_multiplier * 5.0;
  ELSIF v_profile.last_boost_at IS NOT NULL AND v_profile.last_boost_at > now() - interval '30 minutes' THEN
    v_tier_multiplier := v_tier_multiplier * 3.0;
  END IF;

  RETURN ROUND(v_score * v_tier_multiplier);
END;
$$;
