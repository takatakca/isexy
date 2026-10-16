-- Smoke tests for docs/handoff/calls.sql (calls area: in-app calls, missed
-- calls, Phone Line calls, Twilio statuses, phone numbers, moderation state).
-- Run on a THROWAWAY local Postgres only (never on V1), after:
--   psql "$ISEXY_DB_URL" -f scripts/isexy/test/v1-mock.sql
--   scripts/isexy/migrate.sh --apply        (0001-0004)
--   psql "$ISEXY_DB_URL" -1 -f docs/handoff/calls.sql   (or calls.sql folded into a migration)
-- then (everything is rolled back):
--   printf 'BEGIN;\n\\i scripts/isexy/test/calls-smoke.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q
-- Fake members call each RPC as the authenticated / anon / service_role roles
-- with request.jwt.claim(s) set; allowed and forbidden calls for each RPC.
-- now() is fixed inside the transaction, so time gates are tested by moving
-- the stored timestamps back.
\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE TEMP TABLE results (n serial, name text, ok boolean, detail text);
CREATE TEMP TABLE kept (k text PRIMARY KEY, v jsonb);
GRANT ALL ON results, kept TO authenticated, anon, service_role;
GRANT ALL ON SEQUENCE results_n_seq TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, false),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false),
         set_config('request.jwt.claim.role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.ok(p_name text, p_ok boolean, p_detail text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  INSERT INTO results (name, ok, detail) VALUES (p_name, COALESCE(p_ok, false), p_detail);
$$;
-- keep('S1', rpc(...)) stores an RPC result; sid('S1') is its call_session_id.
CREATE OR REPLACE FUNCTION pg_temp.keep(p_k text, p_v jsonb) RETURNS jsonb LANGUAGE sql AS $$
  INSERT INTO kept VALUES (p_k, p_v) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v RETURNING v;
$$;
CREATE OR REPLACE FUNCTION pg_temp.sid(p_k text) RETURNS uuid LANGUAGE sql AS $$
  SELECT (v->>'call_session_id')::uuid FROM kept WHERE k = p_k;
$$;
CREATE OR REPLACE FUNCTION pg_temp.r(p_k text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT v FROM kept WHERE k = p_k;
$$;

-- Members ----------------------------------------------------------------------
-- A caller, B callee (A-B match), C outsider, D Phone Line caller, E admin,
-- K under 18.
INSERT INTO auth.users (id, email, phone) VALUES
 ('ca110000-0000-4000-8000-00000000000a', 'a@calls.test', NULL),
 ('ca110000-0000-4000-8000-00000000000b', 'b@calls.test', NULL),
 ('ca110000-0000-4000-8000-00000000000c', 'c@calls.test', NULL),
 ('ca110000-0000-4000-8000-00000000000d', 'd@phone.isexy.ca', '15145550123'),
 ('ca110000-0000-4000-8000-00000000000e', 'e@calls.test', NULL),
 ('ca110000-0000-4000-8000-00000000000f', 'k@calls.test', NULL);
-- Supabase's auth.users has phone_confirmed_at; the V1 mock does not (rolled back).
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_confirmed_at timestamptz;
UPDATE auth.users SET phone_confirmed_at = now() WHERE id = 'ca110000-0000-4000-8000-00000000000d';

INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, interested_in, is_active) VALUES
 ('ca110000-0000-4000-8000-00000000000a', 'Alex', '1990-01-01', 'man',   ARRAY['everyone'], true),
 ('ca110000-0000-4000-8000-00000000000b', 'Bea',  '1991-05-01', 'woman', ARRAY['everyone'], true),
 ('ca110000-0000-4000-8000-00000000000c', 'Cleo', '1992-01-01', 'woman', ARRAY['everyone'], true),
 ('ca110000-0000-4000-8000-00000000000d', 'Dan',  '1993-01-01', 'man',   ARRAY['everyone'], true),
 ('ca110000-0000-4000-8000-00000000000e', 'Eve',  '1985-01-01', 'woman', ARRAY['everyone'], true),
 ('ca110000-0000-4000-8000-00000000000f', 'Kid',  (current_date - interval '17 years')::date, 'man', ARRAY['everyone'], true);
INSERT INTO isexy.user_roles (user_id, role) VALUES ('ca110000-0000-4000-8000-00000000000e', 'admin');
INSERT INTO isexy.matches (id, profile1_id, profile2_id, is_active)
VALUES ('ca11a000-0000-4000-8000-000000000001', 'ca110000-0000-4000-8000-00000000000a', 'ca110000-0000-4000-8000-00000000000b', true);
INSERT INTO isexy.user_credits (profile_id, video_minutes, phone_minutes) VALUES
 ('ca110000-0000-4000-8000-00000000000a', 5, 0),
 ('ca110000-0000-4000-8000-00000000000d', 0, 5),
 ('ca110000-0000-4000-8000-00000000000f', 0, 5);

-- 1. credit_transactions accepts 'spend' ---------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('1 deduct_call_minute works again (CHECK accepts spend)', (r->>'success')::boolean, r::text)
  FROM (SELECT isexy.deduct_call_minute('ca110000-0000-4000-8000-00000000000a', 'video') r) x;
RESET ROLE;
UPDATE isexy.user_credits SET video_minutes = 5 WHERE profile_id = 'ca110000-0000-4000-8000-00000000000a';

-- 2. In-app call lifecycle ------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000c');
SELECT pg_temp.ok('2 outsider cannot ring a match', r->>'error' = 'match_unavailable', r::text)
  FROM (SELECT isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'video') r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('2 invalid call type refused', r->>'error' = 'invalid_type', r::text)
  FROM (SELECT isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'bogus') r) x;
