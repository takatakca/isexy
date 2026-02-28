
-- Add first_impression_message to swipes table for Platinum users
ALTER TABLE public.swipes ADD COLUMN IF NOT EXISTS message text;

-- Add shadow_banned flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shadow_banned boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shadow_banned_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shadow_banned_reason text;

-- Add promo tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_purchase_promo_used boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS promo_expires_at timestamp with time zone;
