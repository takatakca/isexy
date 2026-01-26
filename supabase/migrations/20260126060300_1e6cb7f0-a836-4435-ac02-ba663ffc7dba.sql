-- Create storage buckets for verification files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cuban-verifications', 'cuban-verifications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for cuban verifications bucket
CREATE POLICY "Users can upload their own verification files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cuban-verifications' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own verification files"
ON storage.objects FOR SELECT
USING (bucket_id = 'cuban-verifications' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all verification files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cuban-verifications' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'moderator')
  )
);

-- Add new columns to cuban_verifications for file storage
ALTER TABLE public.cuban_verifications 
ADD COLUMN IF NOT EXISTS carnet_front_url TEXT,
ADD COLUMN IF NOT EXISTS carnet_back_url TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Create translations table for storing translated messages
CREATE TABLE IF NOT EXISTS public.message_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on message_translations
ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;

-- Policies for message_translations
CREATE POLICY "Users can view translations for their messages"
ON public.message_translations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.matches mt ON m.match_id = mt.id
    JOIN public.profiles p ON p.id = mt.profile1_id OR p.id = mt.profile2_id
    WHERE m.id = message_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert translations for their messages"
ON public.message_translations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.matches mt ON m.match_id = mt.id
    JOIN public.profiles p ON p.id = mt.profile1_id OR p.id = mt.profile2_id
    WHERE m.id = message_id AND p.user_id = auth.uid()
  )
);

-- Create user_preferences table for language settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  auto_translate BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Policies for user_preferences
CREATE POLICY "Users can view their own preferences"
ON public.user_preferences FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
ON public.user_preferences FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
ON public.user_preferences FOR UPDATE
USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();