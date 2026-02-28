
-- Add phone and video minute balances to user_credits
ALTER TABLE public.user_credits 
  ADD COLUMN IF NOT EXISTS phone_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_minutes INTEGER NOT NULL DEFAULT 0;

-- Add category column to credit_transactions for phone/video/chat tracking
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Create chat_subscriptions table for chat-specific subscriptions
CREATE TABLE IF NOT EXISTS public.chat_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_months INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat subscriptions" ON public.chat_subscriptions
  FOR SELECT USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Update unlock_conversation to check chat subscription instead of credits for chat
CREATE OR REPLACE FUNCTION public.unlock_conversation(
  p_profile_id UUID,
  p_match_id UUID,
  p_unlock_type TEXT DEFAULT 'chat'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_existing UUID;
  v_credits_row user_credits%ROWTYPE;
  v_chat_sub chat_subscriptions%ROWTYPE;
BEGIN
  -- Check existing unlock
  SELECT id INTO v_existing FROM conversation_unlocks
  WHERE match_id = p_match_id AND unlocked_by = p_profile_id AND unlock_type = p_unlock_type;
  
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_unlocked', true);
  END IF;

  -- Verify the user is part of this match
  IF NOT EXISTS (
    SELECT 1 FROM matches 
    WHERE id = p_match_id 
    AND (profile1_id = p_profile_id OR profile2_id = p_profile_id)
    AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid match');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;

  -- CHAT: requires subscription (or premium)
  IF p_unlock_type = 'chat' THEN
    IF COALESCE(v_profile.is_premium, false) = true THEN
      INSERT INTO conversation_unlocks (match_id, unlocked_by, unlock_type, credits_spent)
      VALUES (p_match_id, p_profile_id, p_unlock_type, 0);
      RETURN jsonb_build_object('success', true, 'credits_spent', 0);
    END IF;

    -- Check active chat subscription
    SELECT * INTO v_chat_sub FROM chat_subscriptions
    WHERE profile_id = p_profile_id AND status = 'active' AND expires_at > now()
    ORDER BY expires_at DESC LIMIT 1;

    IF v_chat_sub.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_chat_subscription');
    END IF;

    INSERT INTO conversation_unlocks (match_id, unlocked_by, unlock_type, credits_spent)
    VALUES (p_match_id, p_profile_id, p_unlock_type, 0);
    RETURN jsonb_build_object('success', true, 'credits_spent', 0);
  END IF;

  -- VIDEO / PHONE: requires minute balance
  IF p_unlock_type IN ('video', 'phone') THEN
    IF COALESCE(v_profile.is_premium, false) = true THEN
      INSERT INTO conversation_unlocks (match_id, unlocked_by, unlock_type, credits_spent)
      VALUES (p_match_id, p_profile_id, p_unlock_type, 0);
      RETURN jsonb_build_object('success', true, 'credits_spent', 0);
    END IF;

    SELECT * INTO v_credits_row FROM user_credits WHERE profile_id = p_profile_id FOR UPDATE;

    IF v_credits_row IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'type', p_unlock_type);
    END IF;

    IF p_unlock_type = 'video' AND v_credits_row.video_minutes <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'type', 'video', 'balance', v_credits_row.video_minutes);
    END IF;

    IF p_unlock_type = 'phone' AND v_credits_row.phone_minutes <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'type', 'phone', 'balance', v_credits_row.phone_minutes);
    END IF;

    -- Don't deduct minutes at unlock — deduct per-minute during the call
    INSERT INTO conversation_unlocks (match_id, unlocked_by, unlock_type, credits_spent)
    VALUES (p_match_id, p_profile_id, p_unlock_type, 0);

    RETURN jsonb_build_object('success', true, 'credits_spent', 0,
      'video_minutes', v_credits_row.video_minutes,
      'phone_minutes', v_credits_row.phone_minutes);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Invalid unlock type');
END;
$$;

-- Function to deduct call minutes (called per minute during active call)
CREATE OR REPLACE FUNCTION public.deduct_call_minute(
  p_profile_id UUID,
  p_call_type TEXT -- 'phone' or 'video'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_credits user_credits%ROWTYPE;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_credits FROM user_credits WHERE profile_id = p_profile_id FOR UPDATE;
  
  IF v_credits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_wallet', 'remaining', 0);
  END IF;

  IF p_call_type = 'video' THEN
    IF v_credits.video_minutes <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
    END IF;
    UPDATE user_credits SET video_minutes = video_minutes - 1, updated_at = now()
    WHERE profile_id = p_profile_id;
    v_remaining := v_credits.video_minutes - 1;
  ELSIF p_call_type = 'phone' THEN
    IF v_credits.phone_minutes <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
    END IF;
    UPDATE user_credits SET phone_minutes = phone_minutes - 1, updated_at = now()
    WHERE profile_id = p_profile_id;
    v_remaining := v_credits.phone_minutes - 1;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_type');
  END IF;

  INSERT INTO credit_transactions (profile_id, amount, type, category, description)
  VALUES (p_profile_id, -1, 'spend', p_call_type, p_call_type || ' call minute');

  RETURN jsonb_build_object('success', true, 'remaining', v_remaining);
END;
$$;
