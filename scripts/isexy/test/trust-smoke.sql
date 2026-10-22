-- Smoke tests for 0015_trust_and_moderation.sql (moderation, reports,
-- blocks, support tickets, live chat, staff RPCs and audit log; T9: a
-- malicious member and a malicious moderator).
-- Run on a THROWAWAY local Postgres only (never on V1), after:
--   psql "$ISEXY_DB_URL" -f scripts/isexy/test/v1-mock.sql
--   scripts/isexy/migrate.sh --apply
-- then (everything is rolled back):
--   printf 'BEGIN;\n\\i scripts/isexy/test/trust-smoke.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q -v ON_ERROR_STOP=1
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
VALUES ('IS-ANA001', 'Ana', 'ta@test.ca', 'Sent before signing in', 'account', 'low', 'hello');  -- Contact Us stores e-mails in lower case
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
DO $$ BEGIN
  UPDATE isexy.support_tickets SET status = 'resolved', response = 'self-answered', admin_notes = 'x' WHERE ticket_number = 'IS-BEN001';
  INSERT INTO results VALUES ('T3 member cannot change staff fields of their ticket (main''s 0009)', false, 'update succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T3 member cannot change staff fields of their ticket (main''s 0009)', true, SQLERRM);
END $$;
UPDATE isexy.support_tickets SET message = 'charged twice (card ending 4242)' WHERE ticket_number = 'IS-BEN001';
INSERT INTO results SELECT 'T3 member can still add details to their ticket (main''s 0009)',
  bool_and(status = 'open' AND response IS NULL AND message LIKE '%4242%'), max(status)
  FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001';
