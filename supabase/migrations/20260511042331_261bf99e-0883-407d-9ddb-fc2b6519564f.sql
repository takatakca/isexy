-- ============= TABLES =============
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid,
  caller_profile_id uuid NOT NULL,
  receiver_profile_id uuid,
  phone_line_profile_id uuid,
  phone_line_room_id uuid,
  call_type text NOT NULL CHECK (call_type IN (
    'app_phone','app_video','phone_line_profile','phone_line_room','pstn_masked','phone_line_menu'
  )),
  provider text NOT NULL DEFAULT 'in_app' CHECK (provider IN ('in_app','twilio')),
  provider_call_sid text,
  provider_parent_call_sid text,
  provider_child_call_sid text,
  status text NOT NULL DEFAULT 'initiating' CHECK (status IN (
    'initiating','ringing','connected','completed','missed','declined','failed','canceled'
  )),
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0,
  minutes_charged integer NOT NULL DEFAULT 0,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_caller ON public.call_sessions(caller_profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_receiver ON public.call_sessions(receiver_profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON public.call_sessions(status);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read their call sessions"
ON public.call_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()
          AND (p.id = call_sessions.caller_profile_id OR p.id = call_sessions.receiver_profile_id))
);

CREATE POLICY "Admins can read all call sessions"
ON public.call_sessions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies — only SECURITY DEFINER RPCs may write.

CREATE TRIGGER trg_call_sessions_updated_at
BEFORE UPDATE ON public.call_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.call_minute_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  call_session_id uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  call_type text NOT NULL,
  minutes_charged integer NOT NULL DEFAULT 1,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cmt_profile ON public.call_minute_transactions(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmt_session ON public.call_minute_transactions(call_session_id);

ALTER TABLE public.call_minute_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their minute transactions"
ON public.call_minute_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.id = call_minute_transactions.profile_id)
);

CREATE POLICY "Admins can read all minute transactions"
ON public.call_minute_transactions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============= RPCs =============

CREATE OR REPLACE FUNCTION public.start_phone_line_call_session(
  p_target_profile_id uuid,
  p_call_type text DEFAULT 'phone_line_profile'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller profiles%ROWTYPE;
  v_target profiles%ROWTYPE;
  v_pl phone_line_profiles%ROWTYPE;
  v_credits user_credits%ROWTYPE;
  v_blocked int;
  v_session_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_call_type <> 'phone_line_profile' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unsupported_call_type');
  END IF;

  SELECT * INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;

  IF v_caller.id = p_target_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_call_self');
  END IF;

  -- Caller must be 18+ and have minimum profile completeness
  IF v_caller.age IS NULL OR v_caller.age < 18 THEN
    RETURN jsonb_build_object('success', false, 'error', 'age_restricted');
  END IF;
  IF v_caller.first_name IS NULL OR length(trim(v_caller.first_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'incomplete_profile');
  END IF;

  SELECT * INTO v_target FROM profiles WHERE id = p_target_profile_id;
  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_not_found');
  END IF;

  -- Find target's active public phone-line profile
  SELECT * INTO v_pl FROM phone_line_profiles
  WHERE profile_id = p_target_profile_id
    AND status = 'active'
    AND is_public = true
  LIMIT 1;
  IF v_pl.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'voice_profile_unavailable');
  END IF;

  -- Block check (either direction)
  SELECT COUNT(*) INTO v_blocked FROM blocks
  WHERE (blocker_id = v_caller.id AND blocked_id = p_target_profile_id)
     OR (blocker_id = p_target_profile_id AND blocked_id = v_caller.id);
  IF v_blocked > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'blocked');
  END IF;

  -- Check phone minutes (premium bypass not granted; phone minutes are pay-as-you-go)
  SELECT * INTO v_credits FROM user_credits WHERE profile_id = v_caller.id;
  IF v_credits.profile_id IS NULL OR COALESCE(v_credits.phone_minutes, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'phone_minutes', 0);
  END IF;

  INSERT INTO call_sessions (
    caller_profile_id, receiver_profile_id, phone_line_profile_id,
    call_type, provider, status, started_at, answered_at
  ) VALUES (
    v_caller.id, p_target_profile_id, v_pl.id,
    'phone_line_profile', 'in_app', 'connected', now(), now()
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'call_session_id', v_session_id,
    'phone_minutes', v_credits.phone_minutes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_call_session_minute(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller profiles%ROWTYPE;
  v_session call_sessions%ROWTYPE;
  v_credits user_credits%ROWTYPE;
  v_before int;
  v_after int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_session FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  IF v_session.caller_profile_id <> v_caller.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  IF v_session.status <> 'connected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_connected', 'status', v_session.status);
  END IF;

  SELECT * INTO v_credits FROM user_credits WHERE profile_id = v_caller.id FOR UPDATE;
  IF v_credits.profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_wallet', 'remaining', 0);
  END IF;

  v_before := COALESCE(v_credits.phone_minutes, 0);
  IF v_before <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
  END IF;

  v_after := v_before - 1;

  UPDATE user_credits SET phone_minutes = v_after, updated_at = now()
   WHERE profile_id = v_caller.id;

  UPDATE call_sessions
     SET minutes_charged = minutes_charged + 1, updated_at = now()
   WHERE id = p_call_session_id;

  INSERT INTO call_minute_transactions
    (profile_id, call_session_id, call_type, minutes_charged, balance_before, balance_after)
  VALUES
    (v_caller.id, p_call_session_id, v_session.call_type, 1, v_before, v_after);

  INSERT INTO credit_transactions (profile_id, amount, type, category, description)
  VALUES (v_caller.id, -1, 'spend', v_session.call_type, v_session.call_type || ' minute');

  RETURN jsonb_build_object('success', true, 'remaining', v_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.end_call_session(
  p_call_session_id uuid,
  p_end_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_profile uuid;
  v_session call_sessions%ROWTYPE;
  v_new_status text;
  v_duration int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_user_profile FROM profiles WHERE user_id = auth.uid();
  IF v_user_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_session FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  IF v_session.caller_profile_id <> v_user_profile AND COALESCE(v_session.receiver_profile_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_user_profile THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  IF v_session.status IN ('completed','canceled','failed','missed','declined') THEN
    RETURN jsonb_build_object('success', true, 'already_ended', true, 'status', v_session.status);
  END IF;

  IF v_session.status = 'connected' THEN
    v_new_status := 'completed';
  ELSIF p_end_reason = 'failed' THEN
    v_new_status := 'failed';
  ELSE
    v_new_status := 'canceled';
  END IF;

  v_duration := GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(v_session.answered_at, v_session.started_at)))::int);

  UPDATE call_sessions
     SET status = v_new_status,
         ended_at = now(),
         duration_seconds = v_duration,
         end_reason = COALESCE(p_end_reason, end_reason),
         updated_at = now()
   WHERE id = p_call_session_id;

  RETURN jsonb_build_object('success', true, 'status', v_new_status, 'duration_seconds', v_duration);
END;
$$;