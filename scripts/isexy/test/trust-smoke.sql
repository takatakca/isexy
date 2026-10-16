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

-- @@PARTS@@

-- Report ---------------------------------------------------------------------
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, detail FROM results;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM results WHERE NOT ok) THEN RAISE EXCEPTION 'trust smoke tests failed'; END IF;
  RAISE NOTICE 'all % trust smoke tests passed', (SELECT count(*) FROM results);
END $$;
