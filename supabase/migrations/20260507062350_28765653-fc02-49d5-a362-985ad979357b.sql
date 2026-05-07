-- Donations table for Cuban donations fulfillment
CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_usd numeric(10,2) NOT NULL,
  donation_type text NOT NULL,
  phone_number text,
  recipient_name text,
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own donations" ON public.donations FOR SELECT
USING (donor_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR recipient_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage donations" ON public.donations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Idempotency: unique stripe_session_id on gift_transactions & credit_transactions
CREATE UNIQUE INDEX IF NOT EXISTS gift_transactions_stripe_session_uniq
  ON public.gift_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_stripe_session_uniq
  ON public.credit_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS boost_transactions_stripe_session_uniq
  ON public.boost_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;