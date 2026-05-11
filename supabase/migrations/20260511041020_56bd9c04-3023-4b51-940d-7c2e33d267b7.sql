DROP POLICY IF EXISTS "Authenticated users can read voice greetings" ON storage.objects;

ALTER TABLE public.voice_greetings
  ALTER COLUMN moderation_status SET DEFAULT 'pending';