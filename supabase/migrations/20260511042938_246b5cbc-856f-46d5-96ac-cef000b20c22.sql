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
  v_elapsed int;
  v_allowed int;
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

  IF v_session.status IN ('completed','canceled','missed','declined','failed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_session.status);
  END IF;

  IF v_session.status <> 'connected' OR v_session.answered_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_connected', 'status', v_session.status);
  END IF;

  -- Server-side time gate: how many minutes are owed at most right now?
  v_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_session.answered_at))::int);
  -- First minute is owed immediately, then one per 60s.
  v_allowed := GREATEST(1, (v_elapsed / 60) + 1);

  SELECT * INTO v_credits FROM user_credits WHERE profile_id = v_caller.id FOR UPDATE;
  IF v_credits.profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_wallet', 'remaining', 0);
  END IF;

  IF v_session.minutes_charged >= v_allowed THEN
    RETURN jsonb_build_object(
      'success', true,
      'charged', false,
      'reason', 'not_due_yet',
      'remaining', COALESCE(v_credits.phone_minutes, 0)
    );
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

  RETURN jsonb_build_object('success', true, 'charged', true, 'remaining', v_after);
END;
$$;