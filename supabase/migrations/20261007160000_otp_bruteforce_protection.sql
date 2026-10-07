-- OTP hardening.
--
-- verify_otp() had no attempt limit and is callable by anyone, so a 6-digit
-- password-reset code could be brute-forced (a failed guess cost nothing):
-- request a reset for a victim's email, then guess until it matches and
-- change their password. Now each code allows 5 wrong guesses, then it is
-- burned and a new one must be requested (send-email-otp allows 3 per hour).
-- Emails are compared case-insensitively.

ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS otp_codes_lookup_idx ON public.otp_codes (lower(email), type, created_at DESC) WHERE used_at IS NULL;

CREATE OR REPLACE FUNCTION public.verify_otp(p_email TEXT, p_code TEXT, p_type TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp public.otp_codes%ROWTYPE;
  v_max_attempts CONSTANT INTEGER := 5;
BEGIN
  -- The newest live code for this email/type, locked so parallel guesses
  -- are counted one by one.
  SELECT * INTO v_otp
  FROM public.otp_codes
  WHERE lower(email) = lower(btrim(p_email))
    AND type = p_type
    AND used_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid or expired code');
  END IF;

  IF v_otp.attempts >= v_max_attempts THEN
    UPDATE public.otp_codes SET used_at = now() WHERE id = v_otp.id;
    RETURN json_build_object('valid', false, 'error', 'Too many attempts. Request a new code.');
  END IF;

  IF v_otp.code IS DISTINCT FROM btrim(coalesce(p_code, '')) THEN
    UPDATE public.otp_codes
    SET attempts = attempts + 1,
        used_at = CASE WHEN attempts + 1 >= v_max_attempts THEN now() ELSE used_at END
    WHERE id = v_otp.id;
    RETURN json_build_object(
      'valid', false,
      'error', CASE WHEN v_otp.attempts + 1 >= v_max_attempts
                    THEN 'Too many attempts. Request a new code.'
                    ELSE 'Invalid code' END,
      'attempts_left', greatest(0, v_max_attempts - v_otp.attempts - 1)
    );
  END IF;

  UPDATE public.otp_codes SET used_at = now() WHERE id = v_otp.id;
  RETURN json_build_object('valid', true, 'email', lower(btrim(p_email)));
END;
$$;

REVOKE ALL ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_otp(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Exact account lookup for server-side flows (update-user-password used
-- auth.admin.listUsers(), which only returns the first page of 50 users).
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(TEXT) TO service_role;
