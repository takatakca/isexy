-- FOLDED INTO supabase/isexy-migrations/0013_app_completion.sql (part D). Kept as the branch notes; do not apply this file.
-- ISEXY calls area (branch wf/calls). Apply after 0001-0003 as part of the next
-- isexy migration. Idempotent: running it twice changes nothing. Deletes no
-- data. Every function: SECURITY DEFINER, SET search_path = isexy, extensions,
-- checks auth.uid(); EXECUTE for authenticated only.
--
-- Deploy together with the wf/calls client: VideoCall, IncomingCallNotification
-- and PhoneLineCall call these RPCs instead of writing the call tables, and
-- the Twilio functions call apply_twilio_call_status.
--
--   1. credit_transactions.type accepts 'spend' (every connected call was cut
--      off with "out of minutes").
--   2. In-app calls (video_call_sessions): start_call, answer_call,
--      decline_call, mark_call_connected, charge_call_minute (server clock),
--      end_call (server duration + settlement).
--   3. record_missed_call (caller only, once per call) + unique index.
--   4. Phone Line in-app calls (call_sessions): ring / answer / decline /
--      connected / charge / end with settlement; call_sessions on Realtime.
--   5. Twilio: one session per CallSid, apply_twilio_call_status (service
--      role, statuses only move forward), phone numbers: members cannot mark
--      them verified, link_my_verified_phone (SMS-confirmed sign-in number),
--      link_my_phone_line_number fixed and admin-only (no DELETE).
--   6. Moderation state: greetings / voice replies / banned voice profiles
--      change only through staff RPCs (get_voice_greetings_for_review,
--      review_voice_greeting); a greeting goes only on the member's own
--      voice profile; admins read video_call_sessions.
--
-- Test: scripts/isexy/test/calls-smoke.sql (instructions at its top).

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

-- Members no longer write video_call_sessions themselves (the RPCs above do):
-- the INSERT policy let a member create sessions outside start_call, and the
-- UPDATE policy let either member rewrite status, duration and credits_used
-- of any of their calls. Reading stays (Realtime + catch-up need it).
DROP POLICY IF EXISTS "Users can insert call sessions" ON isexy.video_call_sessions;
DROP POLICY IF EXISTS "Users can update their call sessions" ON isexy.video_call_sessions;

-- ============================================================================
-- 4. Phone Line calls (call_sessions, provider 'in_app')
-- ----------------------------------------------------------------------------
-- start_phone_line_call_session read profiles.age (no such column: every call
-- failed) and created the session 'connected' with answered_at = now(), so
-- the caller paid per minute for a call nobody received. Now:
--   ringing   --answer_call_session (receiver)-->  connected, answered_at NULL
--   connected --mark_call_session_connected (either side, media flowing)-->
--             answered_at stamped; billing starts (charge_call_session_minute,
--             first minute at once, then one per 60 s, server clock)
--   end_call_session: completed + settlement of unpaid minutes when media
--   flowed; missed / declined / canceled / failed otherwise (never charged).
-- Twilio sessions are written by the status callback only (section 5).
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

  SELECT pl.* INTO v_pl
    FROM phone_line_profiles pl
    JOIN profiles p ON p.id = pl.profile_id
   WHERE pl.profile_id = p_target_profile_id AND pl.status = 'active' AND pl.is_public = true
     AND p.is_active IS NOT FALSE
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
   WHERE caller_profile_id = v_caller.id AND provider = 'in_app' AND call_type = 'phone_line_profile'
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

