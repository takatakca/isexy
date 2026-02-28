
-- Conversation unlock tracking table
CREATE TABLE public.conversation_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  unlocked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unlock_type TEXT NOT NULL DEFAULT 'chat',
  credits_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, unlocked_by, unlock_type)
);

-- RLS
ALTER TABLE public.conversation_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own unlocks" ON public.conversation_unlocks
  FOR SELECT USING (
    unlocked_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view unlocks for their matches" ON public.conversation_unlocks
  FOR SELECT USING (
    match_id IN (
      SELECT id FROM matches 
      WHERE profile1_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
         OR profile2_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Server-side function to unlock a conversation (deducts credits atomically)
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
  v_cost INTEGER;
  v_credits_row user_credits%ROWTYPE;
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

  -- Check if premium (free unlock)
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;
  IF COALESCE(v_profile.is_premium, false) = true THEN
    INSERT INTO conversation_unlocks (match_id, unlocked_by, unlock_type, credits_spent)
    VALUES (p_match_id, p_profile_id, p_unlock_type, 0);
    RETURN jsonb_build_object('success', true, 'credits_spent', 0);
  END IF;

  -- Set cost based on type
  v_cost := CASE p_unlock_type
    WHEN 'chat' THEN 5
    WHEN 'video' THEN 10
    WHEN 'phone' THEN 10
    ELSE 5
  END;

  -- Check credits
  SELECT * INTO v_credits_row FROM user_credits WHERE profile_id = p_profile_id FOR UPDATE;
  
  IF v_credits_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_credits', 'cost', v_cost, 'balance', 0);
  END IF;

  IF v_credits_row.credits < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_credits', 'cost', v_cost, 'balance', v_credits_row.credits);
  END IF;

  -- Deduct credits atomically
  UPDATE user_credits SET credits = credits - v_cost, updated_at = now()
  WHERE profile_id = p_profile_id;

  -- Record transaction
  INSERT INTO credit_transactions (profile_id, amount, type, description)
  VALUES (p_profile_id, -v_cost, 'spend', p_unlock_type || ' unlock for match ' || p_match_id);

  -- Create unlock
  INSERT INTO conversation_unlocks (match_id, unlocked_by, unlock_type, credits_spent)
  VALUES (p_match_id, p_profile_id, p_unlock_type, v_cost);

  RETURN jsonb_build_object('success', true, 'credits_spent', v_cost, 
    'credits_remaining', v_credits_row.credits - v_cost);
END;
$$;