SELECT pg_temp.ok('2 caller starts a video call', (r->>'success')::boolean AND (r->>'remaining')::int = 5, r::text)
  FROM (SELECT pg_temp.keep('S1', isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'video')) r) x;
SELECT pg_temp.ok('2 caller can read the ringing session (receiver B)', bool_and(status = 'ringing' AND receiver_id = 'ca110000-0000-4000-8000-00000000000b'), string_agg(status, ','))
  FROM isexy.video_call_sessions WHERE id = pg_temp.sid('S1');
SELECT pg_temp.ok('2 caller cannot answer own call', r->>'error' = 'not_found', r::text)
  FROM (SELECT isexy.answer_call(pg_temp.sid('S1')) r) x;
SELECT pg_temp.ok('2 no charge while ringing', r->>'error' = 'call_not_active', r::text)
  FROM (SELECT isexy.charge_call_minute(pg_temp.sid('S1')) r) x;
SELECT pg_temp.ok('2 cannot mark connected before the answer', r->>'error' = 'call_not_active', r::text)
  FROM (SELECT isexy.mark_call_connected(pg_temp.sid('S1')) r) x;
DO $$ BEGIN
  INSERT INTO isexy.video_call_sessions (match_id, caller_id, receiver_id, status)
  VALUES ('ca11a000-0000-4000-8000-000000000001', 'ca110000-0000-4000-8000-00000000000a', 'ca110000-0000-4000-8000-00000000000b', 'connected');
  PERFORM pg_temp.ok('2 member cannot INSERT sessions directly', false, 'insert allowed');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.ok('2 member cannot INSERT sessions directly', true, SQLERRM);
END $$;
UPDATE isexy.video_call_sessions SET status = 'connected', credits_used = 99 WHERE id = pg_temp.sid('S1');
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('2 receiver answers', (r->>'success')::boolean AND r->>'call_type' = 'video', r::text)
  FROM (SELECT isexy.answer_call(pg_temp.sid('S1')) r) x;
