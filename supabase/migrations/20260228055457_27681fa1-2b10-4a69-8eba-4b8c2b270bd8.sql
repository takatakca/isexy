-- Create a function for atomic like with limit check
CREATE OR REPLACE FUNCTION public.perform_like(
  p_swiper_id uuid,
  p_swiped_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_existing_swipe uuid;
BEGIN
  -- Prevent self-like
  IF p_swiper_id = p_swiped_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot swipe on yourself');
  END IF;

  -- Check for existing swipe (idempotency)
  SELECT id INTO v_existing_swipe
  FROM swipes
  WHERE swiper_id = p_swiper_id AND swiped_id = p_swiped_id;
  
  IF v_existing_swipe IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_swiped', true);
  END IF;

  -- For likes/super_likes, check remaining
  IF p_action IN ('like', 'super_like') THEN
    SELECT * INTO v_profile FROM profiles WHERE id = p_swiper_id FOR UPDATE;
    
    IF v_profile IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
    END IF;

    IF p_action = 'like' THEN
      IF COALESCE(v_profile.likes_remaining, 0) <= 0 AND COALESCE(v_profile.is_premium, false) = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'no_likes_remaining', 'likes_remaining', 0);
      END IF;
      IF COALESCE(v_profile.is_premium, false) = false THEN
        UPDATE profiles SET likes_remaining = GREATEST(0, COALESCE(likes_remaining, 0) - 1)
        WHERE id = p_swiper_id;
      END IF;
    ELSIF p_action = 'super_like' THEN
      IF COALESCE(v_profile.super_likes_remaining, 0) <= 0 AND COALESCE(v_profile.is_premium, false) = false THEN
        RETURN jsonb_build_object('success', false, 'error', 'no_super_likes_remaining', 'super_likes_remaining', 0);
      END IF;
      IF COALESCE(v_profile.is_premium, false) = false THEN
        UPDATE profiles SET super_likes_remaining = GREATEST(0, COALESCE(super_likes_remaining, 0) - 1)
        WHERE id = p_swiper_id;
      END IF;
    END IF;
  END IF;

  -- Insert swipe
  INSERT INTO swipes (swiper_id, swiped_id, action)
  VALUES (p_swiper_id, p_swiped_id, p_action);

  -- Get updated counts
  SELECT likes_remaining, super_likes_remaining INTO v_profile.likes_remaining, v_profile.super_likes_remaining
  FROM profiles WHERE id = p_swiper_id;

  RETURN jsonb_build_object(
    'success', true,
    'likes_remaining', v_profile.likes_remaining,
    'super_likes_remaining', v_profile.super_likes_remaining
  );
END;
$$