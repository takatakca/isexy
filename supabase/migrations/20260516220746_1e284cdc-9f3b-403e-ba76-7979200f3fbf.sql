-- Phone line inbound call logs for unknown/unverified callers.
-- Stores hashed caller identifier and call metadata; no raw phone numbers.
CREATE TABLE IF NOT EXISTS public.phone_line_inbound_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text,
  caller_hash text,
  caller_masked text,
  call_status text NOT NULL DEFAULT 'unknown_caller',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.phone_line_inbound_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read inbound call logs"
ON public.phone_line_inbound_call_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_phone_line_inbound_call_logs_created_at
  ON public.phone_line_inbound_call_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_line_inbound_call_logs_call_sid
  ON public.phone_line_inbound_call_logs (call_sid);