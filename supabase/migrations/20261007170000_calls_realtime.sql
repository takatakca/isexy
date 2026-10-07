-- Make in-app calling work end to end.
--
-- IncomingCallNotification listens for INSERTs on video_call_sessions over
-- Realtime, but the table was never added to the supabase_realtime
-- publication, so receivers never saw an incoming call. The caller also needs
-- UPDATE events to learn that a call was declined.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'video_call_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.video_call_sessions;
  END IF;
END;
$$;

-- Phone vs video, so the receiver answers with the right media.
ALTER TABLE public.video_call_sessions
  ADD COLUMN IF NOT EXISTS call_type TEXT NOT NULL DEFAULT 'video';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_call_sessions_call_type_check') THEN
    ALTER TABLE public.video_call_sessions
      ADD CONSTRAINT video_call_sessions_call_type_check CHECK (call_type IN ('video', 'phone'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS video_call_sessions_receiver_status_idx
  ON public.video_call_sessions (receiver_id, status, created_at DESC);

-- Only ring someone you're actually matched with (the insert policy only
-- checked that the caller was yourself, so any member could ring anyone).
DROP POLICY IF EXISTS "Users can insert call sessions" ON public.video_call_sessions;
CREATE POLICY "Users can insert call sessions"
ON public.video_call_sessions FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = video_call_sessions.caller_id AND p.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = video_call_sessions.match_id
      AND m.is_active = true
      AND (
        (m.profile1_id = video_call_sessions.caller_id AND m.profile2_id = video_call_sessions.receiver_id)
        OR (m.profile2_id = video_call_sessions.caller_id AND m.profile1_id = video_call_sessions.receiver_id)
      )
  )
);
