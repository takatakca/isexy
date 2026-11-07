-- Smoke tests for supabase/isexy-migrations/0016_ads.sql (get_my_ad_status).
-- Run on a THROWAWAY local Postgres only (never on V1), after:
--   psql "$ISEXY_DB_URL" -f scripts/isexy/test/v1-mock.sql
--   scripts/isexy/migrate.sh --apply
-- then (everything is rolled back):
--   printf 'BEGIN;\n\\i scripts/isexy/test/ads-smoke.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q -v ON_ERROR_STOP=1
-- Each fake member calls the RPC as `authenticated` with request.jwt.claim(s)
-- set; the rows that make a member ad-free are written by the test (as the
-- owner, like the Stripe webhook's RPCs do), never by the member.
\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE TEMP TABLE results (name text, ok boolean, detail text);
GRANT ALL ON results TO authenticated, anon;

-- Members ----------------------------------------------------------------------
--  01 free                       02 active Stripe Gold         03 Plus from a code (plan_grants)
--  04 credits bought 2 days ago  05 credits bought 40 days ago 06 Boost bought yesterday
--  07 chat subscription active   08 moderator                  09 admin
--  10 plan expired + old payment 11 bonus credits (no payment) 12 gift sent (paid)
--  13 gift received only         14 Stripe plan cancelled, week started 10 days ago
--  15 Stripe plan cancelled, period started 40 days ago        16 signed in, no ISEXY profile
--  17 profile cache: is_premium Plus, no end date (staff/legacy) 18 expired chat subscription only
INSERT INTO auth.users (id, email)
SELECT ('adadadad-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'ads' || n || '@test.ca'
FROM generate_series(1, 18) n;

INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, interested_in, is_active)
SELECT ('adadadad-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Ads' || n, '1990-01-01', 'woman', ARRAY['everyone'], true
FROM generate_series(1, 18) n WHERE n <> 16;

INSERT INTO isexy.subscriptions (profile_id, stripe_customer_id, stripe_subscription_id, tier, status, current_period_start, current_period_end)
VALUES
 ('adadadad-0000-0000-0000-000000000002', 'cus_ads2', 'sub_ads2', 'gold', 'active', now() - interval '3 days', now() + interval '27 days'),
 ('adadadad-0000-0000-0000-000000000010', 'cus_ads10', 'sub_ads10', 'gold', 'canceled', now() - interval '70 days', now() - interval '40 days'),
 ('adadadad-0000-0000-0000-000000000014', 'cus_ads14', 'sub_ads14', 'plus', 'canceled', now() - interval '10 days', now() - interval '3 days'),
 ('adadadad-0000-0000-0000-000000000015', 'cus_ads15', 'sub_ads15', 'plus', 'canceled', now() - interval '40 days', now() - interval '33 days');

INSERT INTO isexy.plan_grants (profile_id, tier, source, source_ref, starts_at, expires_at)
VALUES ('adadadad-0000-0000-0000-000000000003', 'plus', 'coupon', 'ADS-TEST', now() - interval '1 day', now() + interval '6 days');

-- 10: the profile still says Gold, but it ended yesterday (cron not run yet).
UPDATE isexy.profiles SET is_premium = true, subscription_tier = 'gold', subscription_expires_at = now() - interval '1 day'
 WHERE id = 'adadadad-0000-0000-0000-000000000010';
-- 17: plan kept on the profile with no end date.
UPDATE isexy.profiles SET is_premium = true, subscription_tier = 'plus', subscription_expires_at = NULL
 WHERE id = 'adadadad-0000-0000-0000-000000000017';

INSERT INTO isexy.credit_transactions (profile_id, amount, type, category, description, stripe_session_id, created_at)
VALUES
 ('adadadad-0000-0000-0000-000000000004', 30, 'purchase', 'general', 'Purchased 30 credits', 'cs_test_ads_04', now() - interval '2 days'),
 ('adadadad-0000-0000-0000-000000000005', 30, 'purchase', 'general', 'Purchased 30 credits', 'cs_test_ads_05', now() - interval '40 days'),
 ('adadadad-0000-0000-0000-000000000010', 10, 'purchase', 'general', 'Purchased 10 credits', 'cs_test_ads_10', now() - interval '45 days'),
 ('adadadad-0000-0000-0000-000000000011', 10, 'bonus', 'general', 'Welcome bonus', NULL, now() - interval '1 day');

INSERT INTO isexy.boost_transactions (profile_id, boost_type, action, quantity, stripe_session_id, created_at)
VALUES
 ('adadadad-0000-0000-0000-000000000006', 'boost', 'purchase', 1, 'cs_test_ads_06', now() - interval '1 day'),
 ('adadadad-0000-0000-0000-000000000011', 'boost', 'monthly_grant', 1, NULL, now() - interval '1 day');

INSERT INTO isexy.chat_subscriptions (profile_id, plan_months, status, starts_at, expires_at, stripe_session_id, created_at)
VALUES
 ('adadadad-0000-0000-0000-000000000007', 1, 'active', now() - interval '45 days', now() + interval '5 days', NULL, now() - interval '45 days'),
 ('adadadad-0000-0000-0000-000000000018', 1, 'canceled', now() - interval '80 days', now() - interval '50 days', NULL, now() - interval '80 days');

INSERT INTO isexy.gift_packages (id, name, category, price_usd)
VALUES ('adadadad-0000-0000-0000-00000000a1f7', '100 Stars', 'stars', 1.00);
INSERT INTO isexy.gift_transactions (sender_profile_id, receiver_profile_id, gift_package_id, amount_usd, status, stripe_session_id, created_at, completed_at)
VALUES ('adadadad-0000-0000-0000-000000000012', 'adadadad-0000-0000-0000-000000000013', 'adadadad-0000-0000-0000-00000000a1f7', 1.00, 'completed', 'cs_test_ads_12', now() - interval '3 days', now() - interval '3 days');

INSERT INTO isexy.user_roles (user_id, role) VALUES
 ('adadadad-0000-0000-0000-000000000008', 'moderator'),
 ('adadadad-0000-0000-0000-000000000009', 'admin');

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, false),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false),
         set_config('request.jwt.claim.role', 'authenticated', false);
