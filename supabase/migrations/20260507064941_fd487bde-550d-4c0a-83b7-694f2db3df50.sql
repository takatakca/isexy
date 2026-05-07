CREATE TABLE public.stripe_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  stripe_session_id TEXT,
  processing_status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_stripe_webhook_events_session ON public.stripe_webhook_events(stripe_session_id);
CREATE INDEX idx_stripe_webhook_events_status ON public.stripe_webhook_events(processing_status);
CREATE INDEX idx_stripe_webhook_events_created ON public.stripe_webhook_events(created_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
ON public.stripe_webhook_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
