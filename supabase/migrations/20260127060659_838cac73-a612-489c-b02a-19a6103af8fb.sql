-- Create referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  bonus_credits INT DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create AI chatbot conversations table
CREATE TABLE public.chatbot_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'resolved')),
  transferred_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chatbot messages table
CREATE TABLE public.chatbot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add referral_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Function to generate referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

-- Referrals policies
CREATE POLICY "Users can view their own referrals"
ON public.referrals FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = referrer_id AND profiles.user_id = auth.uid())
);

CREATE POLICY "Users can create referrals"
ON public.referrals FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = referrer_id AND profiles.user_id = auth.uid())
);

-- Chatbot policies
CREATE POLICY "Users can view own chatbot conversations"
ON public.chatbot_conversations FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create chatbot conversations"
ON public.chatbot_conversations FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chatbot conversations"
ON public.chatbot_conversations FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can view messages in their conversations"
ON public.chatbot_messages FOR SELECT
USING (
  EXISTS (SELECT 1 FROM chatbot_conversations WHERE id = conversation_id AND user_id = auth.uid())
);

CREATE POLICY "Users can create messages in their conversations"
ON public.chatbot_messages FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM chatbot_conversations WHERE id = conversation_id AND user_id = auth.uid())
);

-- Create updated_at trigger
CREATE TRIGGER update_chatbot_conversations_updated_at
BEFORE UPDATE ON public.chatbot_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();