$$;

-- One status per member, read as that member.
CREATE TEMP TABLE statuses (n int, status jsonb);
GRANT ALL ON statuses TO authenticated;
SET ROLE authenticated;
DO $$
DECLARE n int;
BEGIN
  FOR n IN 1..18 LOOP
    PERFORM pg_temp.as_user('adadadad-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'));
    INSERT INTO statuses VALUES (n, isexy.get_my_ad_status());
  END LOOP;
END $$;
RESET ROLE;

CREATE OR REPLACE FUNCTION pg_temp.expect(p_n int, p_name text, p_ad_free boolean, p_reason text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO results
  SELECT p_name, (s.status->>'ad_free')::boolean = p_ad_free AND s.status->>'reason' = p_reason, s.status::text
    FROM statuses s WHERE s.n = p_n;
$$;

DO $$ BEGIN
  PERFORM pg_temp.expect(1,  'S1 free member sees ads', false, 'free');
  PERFORM pg_temp.expect(2,  'S2 active Stripe Gold plan: ad-free', true, 'plan');
  PERFORM pg_temp.expect(3,  'S3 Plus from a redeemed code (plan_grants): ad-free', true, 'plan');
  PERFORM pg_temp.expect(4,  'S4 credits bought 2 days ago: ad-free', true, 'recent_payment');
  PERFORM pg_temp.expect(5,  'S5 credits bought 40 days ago: ads again', false, 'free');
  PERFORM pg_temp.expect(6,  'S6 Boost bought yesterday: ad-free', true, 'recent_payment');
  PERFORM pg_temp.expect(7,  'S7 active chat subscription: ad-free', true, 'chat_subscription');
  PERFORM pg_temp.expect(8,  'S8 moderator: ad-free', true, 'staff');
  PERFORM pg_temp.expect(9,  'S9 admin: ad-free', true, 'staff');
  PERFORM pg_temp.expect(10, 'S10 plan ended yesterday + payment 45 days ago: ads', false, 'free');
  PERFORM pg_temp.expect(11, 'S11 bonus credits and a monthly Boost are not payments', false, 'free');
  PERFORM pg_temp.expect(12, 'S12 gift paid 3 days ago: ad-free', true, 'recent_payment');
  PERFORM pg_temp.expect(13, 'S13 receiving a gift is not paying: ads', false, 'free');
  PERFORM pg_temp.expect(14, 'S14 Stripe week paid 10 days ago, then cancelled: ad-free', true, 'recent_payment');
  PERFORM pg_temp.expect(15, 'S15 Stripe period paid 40 days ago, cancelled: ads', false, 'free');
  PERFORM pg_temp.expect(16, 'S16 signed in without an ISEXY profile', false, 'no_profile');
  PERFORM pg_temp.expect(17, 'S17 open-ended plan on the profile: ad-free', true, 'plan');
  PERFORM pg_temp.expect(18, 'S18 chat subscription ended 50 days ago: ads', false, 'free');
END $$;

INSERT INTO results SELECT 'S4 until = payment + 30 days',
  abs(extract(epoch FROM ((status->>'until')::timestamptz - (now() + interval '28 days')))) < 5, status->>'until'
  FROM statuses WHERE n = 4;
INSERT INTO results SELECT 'S2 until = Stripe period end + 1 day of grace',
  abs(extract(epoch FROM ((status->>'until')::timestamptz - (now() + interval '28 days')))) < 5, status->>'until'
  FROM statuses WHERE n = 2;
INSERT INTO results SELECT 'S17 open-ended plan: until is null', status->'until' = 'null'::jsonb, status->>'until'
  FROM statuses WHERE n = 17;
INSERT INTO results SELECT 'S1 free: until is null', status->'until' = 'null'::jsonb, status::text
  FROM statuses WHERE n = 1;

-- A purchase made now flips a free member at once (no cache on the server).
INSERT INTO isexy.credit_transactions (profile_id, amount, type, category, description, stripe_session_id)
VALUES ('adadadad-0000-0000-0000-000000000001', 0, 'purchase', 'chat_sub', 'Chat subscription', 'cs_test_ads_01');
SET ROLE authenticated;
SELECT pg_temp.as_user('adadadad-0000-0000-0000-000000000001');
INSERT INTO results SELECT 'S1b free member pays now: ad-free at once',
  (r->>'ad_free')::boolean AND r->>'reason' = 'recent_payment', r::text
  FROM (SELECT isexy.get_my_ad_status() AS r) x;
RESET ROLE;

-- 0015 is_staff(): a suspended moderator loses staff status, ads included.
UPDATE isexy.profiles SET is_active = false WHERE id = 'adadadad-0000-0000-0000-000000000008';
SET ROLE authenticated;
SELECT pg_temp.as_user('adadadad-0000-0000-0000-000000000008');
INSERT INTO results SELECT 'S8b suspended moderator (0015 is_staff): no longer staff, sees ads',
  NOT (r->>'ad_free')::boolean AND r->>'reason' = 'free', r::text
  FROM (SELECT isexy.get_my_ad_status() AS r) x;
RESET ROLE;
UPDATE isexy.profiles SET is_active = true WHERE id = 'adadadad-0000-0000-0000-000000000008';

-- Refusals and grants ------------------------------------------------------------
SET ROLE anon;
DO $$ BEGIN
  PERFORM isexy.get_my_ad_status();
  INSERT INTO results VALUES ('P1 anon cannot execute', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('P1 anon cannot execute', true, SQLERRM);
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '{}', false); END $$;
DO $$ BEGIN
  PERFORM isexy.get_my_ad_status();
  INSERT INTO results VALUES ('P2 no auth.uid(): refused', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('P2 no auth.uid(): refused', true, SQLERRM);
END $$;
RESET ROLE;

INSERT INTO results SELECT 'P3 EXECUTE: authenticated yes, anon and PUBLIC no',
  has_function_privilege('authenticated', 'isexy.get_my_ad_status()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'isexy.get_my_ad_status()', 'EXECUTE')
  AND NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
                   WHERE p.oid = 'isexy.get_my_ad_status()'::regprocedure AND a.grantee = 0),
  NULL;
INSERT INTO results SELECT 'P4 SECURITY DEFINER, STABLE, search_path pinned',
  p.prosecdef AND p.provolatile = 's' AND p.proconfig @> ARRAY['search_path=isexy, extensions'], p.proconfig::text
  FROM pg_proc p WHERE p.oid = 'isexy.get_my_ad_status()'::regprocedure;

-- A member cannot make themselves ad-free: every table read is closed to member writes.
SET ROLE authenticated;
SELECT pg_temp.as_user('adadadad-0000-0000-0000-000000000005');
DO $$ BEGIN
  INSERT INTO isexy.credit_transactions (profile_id, amount, type, stripe_session_id)
  VALUES ('adadadad-0000-0000-0000-000000000005', 1, 'purchase', 'cs_test_fake_05');
  INSERT INTO results VALUES ('P5 member cannot write a fake purchase', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('P5 member cannot write a fake purchase', true, SQLERRM);
END $$;
DO $$ BEGIN
  INSERT INTO isexy.boost_transactions (profile_id, boost_type, action, quantity, stripe_session_id)
  VALUES ('adadadad-0000-0000-0000-000000000005', 'boost', 'purchase', 1, 'cs_test_fake_05b');
  INSERT INTO results VALUES ('P5 member cannot write a fake Boost purchase', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('P5 member cannot write a fake Boost purchase', true, SQLERRM);
END $$;
DO $$ BEGIN
  INSERT INTO isexy.plan_grants (profile_id, tier, source) VALUES ('adadadad-0000-0000-0000-000000000005', 'plus', 'staff');
  INSERT INTO results VALUES ('P5 member cannot grant themselves a plan', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('P5 member cannot grant themselves a plan', true, SQLERRM);
END $$;
DO $$ BEGIN
  UPDATE isexy.profiles SET is_premium = true, subscription_tier = 'plus' WHERE id = 'adadadad-0000-0000-0000-000000000005';
  INSERT INTO results VALUES ('P5 member cannot set their own plan on the profile', false, 'update succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('P5 member cannot set their own plan on the profile', true, SQLERRM);
END $$;
INSERT INTO results SELECT 'P5 still not ad-free after the attempts',
  NOT (r->>'ad_free')::boolean, r::text FROM (SELECT isexy.get_my_ad_status() AS r) x;
RESET ROLE;

-- Report ---------------------------------------------------------------------
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, detail FROM results;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM results WHERE ok IS NOT TRUE) THEN RAISE EXCEPTION 'ads smoke tests failed'; END IF;
  RAISE NOTICE 'all % ads smoke tests passed', (SELECT count(*) FROM results);
END $$;
