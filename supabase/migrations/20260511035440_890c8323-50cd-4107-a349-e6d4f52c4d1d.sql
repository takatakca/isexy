CREATE OR REPLACE FUNCTION public.deduct_call_minute(p_profile_id uuid, p_call_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_credits user_credits%ROWTYPE;
  v_remaining INTEGER;
  v_owner_ok BOOLEAN;
BEGIN
  -- Validate call type up front
  IF p_call_type NOT IN ('phone', 'video') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_type');
  END IF;

  -- Ownership check: the calling user must own this profile
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_profile_id AND user_id = auth.uid()
  ) INTO v_owner_ok;

  IF NOT v_owner_ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized', 'remaining', 0);
  END IF;

  SELECT * INTO v_credits FROM user_credits WHERE profile_id = p_profile_id FOR UPDATE;

  IF v_credits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_wallet', 'remaining', 0);
  END IF;

  IF p_call_type = 'video' THEN
    IF COALESCE(v_credits.video_minutes, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
    END IF;
    UPDATE user_credits
       SET video_minutes = GREATEST(video_minutes - 1, 0), updated_at = now()
     WHERE profile_id = p_profile_id;
    v_remaining := GREATEST(v_credits.video_minutes - 1, 0);
  ELSE -- phone
    IF COALESCE(v_credits.phone_minutes, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
    END IF;
    UPDATE user_credits
       SET phone_minutes = GREATEST(phone_minutes - 1, 0), updated_at = now()
     WHERE profile_id = p_profile_id;
    v_remaining := GREATEST(v_credits.phone_minutes - 1, 0);
  END IF;

  INSERT INTO credit_transactions (profile_id, amount, type, category, description)
  VALUES (p_profile_id, -1, 'spend', p_call_type, p_call_type || ' call minute');

  RETURN jsonb_build_object('success', true, 'remaining', v_remaining);
END;
$function$;