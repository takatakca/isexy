-- Drop the existing check constraint and add one that includes 'whatsapp'
ALTER TABLE public.otp_codes DROP CONSTRAINT IF EXISTS otp_codes_type_check;
ALTER TABLE public.otp_codes ADD CONSTRAINT otp_codes_type_check 
  CHECK (type IN ('verification', 'password_reset', 'login', 'whatsapp'));