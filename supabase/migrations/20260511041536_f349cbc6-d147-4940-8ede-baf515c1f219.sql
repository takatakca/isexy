-- ============ phone_line_voice_replies ============
CREATE TABLE public.phone_line_voice_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  greeting_id uuid REFERENCES public.voice_greetings(id) ON DELETE SET NULL,
  audio_url text NOT NULL,
  transcript text,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 95),
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  rejected_reason text,
  report_count integer NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_profile_id <> to_profile_id)
);

CREATE INDEX idx_voice_replies_to ON public.phone_line_voice_replies(to_profile_id, created_at DESC);
CREATE INDEX idx_voice_replies_from ON public.phone_line_voice_replies(from_profile_id, created_at DESC);

ALTER TABLE public.phone_line_voice_replies ENABLE ROW LEVEL SECURITY;

-- Sender can read own sent replies
CREATE POLICY "Sender can read own sent replies"
  ON public.phone_line_voice_replies FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_voice_replies.from_profile_id AND p.user_id = auth.uid()));

-- Receiver can read replies sent to them
CREATE POLICY "Receiver can read incoming replies"
  ON public.phone_line_voice_replies FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_voice_replies.to_profile_id AND p.user_id = auth.uid()));

-- Sender can insert their own replies
CREATE POLICY "Sender can insert own replies"
  ON public.phone_line_voice_replies FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_voice_replies.from_profile_id AND p.user_id = auth.uid()));

-- Receiver can update is_read on incoming replies (and only that semantic update)
CREATE POLICY "Receiver can mark replies as read"
  ON public.phone_line_voice_replies FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_voice_replies.to_profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_voice_replies.to_profile_id AND p.user_id = auth.uid()));

-- Sender can delete own replies (soft-control; receivers cannot delete)
CREATE POLICY "Sender can delete own replies"
  ON public.phone_line_voice_replies FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = phone_line_voice_replies.from_profile_id AND p.user_id = auth.uid()));

CREATE TRIGGER set_voice_replies_updated_at
  BEFORE UPDATE ON public.phone_line_voice_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ voice-replies storage bucket (PRIVATE) ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-replies', 'voice-replies', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-folder convention: <sender_user_id>/<filename>
CREATE POLICY "Sender can read own voice reply files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-replies' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Sender can upload own voice reply files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-replies' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Sender can update own voice reply files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'voice-replies' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Sender can delete own voice reply files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'voice-replies' AND auth.uid()::text = (storage.foldername(name))[1]);