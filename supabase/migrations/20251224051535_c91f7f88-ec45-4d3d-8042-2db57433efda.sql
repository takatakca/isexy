-- Add new columns to profiles for lifestyle, personality, and interests
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS drinking text,
ADD COLUMN IF NOT EXISTS smoking text,
ADD COLUMN IF NOT EXISTS workout text,
ADD COLUMN IF NOT EXISTS pets text[],
ADD COLUMN IF NOT EXISTS communication_style text,
ADD COLUMN IF NOT EXISTS love_language text,
ADD COLUMN IF NOT EXISTS education text,
ADD COLUMN IF NOT EXISTS interests text[],
ADD COLUMN IF NOT EXISTS prompts jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS location_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_contacts text[] DEFAULT '{}';

-- Create index on location for nearby searches
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;