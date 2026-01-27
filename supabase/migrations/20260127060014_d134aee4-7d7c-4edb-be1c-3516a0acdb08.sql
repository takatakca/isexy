-- Create user_credits table for video chat credits system
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 0,
  lifetime_credits INTEGER NOT NULL DEFAULT 0,
  last_purchase_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit_transactions table
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'video_call', 'bonus', 'refund')),
  description TEXT,
  stripe_session_id TEXT,
  video_call_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create video_call_sessions table
CREATE TABLE public.video_call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES public.profiles(id),
  receiver_id UUID NOT NULL REFERENCES public.profiles(id),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'connecting' CHECK (status IN ('connecting', 'ringing', 'connected', 'ended', 'missed', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_chats table for Double Date group messaging
CREATE TABLE public.group_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  double_date_match_id UUID REFERENCES public.double_date_matches(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_chat_members table
CREATE TABLE public.group_chat_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (group_chat_id, profile_id)
);

-- Create group_messages table
CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_credits
CREATE POLICY "Users can view own credits"
ON public.user_credits FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_credits.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can update own credits"
ON public.user_credits FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_credits.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can insert own credits"
ON public.user_credits FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = user_credits.profile_id AND p.user_id = auth.uid()));

-- RLS policies for credit_transactions
CREATE POLICY "Users can view own transactions"
ON public.credit_transactions FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = credit_transactions.profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can insert own transactions"
ON public.credit_transactions FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = credit_transactions.profile_id AND p.user_id = auth.uid()));

-- RLS policies for video_call_sessions
CREATE POLICY "Users can view their call sessions"
ON public.video_call_sessions FOR SELECT
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = video_call_sessions.caller_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = video_call_sessions.receiver_id AND p.user_id = auth.uid())
);

CREATE POLICY "Users can insert call sessions"
ON public.video_call_sessions FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = video_call_sessions.caller_id AND p.user_id = auth.uid()));

CREATE POLICY "Users can update their call sessions"
ON public.video_call_sessions FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = video_call_sessions.caller_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = video_call_sessions.receiver_id AND p.user_id = auth.uid())
);

-- RLS policies for group_chats
CREATE POLICY "Members can view group chats"
ON public.group_chats FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_chat_members gcm
    JOIN profiles p ON p.id = gcm.profile_id
    WHERE gcm.group_chat_id = group_chats.id AND p.user_id = auth.uid()
  )
);

-- RLS policies for group_chat_members
CREATE POLICY "Members can view group members"
ON public.group_chat_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_chat_members gcm2
    JOIN profiles p ON p.id = gcm2.profile_id
    WHERE gcm2.group_chat_id = group_chat_members.group_chat_id AND p.user_id = auth.uid()
  )
);

-- RLS policies for group_messages
CREATE POLICY "Members can view group messages"
ON public.group_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_chat_members gcm
    JOIN profiles p ON p.id = gcm.profile_id
    WHERE gcm.group_chat_id = group_messages.group_chat_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send group messages"
ON public.group_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_chat_members gcm
    JOIN profiles p ON p.id = gcm.profile_id
    WHERE gcm.group_chat_id = group_messages.group_chat_id AND p.user_id = auth.uid()
  )
);

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- Create triggers for updated_at
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_chats_updated_at
BEFORE UPDATE ON public.group_chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();