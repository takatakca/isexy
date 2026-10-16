-- Smoke tests for the trust area SQL (docs/handoff/trust.sql: moderation,
-- reports, blocks, support tickets, staff RPCs).
-- Run on a THROWAWAY local Postgres only (never on V1), after:
--   psql "$ISEXY_DB_URL" -f scripts/isexy/test/v1-mock.sql
--   scripts/isexy/migrate.sh --apply
--   psql "$ISEXY_DB_URL" -f docs/handoff/trust.sql   # until it is folded into a migration
-- then (everything is rolled back):
--   printf 'BEGIN;\n\\i scripts/isexy/test/trust-smoke.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q
-- Fake members call each RPC / table as the authenticated and anon roles with
-- request.jwt.claim(s) set; allowed and forbidden calls for each.
\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE TEMP TABLE results (name text, ok boolean, detail text);
GRANT ALL ON results TO authenticated, anon;

-- Test people ----------------------------------------------------------------
-- A, B, C members (A-B matched), M moderator, X admin, G member who blocks A
INSERT INTO auth.users (id, email, phone) VALUES
 ('dddddddd-0000-0000-0000-00000000000a', 'ta@test.ca', '+15145551001'),
 ('dddddddd-0000-0000-0000-00000000000b', 'tb@test.ca', '+15145551002'),
 ('dddddddd-0000-0000-0000-00000000000c', 'tc@test.ca', '+15145551003'),
 ('dddddddd-0000-0000-0000-00000000000d', 'tm@test.ca', '+15145551004'),
 ('dddddddd-0000-0000-0000-00000000000e', 'tx@test.ca', '+15145551005'),
 ('dddddddd-0000-0000-0000-00000000000f', 'tg@test.ca', '+15145551006');

INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, interested_in, is_active)
VALUES
 ('dddddddd-0000-0000-0000-00000000000a', 'Ana',  '1990-01-01', 'woman', ARRAY['everyone'], true),
 ('dddddddd-0000-0000-0000-00000000000b', 'Ben',  '1991-01-01', 'man',   ARRAY['everyone'], true),
 ('dddddddd-0000-0000-0000-00000000000c', 'Cleo', '1992-01-01', 'woman', ARRAY['everyone'], true),
 ('dddddddd-0000-0000-0000-00000000000d', 'Mod',  '1985-01-01', 'woman', ARRAY['everyone'], true),
 ('dddddddd-0000-0000-0000-00000000000e', 'Xan',  '1984-01-01', 'man',   ARRAY['everyone'], true),
 ('dddddddd-0000-0000-0000-00000000000f', 'Gil',  '1993-01-01', 'man',   ARRAY['everyone'], true);
INSERT INTO isexy.user_roles (user_id, role) VALUES
 ('dddddddd-0000-0000-0000-00000000000d', 'moderator'),
 ('dddddddd-0000-0000-0000-00000000000e', 'admin');

INSERT INTO isexy.matches (id, profile1_id, profile2_id, is_active) VALUES
 ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000b', true),
 ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000f', true);

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, false),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false),
         set_config('request.jwt.claim.role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.as_user_email(p_uid text, p_email text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, false),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'email', p_email)::text, false),
         set_config('request.jwt.claim.role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', '', false),
         set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false),
         set_config('request.jwt.claim.role', 'anon', false);
$$;

-- T1 moderation --------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
INSERT INTO results SELECT 'T1 member starts unrestricted',
  (isexy.get_my_moderation_status() ->> 'restricted')::boolean = false, isexy.get_my_moderation_status()::text;
INSERT INTO isexy.messages (match_id, sender_id, content)
VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000a', 'I want to go tonight');
INSERT INTO results SELECT 'T1 unrestricted member can send', count(*) = 1, count(*)::text
  FROM isexy.messages WHERE match_id = 'eeeeeeee-0000-0000-0000-000000000001';

INSERT INTO results SELECT 'T1 first strike = 24 h restriction',
  (r ->> 'new_strike')::boolean AND (r ->> 'level')::int = 1 AND NOT (r ->> 'permanent')::boolean
    AND (r ->> 'until')::timestamptz BETWEEN now() + interval '23 hours' AND now() + interval '25 hours', r::text
  FROM (SELECT isexy.record_contact_sharing(ARRAY['phone_number', 'bogus'], '514 555 0100',
                                            'eeeeeeee-0000-0000-0000-000000000001') AS r) s;
INSERT INTO results SELECT 'T1 status says restricted',
  (isexy.get_my_moderation_status() ->> 'restricted')::boolean, isexy.get_my_moderation_status()::text;
DO $$ BEGIN
  INSERT INTO isexy.messages (match_id, sender_id, content)
  VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000a', 'hello again');
  INSERT INTO results VALUES ('T1 restricted member cannot send', false, 'insert succeeded');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO results VALUES ('T1 restricted member cannot send', SQLERRM LIKE '%restricted%', SQLERRM);
