-- Run only in an isolated database, inside BEGIN/ROLLBACK after 0016.
-- A Stripe settlement is not proof of physical delivery. No provider calls.
\set ON_ERROR_STOP on
SET client_min_messages = warning;
CREATE TEMP TABLE payment_results(name text, ok boolean);
GRANT ALL ON payment_results TO authenticated, anon, service_role;
CREATE FUNCTION pg_temp.assert_payment(p_name text, p_ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', p_name; END IF;
  INSERT INTO payment_results VALUES(p_name, true);
END $$;
CREATE FUNCTION pg_temp.payment_role(p_user text, p_role text) RETURNS void LANGUAGE sql AS $$
 SELECT set_config('request.jwt.claim.sub',p_user,false),
 set_config('request.jwt.claim.role',p_role,false),
 set_config('request.jwt.claims',json_build_object('sub',p_user,'role',p_role)::text,false);
$$;
INSERT INTO auth.users(id,email) SELECT ('fafafafa-0000-0000-0000-00000000000'||n)::uuid, 'payment'||n||'@test.invalid' FROM generate_series(1,3)n;
INSERT INTO isexy.profiles(user_id,first_name,birth_date,gender,interested_in,is_active)
 SELECT ('fafafafa-0000-0000-0000-00000000000'||n)::uuid, 'Payment'||n, '1990-01-01','woman',ARRAY['everyone'],true FROM generate_series(1,3)n;
\set A '''fafafafa-0000-0000-0000-000000000001'''
\set B '''fafafafa-0000-0000-0000-000000000002'''
\set C '''fafafafa-0000-0000-0000-000000000003'''
SELECT id AS physical FROM isexy.gift_packages WHERE category='food_package' ORDER BY id LIMIT 1 \gset
SELECT id AS stars FROM isexy.gift_packages WHERE name='500 Stars' LIMIT 1 \gset
SET ROLE service_role;
SELECT pg_temp.payment_role('', 'service_role');
SELECT pg_temp.assert_payment('paid physical gift remains pending', r->>'fulfillment_status'='pending') FROM
 (SELECT isexy.fulfill_stripe_payment('cs_test_physical',:A,'gift_'||:'physical',2000,'usd',jsonb_build_object('recipient_profile_id',:B))r)t;
SELECT pg_temp.assert_payment('physical replay acknowledged once', (r->>'already_fulfilled')::boolean) FROM
 (SELECT isexy.fulfill_stripe_payment('cs_test_physical',:A,'gift_'||:'physical',2000,'usd',jsonb_build_object('recipient_profile_id',:B))r)t;
SELECT pg_temp.assert_payment('changed receiver rejected on replay', r->>'error'='payment_reference_mismatch') FROM
 (SELECT isexy.fulfill_stripe_payment('cs_test_physical',:A,'gift_'||:'physical',2000,'usd',jsonb_build_object('recipient_profile_id',:C))r)t;
SELECT pg_temp.assert_payment('digital Stars really complete', r->>'fulfillment_status'='completed') FROM
 (SELECT isexy.fulfill_stripe_payment('cs_test_star_delivery',:A,'gift_'||:'stars',650,'usd',jsonb_build_object('recipient_profile_id',:B))r)t;
SELECT pg_temp.assert_payment('digital replay acknowledged', (r->>'already_fulfilled')::boolean) FROM
 (SELECT isexy.fulfill_stripe_payment('cs_test_star_delivery',:A,'gift_'||:'stars',650,'usd',jsonb_build_object('recipient_profile_id',:B))r)t;
SELECT pg_temp.assert_payment('paid '||product||' awaits delivery', r->>'fulfillment_status'='pending')
 FROM unnest(ARRAY['topup_20','food_20','donation_20'])product
 CROSS JOIN LATERAL (SELECT isexy.fulfill_stripe_payment('cs_test_'||product,:C,product,2000,'usd',jsonb_build_object('recipient_profile_id',:B))r)t;
RESET ROLE;
SELECT pg_temp.assert_payment('one physical ledger, paid but not delivered', count(*)=1 AND bool_and(status='pending' AND payment_confirmed_at IS NOT NULL AND completed_at IS NULL)) FROM isexy.gift_transactions WHERE stripe_session_id='cs_test_physical';
SELECT pg_temp.assert_payment('500 Stars credited exactly once', stars_balance=500 AND lifetime_stars_received=500) FROM isexy.user_stars WHERE profile_id=:B;
SELECT pg_temp.assert_payment('one digital ledger, paid and delivered', count(*)=1 AND bool_and(status='completed' AND payment_confirmed_at IS NOT NULL AND completed_at IS NOT NULL)) FROM isexy.gift_transactions WHERE stripe_session_id='cs_test_star_delivery';
SELECT pg_temp.assert_payment('all three paid donations pending',count(*)=3 AND bool_and(status='pending' AND payment_confirmed_at IS NOT NULL AND completed_at IS NULL)) FROM isexy.donations WHERE donor_profile_id=:C;
SET ROLE authenticated;
SELECT pg_temp.payment_role(:C,'authenticated');
SELECT pg_temp.assert_payment('paid pending donations earn ad-free time', (isexy.get_my_ad_status()->>'ad_free')::boolean);
RESET ROLE;
-- Isolate the unpaid case and later confirm its pre-created row.
UPDATE isexy.donations SET status='refunded' WHERE donor_profile_id=:C;
INSERT INTO isexy.donations(donor_profile_id,recipient_profile_id,amount_usd,donation_type,stripe_session_id) VALUES (:C,:B,20,'cash','cs_test_precreated');
SET ROLE authenticated;
SELECT pg_temp.payment_role(:C,'authenticated');
SELECT pg_temp.assert_payment('unpaid pending and refunded payments do not hide ads',NOT (isexy.get_my_ad_status()->>'ad_free')::boolean);
DO $$ BEGIN
  BEGIN
    UPDATE isexy.donations SET payment_confirmed_at=now() WHERE stripe_session_id='cs_test_precreated';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE isexy.gift_transactions SET payment_confirmed_at=now(),status='completed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT pg_temp.assert_payment('member cannot forge payment marker', payment_confirmed_at IS NULL) FROM isexy.donations WHERE stripe_session_id='cs_test_precreated';
SELECT pg_temp.assert_payment('member cannot forge delivery', status='pending' AND completed_at IS NULL) FROM isexy.gift_transactions WHERE stripe_session_id='cs_test_physical';
SET ROLE service_role;
SELECT pg_temp.payment_role('','service_role');
SELECT pg_temp.assert_payment('pre-created pending payment confirmed', (r->>'success')::boolean AND r->>'fulfillment_status'='pending') FROM
 (SELECT isexy.fulfill_stripe_payment('cs_test_precreated',:C,'donation_20',2000,'usd',jsonb_build_object('recipient_profile_id',:B))r)t;
SELECT isexy.fulfill_stripe_payment('cs_test_topup_20',:C,'topup_20',2000,'usd',jsonb_build_object('recipient_profile_id',:B));
RESET ROLE;
SELECT pg_temp.assert_payment('pre-created ledger stays single and undelivered',count(*)=1 AND bool_and(payment_confirmed_at IS NOT NULL AND completed_at IS NULL AND status='pending')) FROM isexy.donations WHERE stripe_session_id='cs_test_precreated';
SELECT pg_temp.assert_payment('replay preserves refund',status='refunded' AND completed_at IS NULL) FROM isexy.donations WHERE stripe_session_id='cs_test_topup_20';
UPDATE isexy.gift_transactions SET status='failed' WHERE stripe_session_id='cs_test_physical';
SET ROLE service_role;
SELECT isexy.fulfill_stripe_payment('cs_test_physical',:A,'gift_'||:'physical',2000,'usd',jsonb_build_object('recipient_profile_id',:B));
RESET ROLE;
SELECT pg_temp.assert_payment('replay preserves failed delivery',status='failed' AND completed_at IS NULL) FROM isexy.gift_transactions WHERE stripe_session_id='cs_test_physical';
SET ROLE authenticated;
SELECT pg_temp.payment_role(:A,'authenticated');
DO $$ BEGIN
  BEGIN
    PERFORM isexy.fulfill_stripe_payment('cs_test_forged','fafafafa-0000-0000-0000-000000000001','food_20',2000,'usd');
    RAISE EXCEPTION 'member reached service-only fulfillment';
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.assert_payment('fulfillment is service-only',true);
  END;
END $$;
RESET ROLE;
SELECT count(*) AS payment_assertions_passed FROM payment_results;
