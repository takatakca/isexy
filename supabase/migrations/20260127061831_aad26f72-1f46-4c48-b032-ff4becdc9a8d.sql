-- Create push_subscriptions table if not exists
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS on push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

-- Insert more knowledge base articles if they don't exist
INSERT INTO public.knowledge_base (title, content, category, tags) 
SELECT 'Refund Policy', 'Refund eligibility:\n\n- Subscriptions can be cancelled anytime\n- Refunds available within 14 days of purchase\n- Unused credits are refundable\n- Contact support for refund requests\n\nProcessing time: 5-10 business days', 'Billing', ARRAY['refund', 'payment', 'cancel']
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base WHERE title = 'Refund Policy');

INSERT INTO public.knowledge_base (title, content, category, tags)
SELECT 'Account Recovery', 'Lost access to your account?\n\n1. **Forgot Password** - Use the reset link on login\n2. **Email not receiving** - Check spam folder\n3. **Phone number changed** - Contact support with ID\n4. **Account locked** - Wait 24 hours or contact support', 'Account', ARRAY['password', 'recovery', 'login']
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base WHERE title = 'Account Recovery');