END $$;
INSERT INTO results SELECT 'T1 attempt while restricted adds no strike',
  NOT (r ->> 'new_strike')::boolean AND (r ->> 'level')::int = 1, r::text
  FROM (SELECT isexy.record_contact_sharing(ARRAY['email'], 'a@b.ca', NULL) AS r) s;
DO $$ BEGIN
  PERFORM isexy.record_contact_sharing(ARRAY['nope'], NULL, NULL);
  INSERT INTO results VALUES ('T1 unknown type refused', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T1 unknown type refused', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM 1 FROM isexy.user_warnings;
  INSERT INTO results SELECT 'T1 member still cannot read user_warnings', count(*) = 0, count(*)::text FROM isexy.user_warnings;
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000b');
INSERT INTO isexy.messages (match_id, sender_id, content)
VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000b', 'hi Ana');
INSERT INTO results SELECT 'T1 the other member can still send', count(*) = 1, count(*)::text
  FROM isexy.messages WHERE sender_id = 'dddddddd-0000-0000-0000-00000000000b';
RESET ROLE;
INSERT INTO results SELECT 'T1 violations recorded for the caller only (bogus type dropped)',
  count(*) = 2 AND bool_and(profile_id = 'dddddddd-0000-0000-0000-00000000000a'), string_agg(violation_type, ',')
  FROM isexy.content_violations WHERE profile_id IN ('dddddddd-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000b');
-- Second and third strikes (after the first one expires).
UPDATE isexy.user_warnings SET ban_until = now() - interval '1 minute'
 WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000a';
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
INSERT INTO results SELECT 'T1 second strike = 7 days',
  (r ->> 'level')::int = 2 AND (r ->> 'until')::timestamptz > now() + interval '6 days', r::text
  FROM (SELECT isexy.record_contact_sharing(ARRAY['social_media'], 'ig: ana', NULL) AS r) s;
RESET ROLE;
UPDATE isexy.user_warnings SET ban_until = now() - interval '1 minute'
 WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000a';
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
INSERT INTO results SELECT 'T1 third strike = permanent',
  (r ->> 'level')::int = 3 AND (r ->> 'permanent')::boolean, r::text
  FROM (SELECT isexy.record_contact_sharing(ARRAY['email'], 'x@y.ca', NULL) AS r) s;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.as_anon();
DO $$ BEGIN
  PERFORM isexy.record_contact_sharing(ARRAY['email'], NULL, NULL);
  INSERT INTO results VALUES ('T1 anon refused', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T1 anon refused', true, SQLERRM);
END $$;
RESET ROLE;
-- Clean slate for the next parts (rolled back anyway).
UPDATE isexy.user_warnings SET lifted_at = now() WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000a';

-- T2 blocks and reports -------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000f');  -- Gil blocks Ana
INSERT INTO results SELECT 'T2 block_member blocks', (r ->> 'blocked')::boolean AND NOT (r ->> 'already')::boolean, r::text
  FROM (SELECT isexy.block_member('dddddddd-0000-0000-0000-00000000000a') AS r) s;
INSERT INTO results SELECT 'T2 blocking twice is fine (already)', (r ->> 'already')::boolean, r::text
  FROM (SELECT isexy.block_member('dddddddd-0000-0000-0000-00000000000a') AS r) s;
DO $$ BEGIN
  PERFORM isexy.block_member('dddddddd-0000-0000-0000-00000000000f');
  INSERT INTO results VALUES ('T2 cannot block yourself', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T2 cannot block yourself', true, SQLERRM);
END $$;
INSERT INTO results SELECT 'T2 the blocker still sees the blocked profile (to unblock)', count(*) = 1, count(*)::text
  FROM isexy.profiles WHERE id = 'dddddddd-0000-0000-0000-00000000000a';
INSERT INTO results SELECT 'T2 hidden ids of the blocker', isexy.get_my_hidden_member_ids() = ARRAY['dddddddd-0000-0000-0000-00000000000a']::uuid[],
  isexy.get_my_hidden_member_ids()::text;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
INSERT INTO results SELECT 'T2 a blocked member cannot read the blocker''s profile', count(*) = 0, count(*)::text
  FROM isexy.profiles WHERE id = 'dddddddd-0000-0000-0000-00000000000f';
INSERT INTO results SELECT 'T2 other profiles still visible', count(*) = 4, string_agg(first_name, ',')
  FROM isexy.profiles WHERE id IN ('dddddddd-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000b',
                                   'dddddddd-0000-0000-0000-00000000000c', 'dddddddd-0000-0000-0000-00000000000d');
INSERT INTO results SELECT 'T2 hidden ids of the blocked member', isexy.get_my_hidden_member_ids() = ARRAY['dddddddd-0000-0000-0000-00000000000f']::uuid[],
  isexy.get_my_hidden_member_ids()::text;
DO $$ BEGIN
  INSERT INTO isexy.messages (match_id, sender_id, content)
  VALUES ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000a', 'hi Gil');
  INSERT INTO results VALUES ('T2 no message to someone who blocked you', false, 'insert succeeded');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO results VALUES ('T2 no message to someone who blocked you', SQLERRM LIKE '%blocked%', SQLERRM);
END $$;
RESET ROLE;
UPDATE isexy.profiles SET is_active = false WHERE id = 'dddddddd-0000-0000-0000-00000000000a';
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
INSERT INTO results SELECT 'T2 a suspended member still reads their own profile', count(*) = 1 AND NOT bool_and(is_active), count(*)::text
  FROM isexy.profiles WHERE user_id = 'dddddddd-0000-0000-0000-00000000000a';
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000b');
INSERT INTO results SELECT 'T2 others do not see a suspended member', count(*) = 0, count(*)::text
  FROM isexy.profiles WHERE id = 'dddddddd-0000-0000-0000-00000000000a';
RESET ROLE;
UPDATE isexy.profiles SET is_active = true WHERE id = 'dddddddd-0000-0000-0000-00000000000a';

SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');  -- Ana reports Cleo
INSERT INTO results SELECT 'T2 report + block',
  (r ->> 'report_id') IS NOT NULL AND NOT (r ->> 'duplicate')::boolean AND (r ->> 'blocked')::boolean, r::text
  FROM (SELECT isexy.report_member('dddddddd-0000-0000-0000-00000000000c', 'scam', 'asked for gift cards', true, 'chat') AS r) s;
INSERT INTO results SELECT 'T2 second report on the same member joins the first',
  (r ->> 'duplicate')::boolean, r::text
  FROM (SELECT isexy.report_member('dddddddd-0000-0000-0000-00000000000c', 'harassment', 'and insults', false, 'profile') AS r) s;
INSERT INTO results SELECT 'T2 reporter sees one report with both details',
  count(*) = 1 AND bool_and(description LIKE '%gift cards%and insults%'), max(description)
  FROM isexy.reports WHERE reported_id = 'dddddddd-0000-0000-0000-00000000000c';
INSERT INTO results SELECT 'T2 the block was made', count(*) = 1, count(*)::text
  FROM isexy.blocks WHERE blocker_id = 'dddddddd-0000-0000-0000-00000000000a' AND blocked_id = 'dddddddd-0000-0000-0000-00000000000c';
DO $$ BEGIN
  PERFORM isexy.report_member('dddddddd-0000-0000-0000-00000000000a', 'spam', NULL, false, NULL);
  INSERT INTO results VALUES ('T2 cannot report yourself', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T2 cannot report yourself', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM isexy.report_member('dddddddd-0000-0000-0000-00000000000b', 'i dont like them', NULL, false, NULL);
  INSERT INTO results VALUES ('T2 unknown reason refused', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T2 unknown reason refused', true, SQLERRM);
END $$;
RESET ROLE;
INSERT INTO isexy.reports (reporter_id, reported_id, reason, status)
SELECT 'dddddddd-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000d', 'spam', 'dismissed'
  FROM generate_series(1, 20);
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
DO $$ BEGIN
  PERFORM isexy.report_member('dddddddd-0000-0000-0000-00000000000b', 'spam', NULL, false, NULL);
  INSERT INTO results VALUES ('T2 at most 20 reports a day', false, 'call succeeded');
EXCEPTION WHEN program_limit_exceeded THEN
  INSERT INTO results VALUES ('T2 at most 20 reports a day', true, SQLERRM);
END $$;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.as_anon();
DO $$ BEGIN
  PERFORM isexy.report_member('dddddddd-0000-0000-0000-00000000000b', 'spam', NULL, false, NULL);
  INSERT INTO results VALUES ('T2 anon cannot report', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T2 anon cannot report', true, SQLERRM);
END $$;
INSERT INTO results SELECT 'T2 anon reads no profiles', count(*) = 0, count(*)::text FROM isexy.profiles;
RESET ROLE;

-- T3 support tickets ---------------------------------------------------------
SET ROLE anon;
SELECT pg_temp.as_anon();
INSERT INTO isexy.support_tickets (ticket_number, name, email, subject, category, priority, message)
VALUES ('IS-GUEST1', 'Guest', 'Guest@Example.ca', 'Cannot sign in', 'account', 'medium', 'help');
INSERT INTO results SELECT 'T3 guest tracks a ticket with number + email', count(*) = 1 AND max(status) = 'open', count(*)::text
  FROM isexy.get_ticket_status(' is-guest1 ', 'guest@example.ca');
INSERT INTO results SELECT 'T3 wrong email finds nothing', count(*) = 0, count(*)::text
  FROM isexy.get_ticket_status('IS-GUEST1', 'other@example.ca');
INSERT INTO results SELECT 'T3 guests cannot list tickets', count(*) = 0, count(*)::text FROM isexy.support_tickets;
INSERT INTO isexy.support_tickets (ticket_number, name, email, subject, category, priority, message)
VALUES ('IS-ANA001', 'Ana', 'TA@test.ca', 'Sent before signing in', 'account', 'low', 'hello');
RESET ROLE;
SET ROLE authenticated;
SELECT pg_temp.as_user_email('dddddddd-0000-0000-0000-00000000000a', 'ta@test.ca');
INSERT INTO results SELECT 'T3 member reads tickets sent from their sign-in e-mail (no auth.users read)', count(*) = 1, string_agg(ticket_number, ',')
  FROM isexy.support_tickets;
RESET ROLE;
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000b');
INSERT INTO isexy.support_tickets (ticket_number, user_id, name, email, subject, category, priority, message)
VALUES ('IS-BEN001', 'dddddddd-0000-0000-0000-00000000000b', 'Ben', 'tb@test.ca', 'Billing', 'billing', 'high', 'charged twice');
UPDATE isexy.support_tickets SET status = 'resolved', response = 'self-answered', admin_notes = 'x' WHERE ticket_number = 'IS-BEN001';
INSERT INTO results SELECT 'T3 member cannot change their own ticket', bool_and(status = 'open' AND response IS NULL), max(status)
  FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001';
INSERT INTO results SELECT 'T3 member sees only their own tickets', count(*) = 1, string_agg(ticket_number, ',') FROM isexy.support_tickets;
DO $$ BEGIN
  PERFORM isexy.staff_update_ticket((SELECT id FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001'), 'resolved', 'done', NULL, NULL, false);
  INSERT INTO results VALUES ('T3 member cannot use the staff ticket RPC', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T3 member cannot use the staff ticket RPC', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');  -- moderator
INSERT INTO results SELECT 'T3 moderator sees every ticket', count(*) >= 2, count(*)::text
  FROM isexy.support_tickets WHERE ticket_number IN ('IS-GUEST1', 'IS-BEN001');
INSERT INTO results SELECT 'T3 moderator answers a ticket',
  (r ->> 'notify')::boolean AND r ->> 'old_status' = 'open' AND r ->> 'new_status' = 'in_progress' AND (r ->> 'responded')::boolean, r::text
  FROM (SELECT isexy.staff_update_ticket((SELECT id FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001'),
          'in_progress', 'We are refunding the second charge.', 'checked Stripe', 'dddddddd-0000-0000-0000-00000000000e', true) AS r) s;
INSERT INTO results SELECT 'T3 note, response and assignee saved',
  admin_notes LIKE '%Mod] checked Stripe' AND response LIKE 'We are refunding%' AND responded_at IS NOT NULL
    AND assigned_to = 'dddddddd-0000-0000-0000-00000000000e', admin_notes
  FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001';
INSERT INTO results SELECT 'T3 a note alone does not notify', NOT (r ->> 'notify')::boolean, r::text
  FROM (SELECT isexy.staff_update_ticket((SELECT id FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001'),
          NULL, NULL, 'second note', NULL, false) AS r) s;
DO $$ BEGIN
  PERFORM isexy.staff_update_ticket((SELECT id FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001'), 'investigating', NULL, NULL, NULL, false);
  INSERT INTO results VALUES ('T3 unknown status refused', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T3 unknown status refused', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM isexy.staff_update_ticket((SELECT id FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001'), NULL, NULL, NULL, 'dddddddd-0000-0000-0000-00000000000b', true);
  INSERT INTO results VALUES ('T3 cannot assign to a member', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T3 cannot assign to a member', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000e');  -- admin
INSERT INTO results SELECT 'T3 bulk update reports the status changes',
  (r ->> 'updated')::int = 2 AND jsonb_array_length(r -> 'status_changed') = 2, r::text
  FROM (SELECT isexy.staff_bulk_update_tickets(ARRAY(SELECT id FROM isexy.support_tickets WHERE ticket_number IN ('IS-GUEST1', 'IS-BEN001')),
          'resolved', NULL, false) AS r) s;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.as_anon();
INSERT INTO results SELECT 'T3 the guest sees the new status', max(status) = 'resolved', max(status)
  FROM isexy.get_ticket_status('IS-GUEST1', 'guest@example.ca');
RESET ROLE;

-- @@PARTS@@

-- Report ---------------------------------------------------------------------
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, detail FROM results;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM results WHERE NOT ok) THEN RAISE EXCEPTION 'trust smoke tests failed'; END IF;
  RAISE NOTICE 'all % trust smoke tests passed', (SELECT count(*) FROM results);
END $$;
