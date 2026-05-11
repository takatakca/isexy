-- ============ phone_line_profiles ============
CREATE TABLE public.phone_line_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  age integer NOT NULL CHECK (age >= 18 AND age <= 120),
  city text,
  gender text,
  interested_in text[],
  headline text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','banned')),
  is_public boolean NOT NULL DEFAULT false,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.phone_line_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own phone-line profile"
  ON public.phone_line_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_profiles.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Authenticated users can browse active public profiles"
  ON public.phone_line_profiles FOR SELECT
  TO authenticated
  USING (status = 'active' AND is_public = true);

CREATE POLICY "Owner can insert own phone-line profile"
  ON public.phone_line_profiles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_profiles.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Owner can update own phone-line profile"
  ON public.phone_line_profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_profiles.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Owner can delete own phone-line profile"
  ON public.phone_line_profiles FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_profiles.profile_id AND p.user_id = auth.uid()));

CREATE TRIGGER set_phone_line_profiles_updated_at
  BEFORE UPDATE ON public.phone_line_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ voice_greetings ============
CREATE TABLE public.voice_greetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_line_profile_id uuid NOT NULL REFERENCES public.phone_line_profiles(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  transcript text,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 95),
  moderation_status text NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('pending','approved','rejected')),
  rejected_reason text,
  report_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_greetings_profile ON public.voice_greetings(phone_line_profile_id);

ALTER TABLE public.voice_greetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own greetings"
  ON public.voice_greetings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = voice_greetings.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Authenticated can read approved active greetings of public profiles"
  ON public.voice_greetings FOR SELECT
  TO authenticated
  USING (
    moderation_status = 'approved'
    AND is_active = true
    AND is_hidden = false
    AND EXISTS (
      SELECT 1 FROM public.phone_line_profiles plp
      WHERE plp.id = voice_greetings.phone_line_profile_id
        AND plp.status = 'active'
        AND plp.is_public = true
    )
  );

CREATE POLICY "Owner can insert greeting"
  ON public.voice_greetings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = voice_greetings.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Owner can update own greeting"
  ON public.voice_greetings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = voice_greetings.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Owner can delete own greeting"
  ON public.voice_greetings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = voice_greetings.profile_id AND p.user_id = auth.uid()));

CREATE TRIGGER set_voice_greetings_updated_at
  BEFORE UPDATE ON public.voice_greetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ phone_line_numbers (PRIVATE) ============
CREATE TABLE public.phone_line_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_number_e164 text NOT NULL,
  phone_verified boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, phone_number_e164)
);

ALTER TABLE public.phone_line_numbers ENABLE ROW LEVEL SECURITY;

-- Strict: only the owner can read or modify; no public/authenticated browse policy at all.
CREATE POLICY "Owner can read own phone number"
  ON public.phone_line_numbers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_numbers.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Owner can insert own phone number"
  ON public.phone_line_numbers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_numbers.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Owner can update own phone number"
  ON public.phone_line_numbers FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_numbers.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Owner can delete own phone number"
  ON public.phone_line_numbers FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_numbers.profile_id AND p.user_id = auth.uid()));

CREATE TRIGGER set_phone_line_numbers_updated_at
  BEFORE UPDATE ON public.phone_line_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Storage bucket: voice-greetings (private) ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-greetings', 'voice-greetings', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-folder convention: <user_id>/<filename>
CREATE POLICY "Users can read their own voice greetings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-greetings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can read voice greetings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'voice-greetings');

CREATE POLICY "Users can upload their own voice greetings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-greetings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own voice greetings"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'voice-greetings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own voice greetings"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'voice-greetings' AND auth.uid()::text = (storage.foldername(name))[1]);