RESET ROLE;
SELECT pg_temp.ok('2 direct UPDATE by a member changed nothing (status connecting, credits 0)',
  status = 'connecting' AND credits_used = 0, status || '/' || credits_used)
  FROM isexy.video_call_sessions WHERE id = pg_temp.sid('S1');
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('2 missed refused once answered', r->>'error' = 'call_not_ringing', r::text)
  FROM (SELECT isexy.record_missed_call(pg_temp.sid('S1')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000c');
SELECT pg_temp.ok('2 outsider cannot mark connected', r->>'error' = 'not_found', r::text)
  FROM (SELECT isexy.mark_call_connected(pg_temp.sid('S1')) r) x;
SELECT pg_temp.ok('2 outsider cannot read the session', count(*) = 0, count(*)::text)
  FROM isexy.video_call_sessions WHERE id = pg_temp.sid('S1');
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('2 receiver marks connected', (r->>'success')::boolean, r::text)
  FROM (SELECT isexy.mark_call_connected(pg_temp.sid('S1')) r) x;
SELECT pg_temp.ok('2 receiver cannot charge', r->>'error' = 'not_found', r::text)
  FROM (SELECT isexy.charge_call_minute(pg_temp.sid('S1')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('2 first minute charged at connect', (r->>'charged')::boolean AND (r->>'remaining')::int = 4, r::text)
  FROM (SELECT isexy.charge_call_minute(pg_temp.sid('S1')) r) x;
SELECT pg_temp.ok('2 second charge right away is not due', NOT (r->>'charged')::boolean AND (r->>'remaining')::int = 4, r::text)
  FROM (SELECT isexy.charge_call_minute(pg_temp.sid('S1')) r) x;
RESET ROLE;
UPDATE isexy.video_call_sessions SET connected_at = now() - interval '130 seconds' WHERE id = pg_temp.sid('S1');
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.keep('c2', isexy.charge_call_minute(pg_temp.sid('S1')));
SELECT pg_temp.keep('c3', isexy.charge_call_minute(pg_temp.sid('S1')));
SELECT pg_temp.keep('c4', isexy.charge_call_minute(pg_temp.sid('S1')));
SELECT pg_temp.ok('2 time gate: 130 s connected = 3 minutes at most',
  (pg_temp.r('c2')->>'charged')::boolean AND (pg_temp.r('c3')->>'charged')::boolean
  AND NOT (pg_temp.r('c4')->>'charged')::boolean AND (pg_temp.r('c4')->>'remaining')::int = 2,
  pg_temp.r('c4')::text);
SELECT pg_temp.ok('2 each minute logged against the session (own ledger readable)',
  count(*) = 3 AND bool_and(type = 'video_call' AND category = 'video' AND amount = -1), count(*)::text)
  FROM isexy.credit_transactions WHERE video_call_id = pg_temp.sid('S1');
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('2 receiver ends: server duration, 3 minutes used',
  r->>'status' = 'ended' AND (r->>'duration_seconds')::int >= 130 AND (r->>'credits_used')::int = 3, r::text)
  FROM (SELECT isexy.end_call(pg_temp.sid('S1'), 'hangup') r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('2 second end is a no-op', (r->>'already_ended')::boolean, r::text)
  FROM (SELECT isexy.end_call(pg_temp.sid('S1'), 'hangup') r) x;
SELECT pg_temp.ok('2 no charge after the end', r->>'error' = 'call_not_active', r::text)
  FROM (SELECT isexy.charge_call_minute(pg_temp.sid('S1')) r) x;
RESET ROLE;
SELECT pg_temp.ok('2 balance: 5 - 3 = 2 video minutes', bool_and(video_minutes = 2), string_agg(video_minutes::text, ','))
  FROM isexy.user_credits WHERE profile_id = 'ca110000-0000-4000-8000-00000000000a';

-- Settlement when the caller never charged (closed tab, modified client).
UPDATE isexy.user_credits SET phone_minutes = 3 WHERE profile_id = 'ca110000-0000-4000-8000-00000000000a';
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.keep('S2', isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'phone'));
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT isexy.answer_call(pg_temp.sid('S2'));
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT isexy.mark_call_connected(pg_temp.sid('S2'));
RESET ROLE;
UPDATE isexy.video_call_sessions SET connected_at = now() - interval '200 seconds' WHERE id = pg_temp.sid('S2');
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('2 end settles what is owed, capped by the balance (owed 4, had 3)',
  (r->>'credits_used')::int = 3, r::text)
  FROM (SELECT isexy.end_call(pg_temp.sid('S2'), 'hangup') r) x;
SELECT pg_temp.ok('2 phone minutes logged with the phone category', sum(amount) = -3, sum(amount)::text)
  FROM isexy.credit_transactions WHERE video_call_id = pg_temp.sid('S2') AND category = 'phone';
SELECT pg_temp.ok('2 no phone minutes left: no_minutes', r->>'error' = 'no_minutes', r::text)
  FROM (SELECT isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'phone') r) x;

-- Decline.
SELECT pg_temp.keep('S3', isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'video'));
SELECT pg_temp.ok('2 caller cannot decline', r->>'error' = 'not_found', r::text)
  FROM (SELECT isexy.decline_call(pg_temp.sid('S3')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('2 receiver declines', r->>'status' = 'declined', r::text)
  FROM (SELECT isexy.decline_call(pg_temp.sid('S3')) r) x;
SELECT pg_temp.ok('2 answering a declined call is refused', r->>'error' = 'call_not_active', r::text)
  FROM (SELECT isexy.answer_call(pg_temp.sid('S3')) r) x;

-- 3. Missed calls ---------------------------------------------------------------
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.keep('S4', isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'video'));
SELECT pg_temp.ok('3 missed call too early refused', r->>'error' = 'too_early', r::text)
  FROM (SELECT isexy.record_missed_call(pg_temp.sid('S4')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('3 receiver cannot record a missed call', r->>'error' = 'not_found', r::text)
  FROM (SELECT isexy.record_missed_call(pg_temp.sid('S4')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000c');
SELECT pg_temp.ok('3 outsider cannot record a missed call', r->>'error' = 'not_found', r::text)
  FROM (SELECT isexy.record_missed_call(pg_temp.sid('S4')) r) x;
RESET ROLE;
UPDATE isexy.video_call_sessions SET created_at = now() - interval '36 seconds' WHERE id = pg_temp.sid('S4');
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('3 caller records the missed call', (r->>'success')::boolean AND r->>'missed_call_id' IS NOT NULL, r::text)
  FROM (SELECT pg_temp.keep('M4', isexy.record_missed_call(pg_temp.sid('S4'))) r) x;
SELECT pg_temp.ok('3 second record is idempotent', (r->>'already_recorded')::boolean
  AND r->>'missed_call_id' = pg_temp.r('M4')->>'missed_call_id', r::text)
  FROM (SELECT isexy.record_missed_call(pg_temp.sid('S4')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('3 receiver sees the missed call (caller, match, session)',
  count(*) = 1 AND bool_and(caller_id = 'ca110000-0000-4000-8000-00000000000a' AND match_id = 'ca11a000-0000-4000-8000-000000000001'), count(*)::text)
  FROM isexy.missed_calls WHERE call_session_id = pg_temp.sid('S4');
RESET ROLE;
SELECT pg_temp.ok('3 session marked missed', bool_and(status = 'missed' AND end_reason = 'no_answer'), string_agg(status, ','))
  FROM isexy.video_call_sessions WHERE id = pg_temp.sid('S4');
DO $$ BEGIN
  INSERT INTO isexy.missed_calls (call_session_id, caller_id, receiver_id, match_id)
  VALUES (pg_temp.sid('S4'), 'ca110000-0000-4000-8000-00000000000a', 'ca110000-0000-4000-8000-00000000000b', 'ca11a000-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok('3 a second missed_calls row for the same call is rejected', false, 'inserted');
EXCEPTION WHEN unique_violation THEN
  PERFORM pg_temp.ok('3 a second missed_calls row for the same call is rejected', true, SQLERRM);
END $$;

-- Superseded ringing, cancel, rate limit, blocks, anon.
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.keep('S5', isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'video'));
SELECT pg_temp.keep('S6', isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'video'));
SELECT pg_temp.ok('2 a new call stops my older ringing call', bool_and(status = 'ended' AND end_reason = 'superseded'), string_agg(status, ','))
  FROM isexy.video_call_sessions WHERE id = pg_temp.sid('S5');
SELECT pg_temp.ok('2 caller cancels while ringing: ended, nothing charged',
  r->>'status' = 'ended' AND (r->>'credits_used')::int = 0, r::text)
  FROM (SELECT isexy.end_call(pg_temp.sid('S6'), 'cancel') r) x;
SELECT pg_temp.ok('2 six calls in two minutes: too_many_calls', r->>'error' = 'too_many_calls', r::text)
  FROM (SELECT isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'video') r) x;
RESET ROLE;
UPDATE isexy.video_call_sessions SET created_at = created_at - interval '10 minutes'
 WHERE caller_id = 'ca110000-0000-4000-8000-00000000000a';
INSERT INTO isexy.blocks (blocker_id, blocked_id) VALUES ('ca110000-0000-4000-8000-00000000000b', 'ca110000-0000-4000-8000-00000000000a');
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('2 blocked: cannot ring', r->>'error' = 'unavailable', r::text)
  FROM (SELECT isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'video') r) x;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  PERFORM isexy.start_call('ca11a000-0000-4000-8000-000000000001', 'video');
  PERFORM pg_temp.ok('2 anon cannot execute start_call', false, 'executed');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.ok('2 anon cannot execute start_call', true, SQLERRM);
END $$;
RESET ROLE;

-- 4. Phone Line in-app calls ---------------------------------------------------
INSERT INTO isexy.phone_line_profiles (id, profile_id, display_name, age, status, is_public)
VALUES ('ca11b000-0000-4000-8000-000000000001', 'ca110000-0000-4000-8000-00000000000b', 'Bee', 30, 'active', true);
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.ok('4 start works (no profiles.age error) and rings',
  (r->>'success')::boolean AND r->>'display_name' = 'Bee', r::text)
  FROM (SELECT pg_temp.keep('L1', isexy.start_phone_line_call_session('ca110000-0000-4000-8000-00000000000b', 'phone_line_profile')) r) x;
SELECT pg_temp.ok('4 session ringing, not answered', bool_and(status = 'ringing' AND answered_at IS NULL), string_agg(status, ','))
  FROM isexy.call_sessions WHERE id = pg_temp.sid('L1');
SELECT pg_temp.ok('4 nothing charged while ringing', r->>'error' = 'not_connected', r::text)
  FROM (SELECT isexy.charge_call_session_minute(pg_temp.sid('L1')) r) x;
SELECT pg_temp.ok('4 caller cannot answer', r->>'error' = 'not_found', r::text)
  FROM (SELECT isexy.answer_call_session(pg_temp.sid('L1')) r) x;
SELECT pg_temp.ok('4 caller cannot start billing before the answer', r->>'error' = 'call_not_active', r::text)
  FROM (SELECT isexy.mark_call_session_connected(pg_temp.sid('L1')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000c');
SELECT pg_temp.ok('4 outsider cannot answer', r->>'error' = 'not_found', r::text)
  FROM (SELECT isexy.answer_call_session(pg_temp.sid('L1')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('4 receiver sees the ringing call (RLS)', count(*) = 1, count(*)::text)
  FROM isexy.call_sessions WHERE id = pg_temp.sid('L1') AND status = 'ringing';
SELECT pg_temp.ok('4 receiver answers, gets the caller name', (r->>'success')::boolean AND r->>'caller_name' = 'Dan', r::text)
  FROM (SELECT isexy.answer_call_session(pg_temp.sid('L1')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.ok('4 answered but no media yet: still not charged', r->>'error' = 'not_connected', r::text)
  FROM (SELECT isexy.charge_call_session_minute(pg_temp.sid('L1')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000c');
SELECT pg_temp.ok('4 outsider cannot mark connected', r->>'error' = 'not_found', r::text)
  FROM (SELECT isexy.mark_call_session_connected(pg_temp.sid('L1')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('4 receiver marks media connected', (r->>'success')::boolean AND r->>'answered_at' IS NOT NULL, r::text)
  FROM (SELECT isexy.mark_call_session_connected(pg_temp.sid('L1')) r) x;
SELECT pg_temp.ok('4 receiver cannot charge', r->>'error' = 'not_authorized', r::text)
  FROM (SELECT isexy.charge_call_session_minute(pg_temp.sid('L1')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.ok('4 first minute charged (spend accepted)', (r->>'charged')::boolean AND (r->>'remaining')::int = 4, r::text)
  FROM (SELECT isexy.charge_call_session_minute(pg_temp.sid('L1')) r) x;
RESET ROLE;
UPDATE isexy.call_sessions SET answered_at = now() - interval '150 seconds' WHERE id = pg_temp.sid('L1');
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('4 end settles unpaid minutes (150 s = 3, paid 1, takes 2)',
  r->>'status' = 'completed' AND (r->>'minutes_charged')::int = 3, r::text)
  FROM (SELECT isexy.end_call_session(pg_temp.sid('L1'), 'hangup') r) x;
RESET ROLE;
SELECT pg_temp.ok('4 caller balance 5 - 3 = 2', bool_and(phone_minutes = 2), string_agg(phone_minutes::text, ','))
  FROM isexy.user_credits WHERE profile_id = 'ca110000-0000-4000-8000-00000000000d';
SELECT pg_temp.ok('4 minute ledger has the settlement', sum(minutes_charged) = 3, sum(minutes_charged)::text)
  FROM isexy.call_minute_transactions WHERE call_session_id = pg_temp.sid('L1');
UPDATE isexy.user_credits SET phone_minutes = 5 WHERE profile_id = 'ca110000-0000-4000-8000-00000000000d';

SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.keep('L2', isexy.start_phone_line_call_session('ca110000-0000-4000-8000-00000000000b', 'phone_line_profile'));
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('4 receiver declines', r->>'status' = 'declined', r::text)
  FROM (SELECT isexy.decline_call_session(pg_temp.sid('L2')) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.keep('L3', isexy.start_phone_line_call_session('ca110000-0000-4000-8000-00000000000b', 'phone_line_profile'));
RESET ROLE;
UPDATE isexy.call_sessions SET started_at = now() - interval '40 seconds' WHERE id = pg_temp.sid('L3');
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.ok('4 caller ring timeout: missed, duration 0, no charge',
  r->>'status' = 'missed' AND (r->>'duration_seconds')::int = 0 AND (r->>'minutes_charged')::int = 0, r::text)
  FROM (SELECT isexy.end_call_session(pg_temp.sid('L3'), 'no_answer') r) x;
SELECT pg_temp.keep('L4', isexy.start_phone_line_call_session('ca110000-0000-4000-8000-00000000000b', 'phone_line_profile'));
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
SELECT isexy.answer_call_session(pg_temp.sid('L4'));
SELECT pg_temp.ok('4 answered but media never flowed: canceled, nobody pays',
  r->>'status' = 'canceled' AND (r->>'minutes_charged')::int = 0, r::text)
  FROM (SELECT isexy.end_call_session(pg_temp.sid('L4'), 'failed_media') r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.keep('L5', isexy.start_phone_line_call_session('ca110000-0000-4000-8000-00000000000b', 'phone_line_profile'));
SELECT pg_temp.keep('L6', isexy.start_phone_line_call_session('ca110000-0000-4000-8000-00000000000b', 'phone_line_profile'));
SELECT pg_temp.ok('4 a new call cancels my older ringing call', bool_and(status = 'canceled' AND end_reason = 'superseded'), string_agg(status, ','))
  FROM isexy.call_sessions WHERE id = pg_temp.sid('L5');
RESET ROLE;
SELECT pg_temp.ok('4 caller balance untouched by unconnected calls', bool_and(phone_minutes = 5), string_agg(phone_minutes::text, ','))
  FROM isexy.user_credits WHERE profile_id = 'ca110000-0000-4000-8000-00000000000d';
UPDATE isexy.call_sessions SET created_at = created_at - interval '10 minutes'
 WHERE caller_profile_id = 'ca110000-0000-4000-8000-00000000000d';
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000f');
SELECT pg_temp.ok('4 under 18 refused (from birth_date)', r->>'error' = 'age_restricted', r::text)
  FROM (SELECT isexy.start_phone_line_call_session('ca110000-0000-4000-8000-00000000000b', 'phone_line_profile') r) x;
RESET ROLE;
UPDATE isexy.phone_line_profiles SET status = 'paused' WHERE id = 'ca11b000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.ok('4 paused voice profile cannot be called', r->>'error' = 'voice_profile_unavailable', r::text)
  FROM (SELECT isexy.start_phone_line_call_session('ca110000-0000-4000-8000-00000000000b', 'phone_line_profile') r) x;
RESET ROLE;
UPDATE isexy.phone_line_profiles SET status = 'active' WHERE id = 'ca11b000-0000-4000-8000-000000000001';
SELECT pg_temp.ok('4 call_sessions is in the realtime publication', count(*) = 1, count(*)::text)
  FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'isexy' AND tablename = 'call_sessions';
SET ROLE anon;
DO $$ BEGIN
  PERFORM isexy.start_phone_line_call_session('ca110000-0000-4000-8000-00000000000b', 'phone_line_profile');
  PERFORM pg_temp.ok('4 anon cannot start a Phone Line call', false, 'executed');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.ok('4 anon cannot start a Phone Line call', true, SQLERRM);
END $$;
RESET ROLE;

-- 5. Twilio sessions and phone numbers -----------------------------------------
INSERT INTO isexy.call_sessions (caller_profile_id, call_type, provider, provider_call_sid, status)
VALUES ('ca110000-0000-4000-8000-00000000000d', 'phone_line_menu', 'twilio', 'CA_TEST_1', 'initiating');
DO $$ BEGIN
  INSERT INTO isexy.call_sessions (caller_profile_id, call_type, provider, provider_call_sid, status)
  VALUES ('ca110000-0000-4000-8000-00000000000d', 'phone_line_menu', 'twilio', 'CA_TEST_1', 'initiating');
  PERFORM pg_temp.ok('5 one session per Twilio CallSid (webhook retry)', false, 'inserted twice');
EXCEPTION WHEN unique_violation THEN
  PERFORM pg_temp.ok('5 one session per Twilio CallSid (webhook retry)', true, SQLERRM);
END $$;
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
DO $$ BEGIN
  PERFORM isexy.apply_twilio_call_status('CA_TEST_1', 'completed', 10);
  PERFORM pg_temp.ok('5 members cannot write Twilio statuses', false, 'executed');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.ok('5 members cannot write Twilio statuses', true, SQLERRM);
END $$;
SELECT pg_temp.ok('5 member cannot end a Twilio-managed session',
  r->>'error' = 'provider_managed', r::text)
  FROM (SELECT isexy.end_call_session((SELECT id FROM isexy.call_sessions WHERE provider_call_sid = 'CA_TEST_1'), 'hangup') r) x;
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.keep('t1', isexy.apply_twilio_call_status('CA_TEST_1', 'ringing', NULL));
SELECT pg_temp.keep('t2', isexy.apply_twilio_call_status('CA_TEST_1', 'in-progress', NULL));
RESET ROLE;
UPDATE isexy.call_sessions SET answered_at = now() - interval '1 minute' WHERE provider_call_sid = 'CA_TEST_1';
SET ROLE service_role;
SELECT pg_temp.keep('t3', isexy.apply_twilio_call_status('CA_TEST_1', 'in-progress', NULL));
SELECT pg_temp.keep('t4', isexy.apply_twilio_call_status('CA_TEST_1', 'ringing', NULL));
SELECT pg_temp.ok('5 ringing then in-progress: connected; a late ringing is ignored',
  pg_temp.r('t1')->>'status' = 'ringing' AND pg_temp.r('t2')->>'status' = 'connected' AND (pg_temp.r('t4')->>'ignored')::boolean,
  pg_temp.r('t4')::text);
SELECT pg_temp.ok('5 answered_at kept from the first in-progress', bool_and(answered_at < now() - interval '30 seconds'), string_agg(answered_at::text, ','))
  FROM isexy.call_sessions WHERE provider_call_sid = 'CA_TEST_1';
SELECT pg_temp.keep('t5', isexy.apply_twilio_call_status('CA_TEST_1', 'completed', 42));
SELECT pg_temp.keep('t6', isexy.apply_twilio_call_status('CA_TEST_1', 'in-progress', NULL));
SELECT pg_temp.ok('5 completed with Twilio duration; a late in-progress cannot reopen it',
  status = 'completed' AND duration_seconds = 42 AND ended_at IS NOT NULL AND (pg_temp.r('t6')->>'ignored')::boolean, status)
  FROM isexy.call_sessions WHERE provider_call_sid = 'CA_TEST_1';
SELECT pg_temp.ok('5 unknown CallSid reported', r->>'error' = 'session_not_found', r::text)
  FROM (SELECT isexy.apply_twilio_call_status('CA_NOPE', 'completed', 1) r) x;
RESET ROLE;

SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000c');
INSERT INTO isexy.phone_line_numbers (profile_id, phone_number_e164, phone_verified)
VALUES ('ca110000-0000-4000-8000-00000000000c', '+15145550123', true);
SELECT pg_temp.ok('5 a member cannot mark their own number verified (insert)', bool_and(NOT phone_verified), string_agg(phone_verified::text, ','))
  FROM isexy.phone_line_numbers WHERE profile_id = 'ca110000-0000-4000-8000-00000000000c';
UPDATE isexy.phone_line_numbers SET phone_verified = true WHERE profile_id = 'ca110000-0000-4000-8000-00000000000c';
SELECT pg_temp.ok('5 a member cannot mark their own number verified (update)', bool_and(NOT phone_verified), string_agg(phone_verified::text, ','))
  FROM isexy.phone_line_numbers WHERE profile_id = 'ca110000-0000-4000-8000-00000000000c';
SELECT pg_temp.ok('5 no SMS-confirmed phone: link refused', r->>'error' = 'no_verified_phone', r::text)
  FROM (SELECT isexy.link_my_verified_phone() r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.ok('5 member links the phone confirmed at sign-in', (r->>'success')::boolean AND r->>'phone_masked' LIKE '+1%0123', r::text)
  FROM (SELECT isexy.link_my_verified_phone() r) x;
SELECT pg_temp.ok('5 linked number is verified for the IVR', bool_and(phone_verified AND phone_number_e164 = '+15145550123'), string_agg(phone_number_e164, ','))
  FROM isexy.phone_line_numbers WHERE profile_id = 'ca110000-0000-4000-8000-00000000000d';
SELECT pg_temp.ok('5 non-admin cannot use the admin link helper', r->>'error' = 'not_authorized', r::text)
  FROM (SELECT isexy.link_my_phone_line_number('+15145559999') r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000e');
SELECT pg_temp.ok('5 admin links a test number (no missing columns)', (r->>'success')::boolean, r::text)
  FROM (SELECT isexy.link_my_phone_line_number('+15145550123') r) x;
RESET ROLE;
SELECT pg_temp.ok('5 the number moved to the admin; the old link is kept but unverified (no delete)',
  count(*) FILTER (WHERE phone_verified) = 1
  AND bool_or(phone_verified AND profile_id = 'ca110000-0000-4000-8000-00000000000e')
  AND count(*) FILTER (WHERE profile_id = 'ca110000-0000-4000-8000-00000000000d') = 1,
  count(*)::text)
  FROM isexy.phone_line_numbers WHERE phone_number_e164 = '+15145550123';

-- 6. Moderation state -----------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
INSERT INTO isexy.voice_greetings (id, phone_line_profile_id, profile_id, audio_url, duration_seconds, moderation_status)
VALUES ('ca11c000-0000-4000-8000-000000000001', 'ca11b000-0000-4000-8000-000000000001', 'ca110000-0000-4000-8000-00000000000b',
        'ca110000-0000-4000-8000-00000000000b/g1.wav', 20, 'approved');
SELECT pg_temp.ok('6 owner cannot self-approve a new greeting', bool_and(moderation_status = 'pending'), string_agg(moderation_status, ','))
  FROM isexy.voice_greetings WHERE id = 'ca11c000-0000-4000-8000-000000000001';
UPDATE isexy.voice_greetings SET moderation_status = 'approved' WHERE id = 'ca11c000-0000-4000-8000-000000000001';
SELECT pg_temp.ok('6 owner cannot approve it by update', bool_and(moderation_status = 'pending'), string_agg(moderation_status, ','))
  FROM isexy.voice_greetings WHERE id = 'ca11c000-0000-4000-8000-000000000001';
SELECT pg_temp.ok('6 owner cannot review', r->>'error' = 'not_authorized', r::text)
  FROM (SELECT isexy.review_voice_greeting('ca11c000-0000-4000-8000-000000000001', true, NULL) r) x;
DO $$ BEGIN
  PERFORM * FROM isexy.get_voice_greetings_for_review(10);
  PERFORM pg_temp.ok('6 members cannot read the review queue', false, 'read');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.ok('6 members cannot read the review queue', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000e');
SELECT pg_temp.ok('6 staff see the pending greeting in the queue', count(*) = 1 AND bool_and(display_name = 'Bee'), count(*)::text)
  FROM isexy.get_voice_greetings_for_review(10) WHERE greeting_id = 'ca11c000-0000-4000-8000-000000000001';
SELECT pg_temp.ok('6 staff approve', r->>'moderation_status' = 'approved', r::text)
  FROM (SELECT isexy.review_voice_greeting('ca11c000-0000-4000-8000-000000000001', true, NULL) r) x;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
SELECT pg_temp.ok('6 approved greeting of a live profile is visible to members', count(*) = 1, count(*)::text)
  FROM isexy.voice_greetings WHERE id = 'ca11c000-0000-4000-8000-000000000001';
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
UPDATE isexy.voice_greetings SET audio_url = 'ca110000-0000-4000-8000-00000000000b/g2.wav' WHERE id = 'ca11c000-0000-4000-8000-000000000001';
SELECT pg_temp.ok('6 new audio goes back to review', bool_and(moderation_status = 'pending'), string_agg(moderation_status, ','))
  FROM isexy.voice_greetings WHERE id = 'ca11c000-0000-4000-8000-000000000001';
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000e');
SELECT pg_temp.ok('6 staff reject with a reason', r->>'moderation_status' = 'rejected', r::text)
  FROM (SELECT isexy.review_voice_greeting('ca11c000-0000-4000-8000-000000000001', false, 'Too quiet') r) x;

SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000d');
INSERT INTO isexy.phone_line_voice_replies (id, from_profile_id, to_profile_id, audio_url, duration_seconds, moderation_status)
VALUES ('ca11d000-0000-4000-8000-000000000001', 'ca110000-0000-4000-8000-00000000000d', 'ca110000-0000-4000-8000-00000000000b',
        'ca110000-0000-4000-8000-00000000000d/r1.wav', 12, 'approved');
SELECT pg_temp.ok('6 sender cannot self-approve a voice reply', bool_and(moderation_status = 'pending'), string_agg(moderation_status, ','))
  FROM isexy.phone_line_voice_replies WHERE id = 'ca11d000-0000-4000-8000-000000000001';

SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
UPDATE isexy.phone_line_profiles SET age = 99 WHERE id = 'ca11b000-0000-4000-8000-000000000001';
SELECT pg_temp.ok('6 voice profile age comes from the birth date', bool_and(age = date_part('year', age(current_date, '1991-05-01'::date))::int), string_agg(age::text, ','))
  FROM isexy.phone_line_profiles WHERE id = 'ca11b000-0000-4000-8000-000000000001';
RESET ROLE;
UPDATE isexy.phone_line_profiles SET status = 'banned', is_public = false WHERE id = 'ca11b000-0000-4000-8000-000000000001';
SET ROLE authenticated;
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000b');
UPDATE isexy.phone_line_profiles SET status = 'draft', is_public = true WHERE id = 'ca11b000-0000-4000-8000-000000000001';
SELECT pg_temp.ok('6 a banned voice profile stays banned and hidden', bool_and(status = 'banned' AND NOT is_public), string_agg(status, ','))
  FROM isexy.phone_line_profiles WHERE id = 'ca11b000-0000-4000-8000-000000000001';
DO $$ BEGIN
  DELETE FROM isexy.phone_line_profiles WHERE id = 'ca11b000-0000-4000-8000-000000000001';
  PERFORM pg_temp.ok('6 a banned voice profile cannot be deleted to start over', false, 'deleted');
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM pg_temp.ok('6 a banned voice profile cannot be deleted to start over', true, SQLERRM);
END $$;

SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000e');
SELECT pg_temp.ok('6 admins read in-app call sessions (AdminCallTests)', count(*) >= 6, count(*)::text)
  FROM isexy.video_call_sessions WHERE match_id = 'ca11a000-0000-4000-8000-000000000001';
SELECT pg_temp.as_user('ca110000-0000-4000-8000-00000000000c');
SELECT pg_temp.ok('6 outsiders read none', count(*) = 0, count(*)::text)
  FROM isexy.video_call_sessions WHERE match_id = 'ca11a000-0000-4000-8000-000000000001';
RESET ROLE;

-- Report ------------------------------------------------------------------------
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, left(detail, 90) AS detail FROM results ORDER BY n;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM results WHERE NOT ok) THEN
    RAISE EXCEPTION 'calls smoke tests failed: %', (SELECT string_agg(name, '; ') FROM results WHERE NOT ok);
  END IF;
  RAISE WARNING 'all % calls smoke tests passed', (SELECT count(*) FROM results);
END $$;
