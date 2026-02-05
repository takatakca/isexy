-- Create OTP storage table for secure verification
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('verification', 'password_reset', 'login')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_otp_codes_email_type ON public.otp_codes(email, type);
CREATE INDEX idx_otp_codes_expires_at ON public.otp_codes(expires_at);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Only edge functions (service role) can access OTPs
-- No policies needed as we'll use service role key in edge function

-- Function to verify OTP
CREATE OR REPLACE FUNCTION public.verify_otp(
  p_email TEXT,
  p_code TEXT,
  p_type TEXT
)
RETURNS JSON AS $$
DECLARE
  v_otp_record RECORD;
  v_result JSON;
BEGIN
  -- Find valid OTP
  SELECT * INTO v_otp_record
  FROM public.otp_codes
  WHERE email = p_email
    AND code = p_code
    AND type = p_type
    AND used_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_otp_record IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid or expired code');
  END IF;
  
  -- Mark as used
  UPDATE public.otp_codes
  SET used_at = now()
  WHERE id = v_otp_record.id;
  
  RETURN json_build_object('valid', true, 'email', p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Cleanup old OTPs (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;