INSERT INTO results SELECT 'T3 member sees only their own tickets', count(*) = 1, string_agg(ticket_number, ',') FROM isexy.support_tickets;
DO $$ BEGIN
  PERFORM isexy.staff_update_ticket((SELECT id FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001'), 'resolved', 'done', NULL, NULL, false);
  INSERT INTO results VALUES ('T3 member cannot use the staff ticket RPC', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T3 member cannot use the staff ticket RPC', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');  -- moderator
INSERT INTO results SELECT 'T3 tickets stay admin-only: a moderator reads none', count(*) = 0, count(*)::text
  FROM isexy.support_tickets;
DO $$ BEGIN
  PERFORM isexy.staff_update_ticket((SELECT t.id FROM isexy.support_tickets t LIMIT 1), 'resolved', NULL, NULL, NULL, false);
  INSERT INTO results VALUES ('T3 a moderator cannot update tickets (main''s 0009 rule)', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T3 a moderator cannot update tickets (main''s 0009 rule)', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000e');  -- admin
INSERT INTO results SELECT 'T3 admin sees every ticket', count(*) = 3, count(*)::text
  FROM isexy.support_tickets WHERE ticket_number IN ('IS-GUEST1', 'IS-BEN001', 'IS-ANA001');
INSERT INTO results SELECT 'T3 admin answers a ticket',
  (r ->> 'notify')::boolean AND r ->> 'old_status' = 'open' AND r ->> 'new_status' = 'in_progress' AND (r ->> 'responded')::boolean, r::text
  FROM (SELECT isexy.staff_update_ticket((SELECT id FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001'),
          'in_progress', 'We are refunding the second charge.', 'checked Stripe', 'dddddddd-0000-0000-0000-00000000000e', true) AS r) s;
INSERT INTO results SELECT 'T3 note, response and assignee saved',
  admin_notes LIKE '%Xan] checked Stripe' AND response LIKE 'We are refunding%' AND responded_at IS NOT NULL
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
  PERFORM isexy.staff_update_ticket((SELECT id FROM isexy.support_tickets WHERE ticket_number = 'IS-BEN001'), NULL, NULL, NULL, 'dddddddd-0000-0000-0000-00000000000d', true);
  INSERT INTO results VALUES ('T3 tickets are assigned to admins only', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T3 tickets are assigned to admins only', true, SQLERRM);
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

-- T4 live chat ----------------------------------------------------------------
INSERT INTO isexy.chatbot_conversations (id, user_id, session_id, status)
VALUES ('ffffffff-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000a', 'member_x', 'transferred');
INSERT INTO isexy.chatbot_messages (conversation_id, role, content, created_at) VALUES
 ('ffffffff-0000-0000-0000-000000000001', 'user', 'I was charged twice', now() - interval '2 minutes'),
 ('ffffffff-0000-0000-0000-000000000001', 'assistant', 'Let me get a person', now() - interval '1 minute');
INSERT INTO isexy.live_chat_sessions (id, user_id, status, chatbot_conversation_id)
VALUES ('ffffffff-0000-0000-0000-0000000000a1', 'dddddddd-0000-0000-0000-00000000000a', 'waiting', 'ffffffff-0000-0000-0000-000000000001');
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
VALUES ('ffffffff-0000-0000-0000-0000000000a1', 'user', 'dddddddd-0000-0000-0000-00000000000a', 'hello?');
INSERT INTO results SELECT 'T4 member posts in their waiting session', count(*) = 1, count(*)::text
  FROM isexy.live_chat_messages WHERE session_id = 'ffffffff-0000-0000-0000-0000000000a1';
DO $$ BEGIN
  INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
  VALUES ('ffffffff-0000-0000-0000-0000000000a1', 'agent', 'dddddddd-0000-0000-0000-00000000000a', 'fake agent');
  INSERT INTO results VALUES ('T4 member cannot post as an agent', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T4 member cannot post as an agent', true, SQLERRM);
END $$;
DO $$ BEGIN
  INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
  VALUES ('ffffffff-0000-0000-0000-0000000000a1', 'system', 'dddddddd-0000-0000-0000-00000000000a', 'ISEXY Support joined the chat.');
  INSERT INTO results VALUES ('T4 member cannot post a system line', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T4 member cannot post a system line', true, SQLERRM);
END $$;
DO $$ BEGIN
  INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
  VALUES ('ffffffff-0000-0000-0000-0000000000a1', 'user', NULL, 'no sender');
  INSERT INTO results VALUES ('T4 member messages carry the member as sender', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T4 member messages carry the member as sender', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM isexy.staff_accept_live_chat('ffffffff-0000-0000-0000-0000000000a1');
  INSERT INTO results VALUES ('T4 member cannot accept a chat', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T4 member cannot accept a chat', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000b');
INSERT INTO results SELECT 'T4 other members see neither the session nor its messages',
  (SELECT count(*) FROM isexy.live_chat_sessions) = 0 AND (SELECT count(*) FROM isexy.live_chat_messages) = 0, NULL;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');  -- moderator
INSERT INTO results SELECT 'T4 moderator sees the waiting queue', count(*) = 1, count(*)::text
  FROM isexy.live_chat_sessions WHERE status = 'waiting';
INSERT INTO results SELECT 'T4 moderator reads the assistant transcript', count(*) = 2, string_agg(role, ',')
  FROM isexy.staff_get_live_chat_transcript('ffffffff-0000-0000-0000-0000000000a1');
INSERT INTO results SELECT 'T4 moderator accepts', r.status = 'active' AND r.agent_id = 'dddddddd-0000-0000-0000-00000000000d', r.status
  FROM isexy.staff_accept_live_chat('ffffffff-0000-0000-0000-0000000000a1') r;
INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
VALUES ('ffffffff-0000-0000-0000-0000000000a1', 'agent', 'dddddddd-0000-0000-0000-00000000000d', 'Hi Ana, I can help.');
INSERT INTO results SELECT 'T4 joined message + agent reply', count(*) = 3 AND bool_or(sender_type = 'system' AND content LIKE 'Mod from ISEXY Support joined%'), string_agg(sender_type, ',' ORDER BY created_at)
  FROM isexy.live_chat_messages WHERE session_id = 'ffffffff-0000-0000-0000-0000000000a1';
DO $$ BEGIN
  INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
  VALUES ('ffffffff-0000-0000-0000-0000000000a1', 'user', 'dddddddd-0000-0000-0000-00000000000d', 'as the member');
  INSERT INTO results VALUES ('T4 agent cannot post as the member', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T4 agent cannot post as the member', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000e');  -- admin
DO $$ BEGIN
  PERFORM isexy.staff_accept_live_chat('ffffffff-0000-0000-0000-0000000000a1');
  INSERT INTO results VALUES ('T4 a taken chat cannot be accepted again', false, 'call succeeded');
EXCEPTION WHEN no_data_found THEN
  INSERT INTO results VALUES ('T4 a taken chat cannot be accepted again', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
INSERT INTO results SELECT 'T4 member reads the agent reply', count(*) = 1, count(*)::text
  FROM isexy.live_chat_messages WHERE sender_type = 'agent';
INSERT INTO results SELECT 'T4 member ends the chat', isexy.end_my_live_chat('ffffffff-0000-0000-0000-0000000000a1'), NULL;
DO $$ BEGIN
  INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content)
  VALUES ('ffffffff-0000-0000-0000-0000000000a1', 'user', 'dddddddd-0000-0000-0000-00000000000a', 'after the end');
  INSERT INTO results VALUES ('T4 no member message after the end', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T4 no member message after the end', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');
DO $$ BEGIN
  PERFORM isexy.staff_close_live_chat('ffffffff-0000-0000-0000-0000000000a1');
  INSERT INTO results VALUES ('T4 closing an ended chat is refused', false, 'call succeeded');
EXCEPTION WHEN no_data_found THEN
  INSERT INTO results VALUES ('T4 closing an ended chat is refused', true, SQLERRM);
END $$;
RESET ROLE;

-- T5 reports: staff review, direct inserts ---------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000b');
DO $$ BEGIN
  INSERT INTO isexy.reports (reporter_id, reported_id, reason, status)
  VALUES ('dddddddd-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000c', 'spam', 'resolved');
  INSERT INTO results VALUES ('T5 a report cannot be filed as already resolved', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T5 a report cannot be filed as already resolved', true, SQLERRM);
END $$;
DO $$ BEGIN
  INSERT INTO isexy.reports (reporter_id, reported_id, reason)
  VALUES ('dddddddd-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000b', 'spam');
  INSERT INTO results VALUES ('T5 no direct self-report', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T5 no direct self-report', true, SQLERRM);
END $$;
INSERT INTO isexy.reports (id, reporter_id, reported_id, reason, description)
VALUES ('abababab-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000c', 'spam', 'older app');
INSERT INTO results SELECT 'T5 a plain direct report still works (older clients)', count(*) = 1, count(*)::text
  FROM isexy.reports WHERE id = 'abababab-0000-0000-0000-000000000001';
UPDATE isexy.reports SET status = 'dismissed' WHERE id = 'abababab-0000-0000-0000-000000000001';
INSERT INTO results SELECT 'T5 members cannot change a report', bool_and(coalesce(status, 'pending') = 'pending'), max(status)
  FROM isexy.reports WHERE id = 'abababab-0000-0000-0000-000000000001';
INSERT INTO results SELECT 'T5 members see only their own reports', count(*) = 1, count(*)::text FROM isexy.reports;
DO $$ BEGIN
  PERFORM isexy.staff_resolve_report('abababab-0000-0000-0000-000000000001', 'dismissed', NULL);
  INSERT INTO results VALUES ('T5 members cannot use the staff report RPC', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T5 members cannot use the staff report RPC', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');  -- moderator
INSERT INTO results SELECT 'T5 a moderator sees every report about members (not the 20 about themselves: admins only)', count(*) = 2, count(*)::text FROM isexy.reports;
INSERT INTO results SELECT 'T5 staff join reporter and reported names', count(*) = 1 AND max(rp.first_name) = 'Ben' AND max(rd.first_name) = 'Cleo', NULL
  FROM isexy.reports r JOIN isexy.profiles rp ON rp.id = r.reporter_id JOIN isexy.profiles rd ON rd.id = r.reported_id
 WHERE r.id = 'abababab-0000-0000-0000-000000000001';
INSERT INTO results SELECT 'T5 moderator resolves a report',
  r ->> 'old_status' = 'pending' AND r ->> 'status' = 'resolved', r::text
  FROM (SELECT isexy.staff_resolve_report('abababab-0000-0000-0000-000000000001', 'resolved', 'warned the member') AS r) s;
INSERT INTO results SELECT 'T5 report keeps its row with reviewer and note',
  status = 'resolved' AND reviewed_by = 'dddddddd-0000-0000-0000-00000000000d' AND reviewed_at IS NOT NULL AND resolution_note = 'warned the member', status
  FROM isexy.reports WHERE id = 'abababab-0000-0000-0000-000000000001';
DO $$ BEGIN
  PERFORM isexy.staff_resolve_report('abababab-0000-0000-0000-000000000001', 'deleted', NULL);
  INSERT INTO results VALUES ('T5 unknown report status refused', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T5 unknown report status refused', true, SQLERRM);
END $$;
RESET ROLE;

-- T6 staff moderation -----------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000c');  -- member Cleo
DO $$ BEGIN
  PERFORM isexy.staff_issue_warning('dddddddd-0000-0000-0000-00000000000b', 'spam', '24h', 'x');
  INSERT INTO results VALUES ('T6 members cannot warn', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 members cannot warn', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM isexy.staff_set_account_active('dddddddd-0000-0000-0000-00000000000b', false, 'x');
  INSERT INTO results VALUES ('T6 members cannot suspend', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 members cannot suspend', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM isexy.staff_set_shadow_ban('dddddddd-0000-0000-0000-00000000000b', true, 'x');
  INSERT INTO results VALUES ('T6 members cannot shadow ban', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 members cannot shadow ban', true, SQLERRM);
END $$;
DO $$ BEGIN
  UPDATE isexy.profiles SET shadow_banned = true WHERE id = 'dddddddd-0000-0000-0000-00000000000c';
  INSERT INTO results VALUES ('T6 members still cannot write protected columns (0014 A1)', false, 'update succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 members still cannot write protected columns (0014 A1)', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');  -- moderator
INSERT INTO results SELECT 'T6 moderator warns with a 24 h restriction',
  (r ->> 'level')::int = 1 AND (r ->> 'until')::timestamptz > now() + interval '23 hours', r::text
  FROM (SELECT isexy.staff_issue_warning('dddddddd-0000-0000-0000-00000000000b', 'harassment', '24h', 'insults in chat') AS r) s;
INSERT INTO results SELECT 'T6 the warning names the moderator as issuer', count(*) = 1, count(*)::text
  FROM isexy.user_warnings WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000b' AND issued_by = 'dddddddd-0000-0000-0000-00000000000d'
   AND warning_type = 'harassment' AND evidence LIKE '%insults in chat%';
DO $$ BEGIN
  PERFORM isexy.staff_issue_warning('dddddddd-0000-0000-0000-00000000000b', 'manual_ban', 'none', NULL);
  INSERT INTO results VALUES ('T6 unknown warning type refused', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T6 unknown warning type refused', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM isexy.staff_issue_warning('dddddddd-0000-0000-0000-00000000000e', 'other', 'permanent', NULL);
  INSERT INTO results VALUES ('T6 a moderator cannot act on an admin', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 a moderator cannot act on an admin', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM isexy.staff_set_account_active('dddddddd-0000-0000-0000-00000000000d', false, 'testing');
  INSERT INTO results VALUES ('T6 staff cannot act on themselves', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 staff cannot act on themselves', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000b');  -- Ben, restricted
INSERT INTO results SELECT 'T6 the member sees the restriction', (isexy.get_my_moderation_status() ->> 'restricted')::boolean,
  isexy.get_my_moderation_status()::text;
DO $$ BEGIN
  INSERT INTO isexy.messages (match_id, sender_id, content)
  VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000b', 'still here');
  INSERT INTO results VALUES ('T6 a restricted member cannot send', false, 'insert succeeded');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO results VALUES ('T6 a restricted member cannot send', SQLERRM LIKE '%restricted%', SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');
INSERT INTO results SELECT 'T6 moderator lifts the restriction', isexy.staff_lift_restrictions('dddddddd-0000-0000-0000-00000000000b', 'mistake: it was a joke between friends') = 1, NULL;
INSERT INTO results SELECT 'T6 the lifted warning keeps its row', count(*) = 1 AND bool_and(lifted_at IS NOT NULL AND lifted_by = 'dddddddd-0000-0000-0000-00000000000d'), count(*)::text
  FROM isexy.user_warnings WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000b';
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000b');
INSERT INTO isexy.messages (match_id, sender_id, content)
VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000b', 'sorry');
INSERT INTO results SELECT 'T6 after the lift the member can send', count(*) = 1, count(*)::text
  FROM isexy.messages WHERE sender_id = 'dddddddd-0000-0000-0000-00000000000b' AND content = 'sorry';
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');
INSERT INTO results SELECT 'T6 shadow ban', (r ->> 'shadow_banned')::boolean, r::text
  FROM (SELECT isexy.staff_set_shadow_ban('dddddddd-0000-0000-0000-00000000000c', true, 'fake photos') AS r) s;
INSERT INTO results SELECT 'T6 shadow ban fields set', shadow_banned AND shadow_banned_at IS NOT NULL AND shadow_banned_reason = 'fake photos', NULL
  FROM isexy.profiles WHERE id = 'dddddddd-0000-0000-0000-00000000000c';
DO $$ BEGIN
  PERFORM isexy.staff_set_account_active('dddddddd-0000-0000-0000-00000000000b', false, '  ');
  INSERT INTO results VALUES ('T6 suspension needs a reason', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T6 suspension needs a reason', true, SQLERRM);
END $$;
INSERT INTO results SELECT 'T6 moderator suspends', NOT (r ->> 'is_active')::boolean, r::text
  FROM (SELECT isexy.staff_set_account_active('dddddddd-0000-0000-0000-00000000000b', false, 'repeated harassment') AS r) s;
INSERT INTO results SELECT 'T6 staff still see the suspended member', count(*) = 1, count(*)::text
  FROM isexy.profiles WHERE id = 'dddddddd-0000-0000-0000-00000000000b' AND is_active = false;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000c');
INSERT INTO results SELECT 'T6 members no longer see the suspended member', count(*) = 0, count(*)::text
  FROM isexy.profiles WHERE id = 'dddddddd-0000-0000-0000-00000000000b';
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000b');
DO $$ BEGIN
  INSERT INTO isexy.messages (match_id, sender_id, content)
  VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000b', 'suspended hello');
  INSERT INTO results VALUES ('T6 a suspended member cannot send', false, 'insert succeeded');
EXCEPTION WHEN raise_exception THEN
  INSERT INTO results VALUES ('T6 a suspended member cannot send', SQLERRM LIKE '%suspended%', SQLERRM);
END $$;
DO $$ BEGIN
  UPDATE isexy.profiles SET is_active = true WHERE user_id = 'dddddddd-0000-0000-0000-00000000000b';
  INSERT INTO results VALUES ('T6 a suspended member cannot reinstate themselves', false, 'update succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 a suspended member cannot reinstate themselves', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');
INSERT INTO results SELECT 'T6 moderator reinstates', (r ->> 'is_active')::boolean, r::text
  FROM (SELECT isexy.staff_set_account_active('dddddddd-0000-0000-0000-00000000000b', true, NULL) AS r) s;
DO $$ BEGIN
  PERFORM isexy.staff_update_profile('dddddddd-0000-0000-0000-00000000000c', NULL, '', NULL);
  INSERT INTO results VALUES ('T6 a profile edit needs a reason', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO results VALUES ('T6 a profile edit needs a reason', true, SQLERRM);
END $$;
INSERT INTO results SELECT 'T6 staff clears an offensive bio', (r ->> 'updated')::boolean, r::text
  FROM (SELECT isexy.staff_update_profile('dddddddd-0000-0000-0000-00000000000c', NULL, '', 'offensive bio') AS r) s;
INSERT INTO results SELECT 'T6 bio cleared, name kept', bio IS NULL AND first_name = 'Cleo', first_name
  FROM isexy.profiles WHERE id = 'dddddddd-0000-0000-0000-00000000000c';
INSERT INTO results SELECT 'T6 staff verify a member (0013 RPC, moderators allowed)', true, NULL
  FROM (SELECT isexy.staff_set_profile_verified('dddddddd-0000-0000-0000-00000000000c', true)) s;
DO $$ BEGIN
  PERFORM isexy.staff_list_roles(ARRAY['dddddddd-0000-0000-0000-00000000000e']::uuid[]);
  INSERT INTO results VALUES ('T6 moderators cannot list roles', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 moderators cannot list roles', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM isexy.staff_grant_role('dddddddd-0000-0000-0000-00000000000c', 'moderator');
  INSERT INTO results VALUES ('T6 moderators cannot grant roles', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 moderators cannot grant roles', true, SQLERRM);
END $$;
INSERT INTO results SELECT 'T6 moderators cannot read the audit log', count(*) = 0, count(*)::text FROM isexy.staff_actions;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000e');  -- admin
INSERT INTO results SELECT 'T6 admin grants moderator', NOT (r ->> 'already')::boolean, r::text
  FROM (SELECT isexy.staff_grant_role('dddddddd-0000-0000-0000-00000000000c', 'moderator') AS r) s;
INSERT INTO results SELECT 'T6 granting twice is fine', (r ->> 'already')::boolean, r::text
  FROM (SELECT isexy.staff_grant_role('dddddddd-0000-0000-0000-00000000000c', 'moderator') AS r) s;
INSERT INTO results SELECT 'T6 admin lists roles', count(*) = 2, string_agg(role::text, ',')
  FROM isexy.staff_list_roles(ARRAY['dddddddd-0000-0000-0000-00000000000c', 'dddddddd-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000e']::uuid[]);
DO $$ BEGIN
  PERFORM isexy.staff_set_shadow_ban('dddddddd-0000-0000-0000-00000000000c', false, NULL);
  INSERT INTO results VALUES ('T6 an admin may act on a new moderator', true, NULL);
END $$;
INSERT INTO results SELECT 'T6 admin reads the audit log (every staff action, in order)',
  count(*) >= 12 AND bool_and(actor_user_id IS NOT NULL)
    AND bool_or(action = 'suspend') AND bool_or(action = 'reinstate') AND bool_or(action = 'issue_warning')
    AND bool_or(action = 'lift_restrictions') AND bool_or(action = 'report_resolved') AND bool_or(action = 'edit_profile')
    AND bool_or(action = 'grant_role') AND bool_or(action = 'update_ticket') AND bool_or(action = 'accept_live_chat'),
  string_agg(action, ',' ORDER BY created_at)
  FROM isexy.staff_actions;
DO $$ BEGIN
  INSERT INTO isexy.staff_actions (actor_user_id, action) VALUES ('dddddddd-0000-0000-0000-00000000000e', 'forged');
  INSERT INTO results VALUES ('T6 nobody writes the audit log directly', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 nobody writes the audit log directly', true, SQLERRM);
END $$;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.as_anon();
DO $$ BEGIN
  PERFORM isexy.staff_resolve_report('abababab-0000-0000-0000-000000000001', 'dismissed', NULL);
  INSERT INTO results VALUES ('T6 anon cannot call staff RPCs', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T6 anon cannot call staff RPCs', true, SQLERRM);
END $$;
RESET ROLE;
INSERT INTO results SELECT 'T6 every new function pins search_path and is SECURITY DEFINER',
  bool_and(p.prosecdef AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')), string_agg(p.proname, ',') FILTER (WHERE NOT p.prosecdef)
  FROM pg_proc p
 WHERE p.pronamespace = 'isexy'::regnamespace
   AND p.proname IN ('is_staff', 'is_admin', 'staff_profile_ids', 'log_staff_action', 'my_blocker_ids', 'get_my_hidden_member_ids', 'block_member', 'report_member',
                     'active_restriction', 'get_my_moderation_status', 'record_contact_sharing', 'validate_message_allowed',
                     'assert_staff_may_act_on', 'staff_issue_warning', 'staff_lift_restrictions', 'staff_set_shadow_ban',
                     'staff_set_account_active', 'staff_resolve_report', 'staff_update_profile', 'staff_list_roles', 'staff_grant_role',
                     'get_ticket_status', 'staff_update_ticket', 'staff_bulk_update_tickets', 'staff_accept_live_chat',
                     'staff_close_live_chat', 'end_my_live_chat', 'staff_get_live_chat_transcript', 'staff_dashboard_stats');
INSERT INTO results SELECT 'T6 anon can run none of them except get_ticket_status',
  bool_and(NOT has_function_privilege('anon', p.oid, 'EXECUTE')), string_agg(p.proname, ',') FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE'))
  FROM pg_proc p
 WHERE p.pronamespace = 'isexy'::regnamespace
   AND p.proname IN ('is_staff', 'is_admin', 'staff_profile_ids', 'log_staff_action', 'my_blocker_ids', 'get_my_hidden_member_ids', 'block_member', 'report_member',
                     'active_restriction', 'get_my_moderation_status', 'record_contact_sharing', 'validate_message_allowed',
                     'assert_staff_may_act_on', 'staff_issue_warning', 'staff_lift_restrictions', 'staff_set_shadow_ban',
                     'staff_set_account_active', 'staff_resolve_report', 'staff_update_profile', 'staff_list_roles', 'staff_grant_role',
                     'staff_update_ticket', 'staff_bulk_update_tickets', 'staff_accept_live_chat',
                     'staff_close_live_chat', 'end_my_live_chat', 'staff_get_live_chat_transcript', 'staff_dashboard_stats');
INSERT INTO results SELECT 'T6 internal helpers are not callable by members',
  NOT has_function_privilege('authenticated', 'isexy.log_staff_action(text,uuid,uuid,jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'isexy.active_restriction(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'isexy.assert_staff_may_act_on(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'isexy.validate_message_allowed()', 'EXECUTE'), NULL;

-- T7 staff home numbers -----------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
DO $$ BEGIN
  PERFORM isexy.staff_dashboard_stats();
  INSERT INTO results VALUES ('T7 members cannot read the staff numbers', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T7 members cannot read the staff numbers', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');  -- moderator
INSERT INTO results SELECT 'T7 moderator gets members and queues, no revenue or tickets',
  (r -> 'members' ->> 'total')::int >= 6 AND (r -> 'revenue') = 'null'::jsonb AND (r -> 'queues' -> 'open_tickets') = 'null'::jsonb
    AND jsonb_array_length(r -> 'signups_14d') = 14 AND NOT (r ->> 'is_admin')::boolean, r::text
  FROM (SELECT isexy.staff_dashboard_stats() AS r) s;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000e');  -- admin
INSERT INTO results SELECT 'T7 admin also gets revenue and open tickets',
  (r -> 'revenue' ->> 'credit_purchases') IS NOT NULL AND (r -> 'queues' ->> 'open_tickets') IS NOT NULL AND (r ->> 'is_admin')::boolean, r::text
  FROM (SELECT isexy.staff_dashboard_stats() AS r) s;
RESET ROLE;

-- T8 admins read the payment ledgers, members only their own -------------------------
INSERT INTO isexy.credit_transactions (profile_id, amount, type, description)
VALUES ('dddddddd-0000-0000-0000-00000000000a', 30, 'purchase', 'trust smoke'),
       ('dddddddd-0000-0000-0000-00000000000b', 65, 'purchase', 'trust smoke');
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
INSERT INTO results SELECT 'T8 a member reads only their own credit rows', count(*) = 1, count(*)::text
  FROM isexy.credit_transactions WHERE description = 'trust smoke';
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');
INSERT INTO results SELECT 'T8 a moderator does not read the ledgers', count(*) = 0, count(*)::text
  FROM isexy.credit_transactions WHERE description = 'trust smoke';
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000e');
INSERT INTO results SELECT 'T8 an admin reads every credit row', count(*) = 2, count(*)::text
  FROM isexy.credit_transactions WHERE description = 'trust smoke';
DO $$ BEGIN
  INSERT INTO isexy.credit_transactions (profile_id, amount, type, description)
  VALUES ('dddddddd-0000-0000-0000-00000000000e', 1000, 'bonus', 'self-granted');
  INSERT INTO results VALUES ('T8 admins still cannot write the ledger', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('T8 admins still cannot write the ledger', true, SQLERRM);
END $$;
RESET ROLE;

-- T9 adversarial pass: a malicious member and a malicious moderator ------------------
-- (Cleo is a moderator since T6. Gil blocked Ana in T2.)
CREATE OR REPLACE FUNCTION pg_temp.refused(p_name text, p_sql text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE p_sql;
  INSERT INTO results VALUES (p_name, false, 'not refused');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES (p_name, true, SQLERRM);
WHEN OTHERS THEN
  INSERT INTO results VALUES (p_name, false, SQLSTATE || ' ' || SQLERRM);
END $f$;
-- Rows a statement touched (RLS filters silently: 0 = nothing happened).
CREATE OR REPLACE FUNCTION pg_temp.touched(p_sql text) RETURNS int LANGUAGE plpgsql AS $f$
DECLARE n int;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN 0;
END $f$;

INSERT INTO isexy.reports (id, reporter_id, reported_id, reason, description, status) VALUES
 ('abababab-0000-0000-0000-000000000009', 'dddddddd-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000d', 'harassment', 'the moderator threatened me', 'pending'),
 ('abababab-0000-0000-0000-00000000000a', 'dddddddd-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000e', 'harassment', 'the admin insulted me', 'pending'),
 ('abababab-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-00000000000f', 'spam', 'sends links', 'pending');
INSERT INTO isexy.photo_verifications (id, profile_id, selfie_path)
VALUES ('9a9a9a9a-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000d', 'dddddddd-0000-0000-0000-00000000000d/selfie.jpg');
INSERT INTO isexy.phone_line_profiles (id, profile_id, display_name, age, status, is_public) VALUES
 ('9b9b9b9b-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000d', 'Mod', 41, 'active', true),
 ('9b9b9b9b-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000f', 'Gil', 33, 'active', true);
INSERT INTO isexy.voice_greetings (id, phone_line_profile_id, profile_id, audio_url, duration_seconds, moderation_status) VALUES
 ('9c9c9c9c-0000-0000-0000-000000000001', '9b9b9b9b-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000d', 'dddddddd-0000-0000-0000-00000000000d/g.wav', 10, 'pending'),
 ('9c9c9c9c-0000-0000-0000-000000000002', '9b9b9b9b-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000f', 'dddddddd-0000-0000-0000-00000000000f/g.wav', 10, 'approved');
INSERT INTO isexy.profile_photos (profile_id, photo_url, position) VALUES
 ('dddddddd-0000-0000-0000-00000000000f', 'https://example.ca/gil.jpg', 0),
 ('dddddddd-0000-0000-0000-00000000000b', 'https://example.ca/ben.jpg', 0);
INSERT INTO isexy.chatbot_conversations (id, user_id, session_id, status) VALUES
 ('ffffffff-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000b', 'member_ben', 'active'),
 ('ffffffff-0000-0000-0000-000000000003', NULL, 'guest_abcdefgh', 'active');
INSERT INTO isexy.chatbot_messages (conversation_id, role, content) VALUES
 ('ffffffff-0000-0000-0000-000000000002', 'user', 'my card ending 4242 was charged twice'),
 ('ffffffff-0000-0000-0000-000000000003', 'user', 'a guest question');
INSERT INTO isexy.live_chat_sessions (id, user_id, status)
VALUES ('ffffffff-0000-0000-0000-0000000000a2', 'dddddddd-0000-0000-0000-00000000000a', 'waiting');
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000e');  -- admin restricts the moderator for 7 days
SELECT isexy.staff_issue_warning('dddddddd-0000-0000-0000-00000000000d', 'harassment', '7d', 'abusive replies to members');
RESET ROLE;

-- T9a member: blocks ------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');  -- Ana, blocked by Gil
INSERT INTO results SELECT 'T9a a blocked member cannot delete the block (unblock themselves)',
  pg_temp.touched($q$DELETE FROM isexy.blocks WHERE blocker_id = 'dddddddd-0000-0000-0000-00000000000f' AND blocked_id = 'dddddddd-0000-0000-0000-00000000000a'$q$) = 0, NULL;
INSERT INTO results SELECT 'T9a a blocked member cannot rewrite the block',
  pg_temp.touched($q$UPDATE isexy.blocks SET blocked_id = 'dddddddd-0000-0000-0000-00000000000b' WHERE blocker_id = 'dddddddd-0000-0000-0000-00000000000f'$q$) = 0, NULL;
SELECT pg_temp.refused('T9a a member cannot file a block in someone else''s name',
  $q$INSERT INTO isexy.blocks (blocker_id, blocked_id) VALUES ('dddddddd-0000-0000-0000-00000000000f', 'dddddddd-0000-0000-0000-00000000000b')$q$);
INSERT INTO results SELECT 'T9a a member reads only the blocks they made', count(*) = 1 AND bool_and(blocker_id = 'dddddddd-0000-0000-0000-00000000000a'), count(*)::text
  FROM isexy.blocks;
INSERT INTO results SELECT 'T9a a blocked member cannot read the blocker''s photos', count(*) = 0, count(*)::text
  FROM isexy.profile_photos WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000f';
INSERT INTO results SELECT 'T9a ... nor the blocker''s Phone Line profile and greeting',
  (SELECT count(*) FROM isexy.phone_line_profiles WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000f') = 0
  AND (SELECT count(*) FROM isexy.voice_greetings WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000f') = 0, NULL;
INSERT INTO results SELECT 'T9a other members'' photos stay visible', count(*) = 1, count(*)::text
  FROM isexy.profile_photos WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000b';
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000f');  -- Gil, the blocker
INSERT INTO results SELECT 'T9a the blocker keeps their own photos and Phone Line', 
  (SELECT count(*) FROM isexy.profile_photos WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000f') = 1
  AND (SELECT count(*) FROM isexy.phone_line_profiles WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000f') = 1, NULL;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.as_anon();
INSERT INTO results SELECT 'T9a anon lists no member photos', count(*) = 0, count(*)::text FROM isexy.profile_photos;
RESET ROLE;

-- T9b member: other members' moderation state, assistant chats ------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000a');
INSERT INTO results SELECT 'T9b a reporter does not read reviewed reports (outcome, reviewer, staff note)',
  count(*) = 0, string_agg(DISTINCT status, ',')
  FROM isexy.reports WHERE coalesce(status, 'pending') <> 'pending';
INSERT INTO results SELECT 'T9b a reporter still reads their pending report', count(*) = 1, count(*)::text
  FROM isexy.reports WHERE coalesce(status, 'pending') = 'pending';
INSERT INTO results SELECT 'T9b a member reads no warnings, violations or staff actions',
  (SELECT count(*) FROM isexy.user_warnings) + (SELECT count(*) FROM isexy.content_violations) + (SELECT count(*) FROM isexy.staff_actions) = 0, NULL;
INSERT INTO results SELECT 'T9b a member reads no one else''s assistant chat (member or guest)',
  (SELECT count(*) FROM isexy.chatbot_messages WHERE conversation_id IN ('ffffffff-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003')) = 0
  AND (SELECT count(*) FROM isexy.chatbot_conversations WHERE id IN ('ffffffff-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003')) = 0, NULL;
SELECT pg_temp.refused('T9b a member cannot attach someone else''s assistant chat to a live chat (staff would read it)',
  $q$INSERT INTO isexy.live_chat_sessions (user_id, status, chatbot_conversation_id) VALUES ('dddddddd-0000-0000-0000-00000000000a', 'waiting', 'ffffffff-0000-0000-0000-000000000002')$q$);
SELECT pg_temp.refused('T9b a member cannot open a live chat that skips the queue',
  $q$INSERT INTO isexy.live_chat_sessions (user_id, status) VALUES ('dddddddd-0000-0000-0000-00000000000a', 'active')$q$);
INSERT INTO isexy.live_chat_sessions (user_id, status, chatbot_conversation_id)
VALUES ('dddddddd-0000-0000-0000-00000000000a', 'waiting', 'ffffffff-0000-0000-0000-000000000001');
INSERT INTO results SELECT 'T9b a member still opens a waiting chat with their own assistant chat', count(*) = 1, count(*)::text
  FROM isexy.live_chat_sessions WHERE chatbot_conversation_id = 'ffffffff-0000-0000-0000-000000000001' AND status = 'waiting';
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.as_anon();
INSERT INTO results SELECT 'T9b anon reads no guest assistant chats', 
  (SELECT count(*) FROM isexy.chatbot_conversations) + (SELECT count(*) FROM isexy.chatbot_messages) = 0, NULL;
INSERT INTO results SELECT 'T9b ticket tracking takes no wildcards', count(*) = 0, count(*)::text FROM isexy.get_ticket_status('%', '%@%');
RESET ROLE;

-- T9c member: every staff RPC refuses ----------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000b');  -- Ben, member
SELECT pg_temp.refused('T9c member refused: ' || f, q) FROM (VALUES
  ('staff_issue_warning', $q$SELECT isexy.staff_issue_warning('dddddddd-0000-0000-0000-00000000000a', 'spam', 'none', NULL)$q$),
  ('staff_lift_restrictions', $q$SELECT isexy.staff_lift_restrictions('dddddddd-0000-0000-0000-00000000000a', NULL)$q$),
  ('staff_set_shadow_ban', $q$SELECT isexy.staff_set_shadow_ban('dddddddd-0000-0000-0000-00000000000a', true, NULL)$q$),
  ('staff_set_account_active', $q$SELECT isexy.staff_set_account_active('dddddddd-0000-0000-0000-00000000000a', false, 'x')$q$),
  ('staff_resolve_report', $q$SELECT isexy.staff_resolve_report('abababab-0000-0000-0000-000000000009', 'dismissed', NULL)$q$),
  ('staff_update_profile', $q$SELECT isexy.staff_update_profile('dddddddd-0000-0000-0000-00000000000a', 'Hacked', NULL, 'x')$q$),
  ('staff_list_roles', $q$SELECT * FROM isexy.staff_list_roles(ARRAY['dddddddd-0000-0000-0000-00000000000e']::uuid[])$q$),
  ('staff_grant_role', $q$SELECT isexy.staff_grant_role('dddddddd-0000-0000-0000-00000000000b', 'admin')$q$),
  ('staff_update_ticket', $q$SELECT isexy.staff_update_ticket(gen_random_uuid(), 'closed', NULL, NULL, NULL, false)$q$),
  ('staff_bulk_update_tickets', $q$SELECT isexy.staff_bulk_update_tickets(ARRAY[]::uuid[], 'closed', NULL, false)$q$),
  ('staff_accept_live_chat', $q$SELECT isexy.staff_accept_live_chat('ffffffff-0000-0000-0000-0000000000a2')$q$),
  ('staff_close_live_chat', $q$SELECT isexy.staff_close_live_chat('ffffffff-0000-0000-0000-0000000000a2')$q$),
  ('staff_get_live_chat_transcript', $q$SELECT * FROM isexy.staff_get_live_chat_transcript('ffffffff-0000-0000-0000-0000000000a2')$q$),
  ('staff_dashboard_stats', $q$SELECT isexy.staff_dashboard_stats()$q$),
  ('staff_set_profile_verified', $q$SELECT isexy.staff_set_profile_verified('dddddddd-0000-0000-0000-00000000000b', true)$q$),
  ('review_photo_verification', $q$SELECT isexy.review_photo_verification('9a9a9a9a-0000-0000-0000-000000000001', true, NULL)$q$),
  ('get_voice_greetings_for_review', $q$SELECT * FROM isexy.get_voice_greetings_for_review(10)$q$),
  ('direct role insert', $q$INSERT INTO isexy.user_roles (user_id, role) VALUES ('dddddddd-0000-0000-0000-00000000000b', 'admin')$q$),
  ('direct warning insert', $q$INSERT INTO isexy.user_warnings (profile_id, warning_type, warning_level) VALUES ('dddddddd-0000-0000-0000-00000000000a', 'spam', 1)$q$)
) v(f, q);
INSERT INTO results SELECT 'T9c member refused: review_voice_greeting', r ->> 'error' = 'not_authorized', r::text
  FROM (SELECT isexy.review_voice_greeting('9c9c9c9c-0000-0000-0000-000000000001', true, NULL) AS r) s;
INSERT INTO results SELECT 'T9c member gets no staff directory', count(*) = 0, count(*)::text FROM isexy.get_admin_users();
RESET ROLE;

-- T9d moderator: admin-only actions, writes around the RPCs -------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');  -- Mod (restricted for 7 days by the admin)
SELECT pg_temp.refused('T9d moderator refused: ' || f, q) FROM (VALUES
  ('staff_grant_role (promote themselves to admin)', $q$SELECT isexy.staff_grant_role('dddddddd-0000-0000-0000-00000000000d', 'admin')$q$),
  ('staff_list_roles', $q$SELECT * FROM isexy.staff_list_roles(ARRAY['dddddddd-0000-0000-0000-00000000000e']::uuid[])$q$),
  ('staff_bulk_update_tickets', $q$SELECT isexy.staff_bulk_update_tickets(ARRAY[]::uuid[], 'closed', NULL, false)$q$),
  ('direct role insert', $q$INSERT INTO isexy.user_roles (user_id, role) VALUES ('dddddddd-0000-0000-0000-00000000000d', 'admin')$q$),
  ('a direct warning (permanent ban on an admin, no audit)', $q$INSERT INTO isexy.user_warnings (profile_id, warning_type, warning_level, is_permanent_ban) VALUES ('dddddddd-0000-0000-0000-00000000000e', 'other', 3, true)$q$),
  ('a direct warning on a member (no audit)', $q$INSERT INTO isexy.user_warnings (profile_id, warning_type, warning_level, ban_until) VALUES ('dddddddd-0000-0000-0000-00000000000b', 'spam', 1, now() + interval '1 day')$q$),
  ('lifting their own restriction through the RPC', $q$SELECT isexy.staff_lift_restrictions('dddddddd-0000-0000-0000-00000000000d', 'mistake')$q$),
  ('verifying themselves', $q$SELECT isexy.staff_set_profile_verified('dddddddd-0000-0000-0000-00000000000d', true)$q$),
  ('unverifying an admin', $q$SELECT isexy.staff_set_profile_verified('dddddddd-0000-0000-0000-00000000000e', false)$q$),
  ('approving their own photo check', $q$SELECT isexy.review_photo_verification('9a9a9a9a-0000-0000-0000-000000000001', true, NULL)$q$),
  ('dismissing a report about themselves', $q$SELECT isexy.staff_resolve_report('abababab-0000-0000-0000-000000000009', 'dismissed', 'nothing happened')$q$),
  ('dismissing a report about an admin', $q$SELECT isexy.staff_resolve_report('abababab-0000-0000-0000-00000000000a', 'dismissed', NULL)$q$),
  ('giving themselves Platinum', $q$UPDATE isexy.profiles SET is_premium = true, subscription_tier = 'platinum' WHERE user_id = 'dddddddd-0000-0000-0000-00000000000d'$q$),
  ('giving themselves unlimited likes', $q$UPDATE isexy.profiles SET likes_remaining = 999999 WHERE user_id = 'dddddddd-0000-0000-0000-00000000000d'$q$)
) v(f, q);
INSERT INTO results SELECT 'T9d moderator refused: approving their own voice greeting', r ->> 'error' = 'not_authorized', r::text
  FROM (SELECT isexy.review_voice_greeting('9c9c9c9c-0000-0000-0000-000000000001', true, NULL) AS r) s;
INSERT INTO results SELECT 'T9d a moderator cannot lift their own restriction directly',
  pg_temp.touched($q$UPDATE isexy.user_warnings SET lifted_at = now() WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000d'$q$) = 0
  AND (isexy.get_my_moderation_status() ->> 'restricted')::boolean, isexy.get_my_moderation_status()::text;
INSERT INTO results SELECT 'T9d a moderator cannot rewrite a warning (evidence, issuer)',
  pg_temp.touched($q$UPDATE isexy.user_warnings SET evidence = 'forged', issued_by = NULL WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000b'$q$) = 0, NULL;
INSERT INTO results SELECT 'T9d a moderator does not read reports about themselves (no reporter to retaliate against)', count(*) = 0, count(*)::text
  FROM isexy.reports WHERE reported_id = 'dddddddd-0000-0000-0000-00000000000d';
INSERT INTO results SELECT 'T9d ... nor reports about other staff', count(*) = 0, count(*)::text
  FROM isexy.reports WHERE reported_id IN ('dddddddd-0000-0000-0000-00000000000e', 'dddddddd-0000-0000-0000-00000000000c');
INSERT INTO results SELECT 'T9d a moderator still reads reports about members', count(*) = 1, count(*)::text
  FROM isexy.reports WHERE id = 'abababab-0000-0000-0000-00000000000b';
SELECT isexy.staff_accept_live_chat('ffffffff-0000-0000-0000-0000000000a2');
INSERT INTO results SELECT 'T9d an agent cannot move a chat to another member',
  pg_temp.touched($q$UPDATE isexy.live_chat_sessions SET user_id = 'dddddddd-0000-0000-0000-00000000000b' WHERE id = 'ffffffff-0000-0000-0000-0000000000a2'$q$) = 0, NULL;
INSERT INTO results SELECT 'T9d an agent cannot reopen an ended chat',
  pg_temp.touched($q$UPDATE isexy.live_chat_sessions SET status = 'active', ended_at = NULL WHERE id = 'ffffffff-0000-0000-0000-0000000000a1'$q$) = 0, NULL;
INSERT INTO results SELECT 'T9d an agent cannot swap the assistant chat staff will read',
  pg_temp.touched($q$UPDATE isexy.live_chat_sessions SET chatbot_conversation_id = 'ffffffff-0000-0000-0000-000000000002' WHERE id = 'ffffffff-0000-0000-0000-0000000000a2'$q$) = 0, NULL;
RESET ROLE;
INSERT INTO results SELECT 'T9d nothing was written around the RPCs',
  (SELECT count(*) FROM isexy.user_warnings WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000e') = 0
  AND (SELECT count(*) FROM isexy.user_warnings WHERE evidence = 'forged') = 0
  AND (SELECT count(*) FROM isexy.user_warnings WHERE profile_id = 'dddddddd-0000-0000-0000-00000000000d' AND lifted_at IS NULL) = 1
  AND (SELECT NOT coalesce(is_verified, false) AND NOT coalesce(is_premium, false) AND likes_remaining < 999999 FROM isexy.profiles WHERE id = 'dddddddd-0000-0000-0000-00000000000d')
  AND (SELECT status FROM isexy.photo_verifications WHERE id = '9a9a9a9a-0000-0000-0000-000000000001') = 'pending'
  AND (SELECT moderation_status FROM isexy.voice_greetings WHERE id = '9c9c9c9c-0000-0000-0000-000000000001') = 'pending'
  AND (SELECT coalesce(status, 'pending') FROM isexy.reports WHERE id = 'abababab-0000-0000-0000-000000000009') = 'pending'
  AND (SELECT user_id = 'dddddddd-0000-0000-0000-00000000000a' AND chatbot_conversation_id IS NULL FROM isexy.live_chat_sessions WHERE id = 'ffffffff-0000-0000-0000-0000000000a2')
  AND (SELECT status FROM isexy.live_chat_sessions WHERE id = 'ffffffff-0000-0000-0000-0000000000a1') = 'closed'
  AND NOT EXISTS (SELECT 1 FROM isexy.user_roles WHERE user_id = 'dddddddd-0000-0000-0000-00000000000d' AND role = 'admin'), NULL;

-- T9e admin: staff accounts, reports about staff, a suspended moderator ------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000e');  -- Xan, admin
INSERT INTO results SELECT 'T9e an admin reads the reports about staff', count(*) = 22, count(*)::text
  FROM isexy.reports WHERE reported_id IN ('dddddddd-0000-0000-0000-00000000000d', 'dddddddd-0000-0000-0000-00000000000e');
INSERT INTO results SELECT 'T9e an admin reviews a report about a moderator', r ->> 'status' = 'resolved', r::text
  FROM (SELECT isexy.staff_resolve_report('abababab-0000-0000-0000-000000000009', 'resolved', 'warned the moderator') AS r) s;
SELECT pg_temp.refused('T9e an admin cannot review a report about themselves',
  $q$SELECT isexy.staff_resolve_report('abababab-0000-0000-0000-00000000000a', 'dismissed', NULL)$q$);
INSERT INTO results SELECT 'T9e an admin suspends the moderator', NOT (r ->> 'is_active')::boolean, r::text
  FROM (SELECT isexy.staff_set_account_active('dddddddd-0000-0000-0000-00000000000d', false, 'abuse of the staff tools') AS r) s;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');  -- the suspended moderator
SELECT pg_temp.refused('T9e a suspended moderator loses the staff tools: ' || f, q) FROM (VALUES
  ('staff_issue_warning', $q$SELECT isexy.staff_issue_warning('dddddddd-0000-0000-0000-00000000000b', 'spam', 'permanent', 'revenge')$q$),
  ('staff_set_account_active', $q$SELECT isexy.staff_set_account_active('dddddddd-0000-0000-0000-00000000000b', false, 'revenge')$q$),
  ('staff_resolve_report', $q$SELECT isexy.staff_resolve_report('abababab-0000-0000-0000-00000000000b', 'dismissed', NULL)$q$),
  ('staff_accept_live_chat', $q$SELECT isexy.staff_accept_live_chat('ffffffff-0000-0000-0000-0000000000a2')$q$),
  ('staff_dashboard_stats', $q$SELECT isexy.staff_dashboard_stats()$q$),
  ('review_photo_verification', $q$SELECT isexy.review_photo_verification('9a9a9a9a-0000-0000-0000-000000000001', false, 'x')$q$),
  ('staff_set_profile_verified', $q$SELECT isexy.staff_set_profile_verified('dddddddd-0000-0000-0000-00000000000b', false)$q$)
) v(f, q);
SELECT pg_temp.refused('T9e a suspended moderator cannot keep answering their open chat',
  $q$INSERT INTO isexy.live_chat_messages (session_id, sender_type, sender_id, content) VALUES ('ffffffff-0000-0000-0000-0000000000a2', 'agent', 'dddddddd-0000-0000-0000-00000000000d', 'send me your code')$q$);
INSERT INTO results SELECT 'T9e a suspended moderator is not staff and reads no member reports',
  NOT isexy.is_staff() AND (SELECT count(*) FROM isexy.reports WHERE id = 'abababab-0000-0000-0000-00000000000b') = 0, NULL;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000e');
INSERT INTO results SELECT 'T9e the admin reinstates the moderator', (r ->> 'is_active')::boolean, r::text
  FROM (SELECT isexy.staff_set_account_active('dddddddd-0000-0000-0000-00000000000d', true, NULL) AS r) s;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');
INSERT INTO results SELECT 'T9e reinstated: the staff tools work again', (r -> 'members' ->> 'total') IS NOT NULL, NULL
  FROM (SELECT isexy.staff_dashboard_stats() AS r) s;
RESET ROLE;

-- @@PARTS@@

-- Report ---------------------------------------------------------------------
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, detail FROM results;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM results WHERE NOT ok) THEN RAISE EXCEPTION 'trust smoke tests failed'; END IF;
  RAISE NOTICE 'all % trust smoke tests passed', (SELECT count(*) FROM results);
END $$;
