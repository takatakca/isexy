-- ISEXY calls area (branch wf/calls). Apply after 0001-0003 as part of the next
-- isexy migration. Idempotent: running it twice changes nothing. Deletes no
-- data. Every function: SECURITY DEFINER, SET search_path = isexy, extensions,
-- checks auth.uid(); EXECUTE for authenticated only.
--
-- Deploy together with the wf/calls client: VideoCall, IncomingCallNotification
-- and PhoneLineCall call these RPCs instead of writing the call tables.

-- ============================================================================
-- 1. Wallet: credit_transactions.type must accept 'spend'
-- ----------------------------------------------------------------------------
-- deduct_call_minute, charge_call_session_minute and unlock_conversation insert
-- type 'spend', but the CHECK only allows purchase/video_call/bonus/refund, so
-- all three fail at runtime (every connected call was cut off with "out of
-- minutes"). Widen the CHECK, keeping any value another migration added.
-- ============================================================================
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'isexy.credit_transactions'::regclass
     AND conname = 'credit_transactions_type_check';
  IF v_def IS NOT NULL AND position('''spend''' IN v_def) = 0 AND position('ARRAY[' IN v_def) > 0 THEN
    ALTER TABLE isexy.credit_transactions DROP CONSTRAINT credit_transactions_type_check;
    EXECUTE 'ALTER TABLE isexy.credit_transactions ADD CONSTRAINT credit_transactions_type_check '
         || replace(v_def, 'ARRAY[', 'ARRAY[''spend''::text, ');
  END IF;
END;
$$;

-- ============================================================================
-- 2. In-app calls (video_call_sessions): lifecycle RPCs, server-side billing
-- ----------------------------------------------------------------------------
-- Before: the caller INSERTed/UPDATEd the row itself (status, duration,
-- credits_used) and called deduct_call_minute every 60 s; skipping that call
-- meant free calls. Now the server stamps connected_at, time-gates each
-- minute (first minute at connect, then one per 60 s) and settles whatever is
-- still owed when either side ends the call.
-- ============================================================================
ALTER TABLE isexy.video_call_sessions
  ADD COLUMN IF NOT EXISTS connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_reason text;

CREATE INDEX IF NOT EXISTS video_call_sessions_caller_created_idx
  ON isexy.video_call_sessions (caller_id, created_at DESC);

-- start_call: ring the other member of an active match.
CREATE OR REPLACE FUNCTION isexy.start_call(p_match_id uuid, p_call_type text DEFAULT 'video')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_match matches%ROWTYPE;
  v_other uuid;
  v_balance int;
  v_recent int;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_call_type IS NULL OR p_call_type NOT IN ('video', 'phone') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_type');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match.id IS NULL OR v_match.is_active IS NOT TRUE
     OR v_me NOT IN (v_match.profile1_id, v_match.profile2_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_unavailable');
  END IF;
  v_other := CASE WHEN v_match.profile1_id = v_me THEN v_match.profile2_id ELSE v_match.profile1_id END;

  IF EXISTS (SELECT 1 FROM blocks
              WHERE (blocker_id = v_me AND blocked_id = v_other)
                 OR (blocker_id = v_other AND blocked_id = v_me)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unavailable');
  END IF;

  -- No ringing someone over and over.
  SELECT count(*) INTO v_recent FROM video_call_sessions
   WHERE caller_id = v_me AND created_at > now() - interval '2 minutes';
  IF v_recent >= 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_calls');
  END IF;

  INSERT INTO user_credits (profile_id) VALUES (v_me) ON CONFLICT (profile_id) DO NOTHING;
  SELECT CASE WHEN p_call_type = 'video' THEN video_minutes ELSE phone_minutes END
    INTO v_balance FROM user_credits WHERE profile_id = v_me;
  IF COALESCE(v_balance, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
  END IF;

  -- One ringing call at a time: an older unanswered call of mine stops ringing.
  UPDATE video_call_sessions
     SET status = 'ended', ended_at = now(), end_reason = 'superseded'
   WHERE match_id = p_match_id AND caller_id = v_me AND status IN ('ringing', 'connecting');

  INSERT INTO video_call_sessions (match_id, caller_id, receiver_id, status, call_type, started_at)
  VALUES (p_match_id, v_me, v_other, 'ringing', p_call_type, now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'call_session_id', v_id,
                            'remaining', v_balance, 'receiver_id', v_other);
END;
$$;

-- answer_call: the receiver picks up (ringing -> connecting).
CREATE OR REPLACE FUNCTION isexy.answer_call(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.receiver_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  -- A ringing call (or a connected one the receiver rejoins after a reload).
  IF NOT ((v_s.status IN ('ringing', 'connecting') AND v_s.created_at > now() - interval '3 minutes')
          OR v_s.status = 'connected')
     OR NOT EXISTS (SELECT 1 FROM matches m WHERE m.id = v_s.match_id AND m.is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  IF v_s.status <> 'connected' THEN
    UPDATE video_call_sessions SET status = 'connecting' WHERE id = p_call_session_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'match_id', v_s.match_id, 'caller_id', v_s.caller_id,
                            'call_type', v_s.call_type, 'status', v_s.status);
END;
$$;

-- decline_call: the receiver says no (the caller's screen shows it at once).
CREATE OR REPLACE FUNCTION isexy.decline_call(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.receiver_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status NOT IN ('ringing', 'connecting') THEN
    RETURN jsonb_build_object('success', true, 'already_ended', true, 'status', v_s.status);
  END IF;
  UPDATE video_call_sessions
     SET status = 'declined', ended_at = now(), end_reason = 'declined'
   WHERE id = p_call_session_id;
  RETURN jsonb_build_object('success', true, 'status', 'declined');
END;
$$;

-- mark_call_connected: media is flowing (either side). Billing starts here.
CREATE OR REPLACE FUNCTION isexy.mark_call_connected(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_me NOT IN (v_s.caller_id, v_s.receiver_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  -- Only after the receiver answered (connecting) or again after a reconnect.
  IF v_s.status NOT IN ('connecting', 'connected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  UPDATE video_call_sessions
     SET status = 'connected', connected_at = COALESCE(connected_at, now())
   WHERE id = p_call_session_id
  RETURNING connected_at INTO v_s.connected_at;
  RETURN jsonb_build_object('success', true, 'connected_at', v_s.connected_at);
END;
$$;

-- charge_call_minute: the caller pays one minute when it is due (server clock).
CREATE OR REPLACE FUNCTION isexy.charge_call_minute(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
  v_allowed int;
  v_balance int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.caller_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status <> 'connected' OR v_s.connected_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;

  -- First minute is owed at connect, then one more every 60 s.
  v_allowed := floor(extract(epoch FROM (now() - v_s.connected_at)) / 60)::int + 1;

  SELECT CASE WHEN v_s.call_type = 'phone' THEN phone_minutes ELSE video_minutes END
    INTO v_balance FROM user_credits WHERE profile_id = v_me FOR UPDATE;
  v_balance := COALESCE(v_balance, 0);

  IF COALESCE(v_s.credits_used, 0) >= v_allowed THEN
    RETURN jsonb_build_object('success', true, 'charged', false, 'remaining', v_balance);
  END IF;
  IF v_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
  END IF;

  IF v_s.call_type = 'phone' THEN
    UPDATE user_credits SET phone_minutes = phone_minutes - 1, updated_at = now() WHERE profile_id = v_me;
  ELSE
    UPDATE user_credits SET video_minutes = video_minutes - 1, updated_at = now() WHERE profile_id = v_me;
  END IF;
  UPDATE video_call_sessions SET credits_used = COALESCE(credits_used, 0) + 1 WHERE id = p_call_session_id;
  INSERT INTO credit_transactions (profile_id, amount, type, category, description, video_call_id)
  VALUES (v_me, -1, 'video_call', v_s.call_type,
          CASE WHEN v_s.call_type = 'phone' THEN 'Phone call minute' ELSE 'Video call minute' END,
          v_s.id);

  RETURN jsonb_build_object('success', true, 'charged', true, 'remaining', v_balance - 1);
END;
$$;

-- end_call: either side hangs up. Duration comes from the server clock; any
-- minute still owed is taken from the caller's balance (never below zero).
CREATE OR REPLACE FUNCTION isexy.end_call(p_call_session_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
  v_status text;
  v_duration int := 0;
  v_due int;
  v_balance int;
  v_take int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_me NOT IN (v_s.caller_id, v_s.receiver_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status IN ('ended', 'missed', 'declined') THEN
    RETURN jsonb_build_object('success', true, 'already_ended', true, 'status', v_s.status,
                              'duration_seconds', v_s.duration_seconds, 'credits_used', v_s.credits_used);
  END IF;

  IF v_s.status = 'connected' AND v_s.connected_at IS NOT NULL THEN
    v_status := 'ended';
    v_duration := GREATEST(0, floor(extract(epoch FROM (now() - v_s.connected_at))))::int;
    v_due := GREATEST(1, ceil(v_duration / 60.0)::int) - COALESCE(v_s.credits_used, 0);
    IF v_due > 0 THEN
      SELECT CASE WHEN v_s.call_type = 'phone' THEN phone_minutes ELSE video_minutes END
        INTO v_balance FROM user_credits WHERE profile_id = v_s.caller_id FOR UPDATE;
      v_take := LEAST(v_due, GREATEST(COALESCE(v_balance, 0), 0));
      IF v_take > 0 THEN
        IF v_s.call_type = 'phone' THEN
          UPDATE user_credits SET phone_minutes = phone_minutes - v_take, updated_at = now() WHERE profile_id = v_s.caller_id;
        ELSE
          UPDATE user_credits SET video_minutes = video_minutes - v_take, updated_at = now() WHERE profile_id = v_s.caller_id;
        END IF;
        INSERT INTO credit_transactions (profile_id, amount, type, category, description, video_call_id)
        VALUES (v_s.caller_id, -v_take, 'video_call', v_s.call_type,
                CASE WHEN v_s.call_type = 'phone' THEN 'Phone call minutes (end of call)' ELSE 'Video call minutes (end of call)' END,
                v_s.id);
      END IF;
    END IF;
  ELSIF v_me = v_s.receiver_id THEN
    v_status := 'declined';
  ELSE
    v_status := 'ended';
  END IF;

  UPDATE video_call_sessions
     SET status = v_status,
         ended_at = now(),
         duration_seconds = v_duration,
         credits_used = COALESCE(credits_used, 0) + v_take,
         end_reason = COALESCE(left(nullif(trim(p_reason), ''), 40), end_reason)
   WHERE id = p_call_session_id;

  RETURN jsonb_build_object('success', true, 'status', v_status, 'duration_seconds', v_duration,
                            'credits_used', COALESCE(v_s.credits_used, 0) + v_take);
END;
$$;

-- ============================================================================
-- 3. Missed calls: recorded by the caller through an RPC, once per call
-- ----------------------------------------------------------------------------
-- Only the caller of a call that is still ringing (rang at least 15 s, so it
-- cannot be used to spam), to the other member of an active match. One row
-- per call session (unique index; the missed-call edge function's own insert
-- then fails harmlessly and it still sends the email/push).
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM isexy.missed_calls
     WHERE call_session_id IS NOT NULL
     GROUP BY call_session_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS missed_calls_call_session_uniq
      ON isexy.missed_calls (call_session_id) WHERE call_session_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'missed_calls has duplicate call_session_id rows; unique index not created';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION isexy.record_missed_call(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s video_call_sessions%ROWTYPE;
  v_missed uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM video_call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.caller_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM matches m
     WHERE m.id = v_s.match_id AND m.is_active = true
       AND ((m.profile1_id = v_s.caller_id AND m.profile2_id = v_s.receiver_id)
         OR (m.profile2_id = v_s.caller_id AND m.profile1_id = v_s.receiver_id))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_unavailable');
  END IF;

  IF v_s.status = 'missed' THEN
    SELECT id INTO v_missed FROM missed_calls WHERE call_session_id = v_s.id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'already_recorded', true, 'missed_call_id', v_missed);
  END IF;
  IF v_s.status <> 'ringing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_ringing', 'status', v_s.status);
  END IF;
  IF v_s.created_at > now() - interval '15 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_early');
  END IF;

  UPDATE video_call_sessions
     SET status = 'missed', ended_at = now(), end_reason = 'no_answer'
   WHERE id = v_s.id;

  SELECT id INTO v_missed FROM missed_calls WHERE call_session_id = v_s.id LIMIT 1;
  IF v_missed IS NULL THEN
    INSERT INTO missed_calls (call_session_id, caller_id, receiver_id, match_id)
    VALUES (v_s.id, v_s.caller_id, v_s.receiver_id, v_s.match_id)
    RETURNING id INTO v_missed;
  END IF;

  RETURN jsonb_build_object('success', true, 'missed_call_id', v_missed);
END;
$$;

REVOKE ALL ON FUNCTION isexy.start_call(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.answer_call(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.decline_call(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.mark_call_connected(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.charge_call_minute(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.end_call(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.record_missed_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.start_call(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.answer_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.decline_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.mark_call_connected(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.charge_call_minute(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.end_call(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.record_missed_call(uuid) TO authenticated;

-- ============================================================================
-- 4. Phone Line calls (call_sessions, provider 'in_app')
-- ----------------------------------------------------------------------------
-- start_phone_line_call_session read profiles.age (no such column: every call
-- failed) and created the session 'connected' at once, so the caller was
-- charged per minute for a call nobody received. Now it rings; the receiver
-- answers or declines; billing starts when media connects (either side
-- reports it) and end_call_session settles unpaid minutes.
-- ============================================================================
CREATE OR REPLACE FUNCTION isexy.start_phone_line_call_session(
  p_target_profile_id uuid,
  p_call_type text DEFAULT 'phone_line_profile'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_caller profiles%ROWTYPE;
  v_pl phone_line_profiles%ROWTYPE;
  v_balance int;
  v_recent int;
  v_session_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_call_type IS DISTINCT FROM 'phone_line_profile' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unsupported_call_type');
  END IF;
  SELECT * INTO v_caller FROM profiles WHERE user_id = auth.uid();
  IF v_caller.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  IF v_caller.id = p_target_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_call_self');
  END IF;
  -- 18+ from the birth date (profiles has no age column).
  IF v_caller.birth_date IS NULL OR v_caller.birth_date > (current_date - interval '18 years')::date THEN
    RETURN jsonb_build_object('success', false, 'error', 'age_restricted');
  END IF;
  IF v_caller.first_name IS NULL OR length(trim(v_caller.first_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'incomplete_profile');
  END IF;

  SELECT * INTO v_pl FROM phone_line_profiles
   WHERE profile_id = p_target_profile_id AND status = 'active' AND is_public = true
   LIMIT 1;
  IF v_pl.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'voice_profile_unavailable');
  END IF;

  IF EXISTS (SELECT 1 FROM blocks
              WHERE (blocker_id = v_caller.id AND blocked_id = p_target_profile_id)
                 OR (blocker_id = p_target_profile_id AND blocked_id = v_caller.id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'blocked');
  END IF;

  SELECT count(*) INTO v_recent FROM call_sessions
   WHERE caller_profile_id = v_caller.id AND created_at > now() - interval '2 minutes';
  IF v_recent >= 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_calls');
  END IF;

  -- Phone minutes are pay-as-you-go (no premium bypass).
  INSERT INTO user_credits (profile_id) VALUES (v_caller.id) ON CONFLICT (profile_id) DO NOTHING;
  SELECT phone_minutes INTO v_balance FROM user_credits WHERE profile_id = v_caller.id;
  IF COALESCE(v_balance, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'phone_minutes', 0);
  END IF;

  -- One ringing call at a time.
  UPDATE call_sessions
     SET status = 'canceled', ended_at = now(), end_reason = 'superseded'
   WHERE caller_profile_id = v_caller.id AND call_type = 'phone_line_profile'
     AND status IN ('initiating', 'ringing');

  INSERT INTO call_sessions (
    caller_profile_id, receiver_profile_id, phone_line_profile_id,
    call_type, provider, status, started_at
  ) VALUES (
    v_caller.id, p_target_profile_id, v_pl.id,
    'phone_line_profile', 'in_app', 'ringing', now()
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('success', true, 'call_session_id', v_session_id,
                            'phone_minutes', v_balance, 'display_name', v_pl.display_name);
END;
$$;

-- answer_call_session: the receiver picks up (or rejoins a connected call).
CREATE OR REPLACE FUNCTION isexy.answer_call_session(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
  v_caller_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.provider <> 'in_app' OR v_s.receiver_profile_id IS DISTINCT FROM v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF NOT ((v_s.status IN ('initiating', 'ringing') AND v_s.started_at > now() - interval '3 minutes')
          OR v_s.status = 'connected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  IF EXISTS (SELECT 1 FROM blocks
              WHERE (blocker_id = v_me AND blocked_id = v_s.caller_profile_id)
                 OR (blocker_id = v_s.caller_profile_id AND blocked_id = v_me)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active');
  END IF;
  SELECT first_name INTO v_caller_name FROM profiles WHERE id = v_s.caller_profile_id;
  RETURN jsonb_build_object('success', true, 'status', v_s.status, 'caller_profile_id', v_s.caller_profile_id,
                            'caller_name', v_caller_name, 'call_type', v_s.call_type);
END;
$$;

-- decline_call_session: the receiver says no.
CREATE OR REPLACE FUNCTION isexy.decline_call_session(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.provider <> 'in_app' OR v_s.receiver_profile_id IS DISTINCT FROM v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status NOT IN ('initiating', 'ringing') THEN
    RETURN jsonb_build_object('success', true, 'already_ended', true, 'status', v_s.status);
  END IF;
  UPDATE call_sessions
     SET status = 'declined', ended_at = now(), end_reason = 'declined', updated_at = now()
   WHERE id = p_call_session_id;
  RETURN jsonb_build_object('success', true, 'status', 'declined');
END;
$$;

-- mark_call_session_connected: media is flowing (either side). Billing starts.
CREATE OR REPLACE FUNCTION isexy.mark_call_session_connected(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_me IS NULL OR v_s.id IS NULL OR v_s.provider <> 'in_app'
     OR v_me NOT IN (v_s.caller_profile_id, COALESCE(v_s.receiver_profile_id, v_s.caller_profile_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status NOT IN ('initiating', 'ringing', 'connected') OR v_s.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  UPDATE call_sessions
     SET status = 'connected', answered_at = COALESCE(answered_at, now()), updated_at = now()
   WHERE id = p_call_session_id
  RETURNING answered_at INTO v_s.answered_at;
  RETURN jsonb_build_object('success', true, 'answered_at', v_s.answered_at);
END;
$$;

-- end_call_session: same contract as before, plus 'missed' (caller, no answer),
-- 'declined' (receiver before connect), duration 0 when never connected, and
-- settlement of unpaid minutes for connected in-app calls.
CREATE OR REPLACE FUNCTION isexy.end_call_session(
  p_call_session_id uuid,
  p_end_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
  v_new_status text;
  v_duration int := 0;
  v_due int;
  v_before int;
  v_take int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_s.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;
  IF v_s.caller_profile_id <> v_me AND v_s.receiver_profile_id IS DISTINCT FROM v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  IF v_s.status IN ('completed', 'canceled', 'failed', 'missed', 'declined') THEN
    RETURN jsonb_build_object('success', true, 'already_ended', true, 'status', v_s.status);
  END IF;

  IF v_s.status = 'connected' THEN
    v_new_status := 'completed';
    v_duration := GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(v_s.answered_at, v_s.started_at)))::int);
    IF v_s.provider = 'in_app' AND v_s.answered_at IS NOT NULL THEN
      v_due := GREATEST(1, ceil(v_duration / 60.0)::int) - COALESCE(v_s.minutes_charged, 0);
      IF v_due > 0 THEN
        SELECT COALESCE(phone_minutes, 0) INTO v_before
          FROM user_credits WHERE profile_id = v_s.caller_profile_id FOR UPDATE;
        v_take := LEAST(v_due, GREATEST(COALESCE(v_before, 0), 0));
        IF v_take > 0 THEN
          UPDATE user_credits SET phone_minutes = phone_minutes - v_take, updated_at = now()
           WHERE profile_id = v_s.caller_profile_id;
          INSERT INTO call_minute_transactions
            (profile_id, call_session_id, call_type, minutes_charged, balance_before, balance_after)
          VALUES (v_s.caller_profile_id, v_s.id, v_s.call_type, v_take, v_before, v_before - v_take);
          INSERT INTO credit_transactions (profile_id, amount, type, category, description)
          VALUES (v_s.caller_profile_id, -v_take, 'spend', v_s.call_type, v_s.call_type || ' minutes (end of call)');
        END IF;
      END IF;
    END IF;
  ELSIF p_end_reason = 'no_answer' AND v_me = v_s.caller_profile_id THEN
    v_new_status := 'missed';
  ELSIF v_me = v_s.receiver_profile_id THEN
    v_new_status := 'declined';
  ELSIF p_end_reason = 'failed' THEN
    v_new_status := 'failed';
  ELSE
    v_new_status := 'canceled';
  END IF;

  UPDATE call_sessions
     SET status = v_new_status,
         ended_at = now(),
         duration_seconds = v_duration,
         minutes_charged = COALESCE(minutes_charged, 0) + v_take,
         end_reason = COALESCE(left(nullif(trim(p_end_reason), ''), 40), end_reason),
         updated_at = now()
   WHERE id = p_call_session_id;

  RETURN jsonb_build_object('success', true, 'status', v_new_status, 'duration_seconds', v_duration,
                            'minutes_charged', COALESCE(v_s.minutes_charged, 0) + v_take);
END;
$$;

-- The receiver hears the call ring through Realtime (RLS lets participants read).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'isexy' AND tablename = 'call_sessions'
  ) THEN
    PERFORM isexy._realtime_add('call_sessions');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_created
  ON isexy.call_sessions (caller_profile_id, created_at DESC);

REVOKE ALL ON FUNCTION isexy.start_phone_line_call_session(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.answer_call_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.decline_call_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.mark_call_session_connected(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.end_call_session(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.charge_call_session_minute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.start_phone_line_call_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.answer_call_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.decline_call_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.mark_call_session_connected(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.end_call_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.charge_call_session_minute(uuid) TO authenticated;