-- answer_call_session: the receiver picks up (or rejoins after a reload).
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
  IF v_s.ended_at IS NOT NULL
     OR NOT ((v_s.status IN ('initiating', 'ringing') AND v_s.started_at > now() - interval '3 minutes')
             OR v_s.status = 'connected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  IF EXISTS (SELECT 1 FROM blocks
              WHERE (blocker_id = v_me AND blocked_id = v_s.caller_profile_id)
                 OR (blocker_id = v_s.caller_profile_id AND blocked_id = v_me)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active');
  END IF;
  IF v_s.status <> 'connected' THEN
    UPDATE call_sessions SET status = 'connected', updated_at = now() WHERE id = p_call_session_id;
  END IF;
  SELECT first_name INTO v_caller_name FROM profiles WHERE id = v_s.caller_profile_id;
  RETURN jsonb_build_object('success', true, 'status', 'connected', 'caller_profile_id', v_s.caller_profile_id,
                            'caller_name', v_caller_name, 'call_type', v_s.call_type);
END;
$$;

-- decline_call_session: the receiver says no while it rings.
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
    RETURN jsonb_build_object('success', true, 'already_ended', v_s.ended_at IS NOT NULL, 'status', v_s.status);
  END IF;
  UPDATE call_sessions
     SET status = 'declined', ended_at = now(), end_reason = 'declined', updated_at = now()
   WHERE id = p_call_session_id;
  RETURN jsonb_build_object('success', true, 'status', 'declined');
END;
$$;

-- mark_call_session_connected: media is flowing (either side, after the
-- receiver answered). Billing starts here.
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
     OR (v_me <> v_s.caller_profile_id AND v_s.receiver_profile_id IS DISTINCT FROM v_me) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_s.status <> 'connected' OR v_s.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  UPDATE call_sessions
     SET answered_at = COALESCE(answered_at, now()), updated_at = now()
   WHERE id = p_call_session_id
  RETURNING answered_at INTO v_s.answered_at;
  RETURN jsonb_build_object('success', true, 'answered_at', v_s.answered_at);
END;
$$;

-- charge_call_session_minute: the caller pays one minute when it is due
-- (same contract as before; in-app sessions only, media must have flowed).
CREATE OR REPLACE FUNCTION isexy.charge_call_session_minute(p_call_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_s call_sessions%ROWTYPE;
  v_before int;
  v_allowed int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  SELECT * INTO v_s FROM call_sessions WHERE id = p_call_session_id FOR UPDATE;
  IF v_s.id IS NULL OR v_s.provider <> 'in_app' THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;
  IF v_s.caller_profile_id <> v_me THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  IF v_s.status IN ('completed', 'canceled', 'missed', 'declined', 'failed') OR v_s.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_not_active', 'status', v_s.status);
  END IF;
  IF v_s.status <> 'connected' OR v_s.answered_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_connected', 'status', v_s.status);
  END IF;

  v_allowed := floor(extract(epoch FROM (now() - v_s.answered_at)) / 60)::int + 1;
  SELECT COALESCE(phone_minutes, 0) INTO v_before FROM user_credits WHERE profile_id = v_me FOR UPDATE;
  v_before := COALESCE(v_before, 0);
  IF COALESCE(v_s.minutes_charged, 0) >= v_allowed THEN
    RETURN jsonb_build_object('success', true, 'charged', false, 'reason', 'not_due_yet', 'remaining', v_before);
  END IF;
  IF v_before <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_minutes', 'remaining', 0);
  END IF;

  UPDATE user_credits SET phone_minutes = phone_minutes - 1, updated_at = now() WHERE profile_id = v_me;
  UPDATE call_sessions SET minutes_charged = minutes_charged + 1, updated_at = now() WHERE id = p_call_session_id;
  INSERT INTO call_minute_transactions
    (profile_id, call_session_id, call_type, minutes_charged, balance_before, balance_after)
  VALUES (v_me, p_call_session_id, v_s.call_type, 1, v_before, v_before - 1);
  INSERT INTO credit_transactions (profile_id, amount, type, category, description)
  VALUES (v_me, -1, 'spend', 'phone', 'Phone Line call minute');

  RETURN jsonb_build_object('success', true, 'charged', true, 'remaining', v_before - 1);
END;
$$;

-- end_call_session: either participant of an in-app session ends it.
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
  IF v_s.provider <> 'in_app' THEN
    -- Twilio calls end with the provider's status callback.
    RETURN jsonb_build_object('success', false, 'error', 'provider_managed', 'status', v_s.status);
  END IF;
  IF v_s.status IN ('completed', 'canceled', 'failed', 'missed', 'declined') OR v_s.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_ended', true, 'status', v_s.status,
                              'duration_seconds', v_s.duration_seconds, 'minutes_charged', v_s.minutes_charged);
  END IF;

  IF v_s.status = 'connected' AND v_s.answered_at IS NOT NULL THEN
    v_new_status := 'completed';
    v_duration := GREATEST(0, floor(extract(epoch FROM (now() - v_s.answered_at))))::int;
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
        VALUES (v_s.caller_profile_id, -v_take, 'spend', 'phone', 'Phone Line call minutes (end of call)');
      END IF;
    END IF;
  ELSIF v_s.status = 'connected' THEN
    -- Answered, but media never flowed: nobody pays.
    v_new_status := CASE WHEN p_end_reason = 'failed' THEN 'failed' ELSE 'canceled' END;
  ELSIF p_end_reason = 'no_answer' AND v_me = v_s.caller_profile_id
        AND v_s.started_at <= now() - interval '15 seconds' THEN
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

-- The receiver hears a Phone Line call ring through Realtime (RLS: participants read).
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

-- ============================================================================
-- 5. Twilio phone line: one session per CallSid, ordered statuses, numbers
-- ----------------------------------------------------------------------------
-- The inbound webhook inserted a new call_sessions row on every Twilio retry;
-- the status callback let a late 'in-progress' move a finished call back to
-- 'connected' and overwrote answered_at. Member-written phone numbers could be
-- marked verified (RLS lets owners INSERT/UPDATE every column), and
-- link_my_phone_line_number used columns that do not exist (always failed),
-- was open to every member and DELETEd other members' rows.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM isexy.call_sessions
     WHERE provider_call_sid IS NOT NULL
     GROUP BY provider_call_sid HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS call_sessions_provider_call_sid_uniq
      ON isexy.call_sessions (provider_call_sid);
  ELSE
    RAISE NOTICE 'call_sessions has duplicate provider_call_sid rows; unique index not created';
  END IF;
END;
$$;

-- Status callback (service role only): statuses only move forward.
CREATE OR REPLACE FUNCTION isexy.apply_twilio_call_status(
  p_call_sid text,
  p_status text,
  p_duration int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_s call_sessions%ROWTYPE;
  v_new text;
BEGIN
  IF p_call_sid IS NULL OR p_call_sid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_call_sid');
  END IF;
  v_new := CASE p_status
    WHEN 'queued' THEN 'initiating'
    WHEN 'initiated' THEN 'initiating'
    WHEN 'ringing' THEN 'ringing'
    WHEN 'in-progress' THEN 'connected'
    WHEN 'answered' THEN 'connected'
    WHEN 'completed' THEN 'completed'
    WHEN 'busy' THEN 'missed'
    WHEN 'no-answer' THEN 'missed'
    WHEN 'failed' THEN 'failed'
    WHEN 'canceled' THEN 'canceled'
    ELSE NULL
  END;
  IF v_new IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unknown_status');
  END IF;

  SELECT * INTO v_s FROM call_sessions WHERE provider_call_sid = p_call_sid FOR UPDATE;
  IF v_s.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;
  IF v_s.status IN ('completed', 'missed', 'declined', 'failed', 'canceled') THEN
    RETURN jsonb_build_object('success', true, 'ignored', true, 'status', v_s.status);
  END IF;
  -- initiating < ringing < connected < terminal
  IF (v_new = 'initiating' AND v_s.status <> 'initiating')
     OR (v_new = 'ringing' AND v_s.status = 'connected') THEN
    RETURN jsonb_build_object('success', true, 'ignored', true, 'status', v_s.status);
  END IF;

  UPDATE call_sessions
     SET status = v_new,
         answered_at = CASE WHEN v_new = 'connected' THEN COALESCE(answered_at, now()) ELSE answered_at END,
         ended_at = CASE WHEN v_new IN ('completed', 'missed', 'failed', 'canceled') THEN COALESCE(ended_at, now()) ELSE ended_at END,
         duration_seconds = CASE WHEN v_new = 'completed' AND COALESCE(p_duration, 0) > 0 THEN p_duration ELSE duration_seconds END,
         end_reason = CASE WHEN v_new IN ('missed', 'failed', 'canceled') THEN COALESCE(end_reason, p_status) ELSE end_reason END,
         updated_at = now()
   WHERE id = v_s.id;
  RETURN jsonb_build_object('success', true, 'status', v_new);
END;
$$;
REVOKE ALL ON FUNCTION isexy.apply_twilio_call_status(text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.apply_twilio_call_status(text, text, int) TO service_role;

-- Members may add or edit their own number, never mark it verified.
CREATE OR REPLACE FUNCTION isexy.phone_line_numbers_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.phone_verified := false;
    ELSE
      NEW.phone_verified := OLD.phone_verified AND NEW.phone_verified
                            AND NEW.phone_number_e164 = OLD.phone_number_e164
                            AND NEW.profile_id = OLD.profile_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phone_line_numbers_member_guard ON isexy.phone_line_numbers;
CREATE TRIGGER phone_line_numbers_member_guard
  BEFORE INSERT OR UPDATE ON isexy.phone_line_numbers
  FOR EACH ROW EXECUTE FUNCTION isexy.phone_line_numbers_member_guard();

-- link_my_verified_phone: the number the member confirmed by SMS code at
-- sign-in (Takatak Auth: auth.users.phone + phone_confirmed_at) lets them use
-- the phone line by phone. A number belongs to one member: an older link of the
-- same number to another profile is switched off (kept, not deleted).
CREATE OR REPLACE FUNCTION isexy.link_my_verified_phone()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile_id uuid;
  v_phone text;
  v_confirmed timestamptz;
  v_norm text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  SELECT u.phone, u.phone_confirmed_at INTO v_phone, v_confirmed FROM auth.users u WHERE u.id = auth.uid();
  v_norm := '+' || regexp_replace(COALESCE(v_phone, ''), '\D', '', 'g');
  IF v_confirmed IS NULL OR v_norm !~ '^\+\d{7,16}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_verified_phone');
  END IF;

  UPDATE phone_line_numbers SET phone_verified = false, updated_at = now()
   WHERE phone_number_e164 = v_norm AND profile_id <> v_profile_id AND phone_verified;
  UPDATE phone_line_numbers SET is_primary = false, updated_at = now()
   WHERE profile_id = v_profile_id AND phone_number_e164 <> v_norm AND is_primary;
  INSERT INTO phone_line_numbers (profile_id, phone_number_e164, phone_verified, is_primary)
  VALUES (v_profile_id, v_norm, true, true)
  ON CONFLICT (profile_id, phone_number_e164) DO UPDATE
    SET phone_verified = true, is_primary = true, updated_at = now();

  RETURN jsonb_build_object('success', true,
                            'phone_masked', left(v_norm, 2) || repeat('•', greatest(length(v_norm) - 6, 0)) || right(v_norm, 4));
END;
$$;
REVOKE ALL ON FUNCTION isexy.link_my_verified_phone() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.link_my_verified_phone() TO authenticated;

-- link_my_phone_line_number (AdminCallTests "Link & verify", IVR testing):
-- admins only; real columns; no DELETE.
CREATE OR REPLACE FUNCTION isexy.link_my_phone_line_number(p_phone_e164 text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile_id uuid;
  v_norm text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;
  v_norm := trim(COALESCE(p_phone_e164, ''));
  IF v_norm !~ '^\+\d{7,16}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_e164');
  END IF;

  UPDATE phone_line_numbers SET phone_verified = false, updated_at = now()
   WHERE phone_number_e164 = v_norm AND profile_id <> v_profile_id AND phone_verified;
  INSERT INTO phone_line_numbers (profile_id, phone_number_e164, phone_verified, is_primary)
  VALUES (v_profile_id, v_norm, true, true)
  ON CONFLICT (profile_id, phone_number_e164) DO UPDATE
    SET phone_verified = true, is_primary = true, updated_at = now();

  RETURN jsonb_build_object('success', true, 'profile_id', v_profile_id, 'phone', v_norm);
END;
$$;
REVOKE ALL ON FUNCTION isexy.link_my_phone_line_number(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.link_my_phone_line_number(text) TO authenticated;

-- ============================================================================
-- 6. Phone Line moderation state: only staff change it
-- ----------------------------------------------------------------------------
-- Owners could approve their own greetings and voice replies
-- (moderation_status is writable through the owner policies), and a banned
-- voice profile un-banned itself on "Save draft" (the client writes status).
-- Greetings default to 'pending' and nothing approved them, so Browse voices
-- was always empty: staff now review them with review_voice_greeting().
-- ============================================================================
CREATE OR REPLACE FUNCTION isexy.voice_greetings_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      -- The insert policy only checks profile_id: the greeting must also go
      -- on the member's own voice profile (not on someone else's, where it
      -- would become that person's newest greeting once approved).
      IF NOT EXISTS (SELECT 1 FROM phone_line_profiles plp
                      WHERE plp.id = NEW.phone_line_profile_id AND plp.profile_id = NEW.profile_id) THEN
        RAISE EXCEPTION 'A greeting goes on your own voice profile' USING ERRCODE = '42501';
      END IF;
      NEW.moderation_status := 'pending';
      NEW.rejected_reason := NULL;
      NEW.report_count := 0;
      NEW.is_hidden := false;
    ELSE
      NEW.report_count := OLD.report_count;
      NEW.is_hidden := OLD.is_hidden;
      NEW.profile_id := OLD.profile_id;
      NEW.phone_line_profile_id := OLD.phone_line_profile_id;
      IF NEW.audio_url IS DISTINCT FROM OLD.audio_url THEN
        NEW.moderation_status := 'pending';   -- new audio: reviewed again
        NEW.rejected_reason := NULL;
      ELSE
        NEW.moderation_status := OLD.moderation_status;
        NEW.rejected_reason := OLD.rejected_reason;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS voice_greetings_member_guard ON isexy.voice_greetings;
CREATE TRIGGER voice_greetings_member_guard
  BEFORE INSERT OR UPDATE ON isexy.voice_greetings
  FOR EACH ROW EXECUTE FUNCTION isexy.voice_greetings_member_guard();

CREATE OR REPLACE FUNCTION isexy.voice_replies_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.moderation_status := 'pending';
      NEW.rejected_reason := NULL;
      NEW.report_count := 0;
      NEW.is_hidden := false;
      NEW.is_read := false;
    ELSE
      NEW.moderation_status := OLD.moderation_status;
      NEW.rejected_reason := OLD.rejected_reason;
      NEW.report_count := OLD.report_count;
      NEW.is_hidden := OLD.is_hidden;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS voice_replies_member_guard ON isexy.phone_line_voice_replies;
CREATE TRIGGER voice_replies_member_guard
  BEFORE INSERT OR UPDATE ON isexy.phone_line_voice_replies
  FOR EACH ROW EXECUTE FUNCTION isexy.voice_replies_member_guard();

-- A banned voice profile stays banned (and hidden); the owner cannot delete
-- it to start over. Owners can still pause, edit and go live otherwise. The
-- age shown to callers comes from the member's birth date, not a typed number.
CREATE OR REPLACE FUNCTION isexy.phone_line_profiles_member_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, extensions
AS $$
DECLARE
  v_age int;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.status = 'banned' THEN
        RAISE EXCEPTION 'This voice profile was removed by moderation' USING ERRCODE = '42501';
      END IF;
      RETURN OLD;
    END IF;
    SELECT date_part('year', age(current_date, p.birth_date))::int INTO v_age
      FROM profiles p WHERE p.id = NEW.profile_id;
    IF v_age IS NOT NULL THEN
      NEW.age := v_age;
    END IF;
    IF TG_OP = 'INSERT' THEN
      IF NEW.status = 'banned' THEN NEW.status := 'draft'; END IF;
    ELSE
      NEW.profile_id := OLD.profile_id;
      IF OLD.status = 'banned' THEN
        NEW.status := 'banned';
        NEW.is_public := false;
      ELSIF NEW.status = 'banned' THEN
        NEW.status := OLD.status;
      END IF;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS phone_line_profiles_member_guard ON isexy.phone_line_profiles;
CREATE TRIGGER phone_line_profiles_member_guard
  BEFORE INSERT OR UPDATE OR DELETE ON isexy.phone_line_profiles
  FOR EACH ROW EXECUTE FUNCTION isexy.phone_line_profiles_member_guard();

-- Staff review queue.
CREATE OR REPLACE FUNCTION isexy.get_voice_greetings_for_review(p_limit int DEFAULT 50)
RETURNS TABLE (
  greeting_id uuid,
  phone_line_profile_id uuid,
  profile_id uuid,
  display_name text,
  age int,
  city text,
  headline text,
  profile_status text,
  duration_seconds int,
  report_count int,
  moderation_status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT g.id, g.phone_line_profile_id, g.profile_id, pl.display_name, pl.age, pl.city, pl.headline,
           pl.status, g.duration_seconds, g.report_count, g.moderation_status, g.created_at
      FROM voice_greetings g
      JOIN phone_line_profiles pl ON pl.id = g.phone_line_profile_id
     WHERE g.is_active AND (g.moderation_status = 'pending' OR g.report_count > 0)
     ORDER BY (g.moderation_status = 'pending') DESC, g.created_at
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$$;

CREATE OR REPLACE FUNCTION isexy.review_voice_greeting(
  p_greeting_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_g voice_greetings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;
  SELECT * INTO v_g FROM voice_greetings WHERE id = p_greeting_id FOR UPDATE;
  IF v_g.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF p_approve IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_decision');
  END IF;
  UPDATE voice_greetings
     SET moderation_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         rejected_reason = CASE WHEN p_approve THEN NULL ELSE left(nullif(trim(p_reason), ''), 300) END,
         is_hidden = CASE WHEN p_approve THEN false ELSE is_hidden END,
         updated_at = now()
   WHERE id = p_greeting_id;
  RETURN jsonb_build_object('success', true, 'moderation_status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$$;

REVOKE ALL ON FUNCTION isexy.get_voice_greetings_for_review(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION isexy.review_voice_greeting(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_voice_greetings_for_review(int) TO authenticated;
GRANT EXECUTE ON FUNCTION isexy.review_voice_greeting(uuid, boolean, text) TO authenticated;

-- AdminCallTests lists in-app calls too.
DROP POLICY IF EXISTS "Admins can read all video call sessions" ON isexy.video_call_sessions;
CREATE POLICY "Admins can read all video call sessions"
  ON isexy.video_call_sessions FOR SELECT
  TO authenticated
  USING (isexy.has_role(auth.uid(), 'admin'::isexy.app_role));
