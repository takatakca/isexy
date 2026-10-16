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
