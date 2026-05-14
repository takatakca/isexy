-- RPC: link a phone number to the caller's profile in phone_line_numbers (testing convenience).
CREATE OR REPLACE FUNCTION public.link_my_phone_line_number(p_phone_e164 text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_norm text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;

  v_norm := trim(coalesce(p_phone_e164, ''));
  IF v_norm !~ '^\+\d{7,16}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_e164');
  END IF;

  -- Detach this number from any other profile, then upsert for this profile.
  DELETE FROM phone_line_numbers WHERE phone_number_e164 = v_norm AND profile_id <> v_profile_id;

  INSERT INTO phone_line_numbers (profile_id, phone_number_e164, phone_verified, verified_at)
  VALUES (v_profile_id, v_norm, true, now())
  ON CONFLICT (profile_id) DO UPDATE
    SET phone_number_e164 = EXCLUDED.phone_number_e164,
        phone_verified = true,
        verified_at = now(),
        updated_at = now();

  RETURN jsonb_build_object('success', true, 'profile_id', v_profile_id, 'phone', v_norm);
END;
$$;

REVOKE ALL ON FUNCTION public.link_my_phone_line_number(text) FROM public;
GRANT EXECUTE ON FUNCTION public.link_my_phone_line_number(text) TO authenticated;