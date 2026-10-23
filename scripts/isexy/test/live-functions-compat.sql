-- Main's DEPLOYED edge functions (production, from origin/main) against the
-- final schema (0001-0014). Between "migrations applied" and "our functions
-- deployed" the live functions keep running: every database call they make
-- must still work, with the same answers, and the service-only RPCs must
-- still refuse members and anonymous callers. Run on a THROWAWAY local
-- Postgres only (never on V1), after v1-mock.sql + migrate.sh --apply:
--   printf 'BEGIN;\n\\i scripts/isexy/test/live-functions-compat.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q
-- Each block mirrors one function's calls (service role, as the functions use
-- SUPABASE_SERVICE_ROLE_KEY): isexy-stripe-webhook v6, isexy-reset-allowances
-- v3, isexy-send-whatsapp-otp, isexy-send-missed-call-notification,
-- isexy-twilio-inbound-phone-line / -call-status, isexy-ai-chat,
-- isexy-send-ticket-confirmation.
\set ON_ERROR_STOP on
SET client_min_messages = warning;
\o /dev/null

CREATE TEMP TABLE results (n serial, name text, ok boolean, detail text);
GRANT ALL ON results TO authenticated, anon, service_role;
GRANT ALL ON SEQUENCE results_n_seq TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, false),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false),
         set_config('request.jwt.claim.role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', '', false),
         set_config('request.jwt.claims', '{"role":"anon"}', false),
         set_config('request.jwt.claim.role', 'anon', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', '', false),
         set_config('request.jwt.claims', '{"role":"service_role"}', false),
         set_config('request.jwt.claim.role', 'service_role', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.ok(p_name text, p_ok boolean, p_detail text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  INSERT INTO results (name, ok, detail) VALUES (p_name, COALESCE(p_ok, false), p_detail);
$$;
-- Must run and touch exactly p_rows rows.
CREATE OR REPLACE FUNCTION pg_temp.rows(p_name text, p_sql text, p_rows integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_n integer;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM pg_temp.ok(p_name, v_n = p_rows, v_n || ' row(s)');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.ok(p_name, false, SQLSTATE || ' ' || SQLERRM);
END;
$$;
-- Must fail with exactly this SQLSTATE.
CREATE OR REPLACE FUNCTION pg_temp.fails(p_name text, p_sql text, p_state text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  PERFORM pg_temp.ok(p_name, false, 'statement succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.ok(p_name, SQLSTATE = p_state, SQLSTATE || ' ' || SQLERRM);
END;
$$;
-- Must return this text.
CREATE OR REPLACE FUNCTION pg_temp.returns(p_name text, p_sql text, p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v text;
BEGIN
  EXECUTE p_sql INTO v;
  PERFORM pg_temp.ok(p_name, v IS NOT DISTINCT FROM p_expected, coalesce(v, 'NULL'));
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.ok(p_name, false, SQLSTATE || ' ' || SQLERRM);
END;
$$;

-- Fixtures (service role writes, as the functions and staff tools do) ---------------
INSERT INTO auth.users (id, email) VALUES
 ('11fe0000-0000-4000-8000-00000000000a', 'live-a@compat.test'),
 ('11fe0000-0000-4000-8000-00000000000b', 'live-b@compat.test');
INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, interested_in, is_active) VALUES
 ('11fe0000-0000-4000-8000-00000000000a', 'Lia', '1990-01-01', 'woman', ARRAY['everyone'], true),
 ('11fe0000-0000-4000-8000-00000000000b', 'Leo', '1991-01-01', 'man',   ARRAY['everyone'], true);
INSERT INTO isexy.matches (id, profile1_id, profile2_id, is_active)
VALUES ('11fea000-0000-4000-8000-000000000001', '11fe0000-0000-4000-8000-00000000000a', '11fe0000-0000-4000-8000-00000000000b', true);

SET ROLE service_role;
SELECT pg_temp.as_service();

-- isexy-stripe-webhook v6: event log --------------------------------------------------
SELECT pg_temp.rows('webhook v6: event log insert (received)',
  $q$INSERT INTO isexy.stripe_webhook_events (stripe_event_id, event_type, stripe_session_id, processing_status)
     VALUES ('evt_live_compat_1', 'checkout.session.completed', 'cs_test_live_compat_sub', 'received')$q$, 1);
SELECT pg_temp.fails('webhook v6: a duplicate delivery still hits 23505 (answered 503 / duplicate)',
  $q$INSERT INTO isexy.stripe_webhook_events (stripe_event_id, event_type, processing_status)
     VALUES ('evt_live_compat_1', 'checkout.session.completed', 'received')$q$, '23505');
SELECT pg_temp.rows('webhook v6: mark processed',
  $q$UPDATE isexy.stripe_webhook_events SET processing_status = 'processed', processed_at = now() WHERE stripe_event_id = 'evt_live_compat_1'$q$, 1);

-- isexy-stripe-webhook v6: subscription checkout ----------------------------------------
SELECT pg_temp.rows('webhook v6: subscriptions upsert ON CONFLICT (profile_id) (needs 0013''s unique index)',
  $q$INSERT INTO isexy.subscriptions (profile_id, stripe_customer_id, stripe_subscription_id, status, tier, current_period_start, current_period_end)
     VALUES ('11fe0000-0000-4000-8000-00000000000a', 'cus_live_compat', 'sub_live_compat', 'active', 'gold', now(), now() + interval '30 days')
     ON CONFLICT (profile_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       status = EXCLUDED.status, tier = EXCLUDED.tier, current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end$q$, 1);
SELECT pg_temp.rows('webhook v6: same upsert again updates the row (retried event)',
  $q$INSERT INTO isexy.subscriptions (profile_id, stripe_customer_id, stripe_subscription_id, status, tier, current_period_start, current_period_end)
     VALUES ('11fe0000-0000-4000-8000-00000000000a', 'cus_live_compat', 'sub_live_compat', 'active', 'gold', now(), now() + interval '30 days')
     ON CONFLICT (profile_id) DO UPDATE SET status = EXCLUDED.status, tier = EXCLUDED.tier$q$, 1);
SELECT pg_temp.rows('webhook v6: profile premium write (service role passes the 0014 guard)',
  $q$UPDATE isexy.profiles SET is_premium = true, subscription_tier = 'gold', subscription_expires_at = now() + interval '30 days', first_purchase_promo_used = true
     WHERE id = '11fe0000-0000-4000-8000-00000000000a'$q$, 1);
SELECT pg_temp.returns('webhook v6: sync_entitlements(profile) as service role',
  $q$SELECT (isexy.sync_entitlements('11fe0000-0000-4000-8000-00000000000a') IS NOT NULL)::text$q$, 'true');
SELECT pg_temp.returns('webhook v6: after sync the member is Gold premium (the live write is not undone)',
  $q$SELECT is_premium || '/' || subscription_tier FROM isexy.profiles WHERE id = '11fe0000-0000-4000-8000-00000000000a'$q$, 'true/gold');
SELECT pg_temp.returns('webhook v6: sync_entitlements(unknown profile): same answer as on 0001-0012',
  $q$SELECT isexy.sync_entitlements('11fe0000-0000-4000-8000-0000000000ff')->>'error'$q$, 'Profile not found');

-- customer.subscription.updated / deleted
SELECT pg_temp.rows('webhook v6: subscription.updated by stripe_subscription_id',
  $q$UPDATE isexy.subscriptions SET status = 'past_due', tier = 'gold' WHERE stripe_subscription_id = 'sub_live_compat'$q$, 1);
SELECT pg_temp.returns('webhook v6: profile_id lookup by stripe_subscription_id',
  $q$SELECT profile_id::text FROM isexy.subscriptions WHERE stripe_subscription_id = 'sub_live_compat'$q$, '11fe0000-0000-4000-8000-00000000000a');
SELECT pg_temp.rows('webhook v6: subscription.deleted revokes premium',
  $q$UPDATE isexy.profiles SET is_premium = false, subscription_tier = 'free', subscription_expires_at = NULL WHERE id = '11fe0000-0000-4000-8000-00000000000a'$q$, 1);
SELECT pg_temp.returns('webhook v6: sync_entitlements after revoke',
  $q$SELECT (isexy.sync_entitlements('11fe0000-0000-4000-8000-00000000000a') IS NOT NULL)::text$q$, 'true');

-- chat subscription (v6 writes the rows itself)
SELECT pg_temp.rows('webhook v6: chat_subscriptions insert',
  $q$INSERT INTO isexy.chat_subscriptions (profile_id, plan_months, status, expires_at, stripe_session_id)
     VALUES ('11fe0000-0000-4000-8000-00000000000a', 1, 'active', now() + interval '30 days', 'cs_test_live_compat_chat')$q$, 1);
SELECT pg_temp.rows('webhook v6: chat ledger row (amount 0, category chat_sub)',
  $q$INSERT INTO isexy.credit_transactions (profile_id, amount, type, category, description, stripe_session_id)
     VALUES ('11fe0000-0000-4000-8000-00000000000a', 0, 'purchase', 'chat_sub', 'Chat subscription 1 month(s)', 'cs_test_live_compat_chat')$q$, 1);

-- credits / minutes (0011) and boosts (0012), contract unchanged
SELECT pg_temp.returns('webhook v6: fulfill_stripe_credit_purchase credits_25 -> true',
  $q$SELECT isexy.fulfill_stripe_credit_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_cr1', 'credits_25')::text$q$, 'true');
SELECT pg_temp.returns('webhook v6: same session again -> false (no double credit)',
  $q$SELECT isexy.fulfill_stripe_credit_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_cr1', 'credits_25')::text$q$, 'false');
SELECT pg_temp.returns('webhook v6: video_150 -> true',
  $q$SELECT isexy.fulfill_stripe_credit_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_cr2', 'video_150')::text$q$, 'true');
SELECT pg_temp.returns('webhook v6: balances = 30 credits, 150 video minutes (main''s catalog)',
  $q$SELECT credits || '/' || video_minutes FROM isexy.user_credits WHERE profile_id = '11fe0000-0000-4000-8000-00000000000a'$q$, '30/150');
SELECT pg_temp.fails('webhook v6: unknown package -> 22023',
  $q$SELECT isexy.fulfill_stripe_credit_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_cr3', 'credits_9999')$q$, '22023');
SELECT pg_temp.fails('webhook v6: malformed session id -> 22023',
  $q$SELECT isexy.fulfill_stripe_credit_purchase('11fe0000-0000-4000-8000-00000000000a', 'pi_123456789', 'credits_10')$q$, '22023');
SELECT pg_temp.returns('webhook v6: fulfill_stripe_boost_purchase boost_10 -> true',
  $q$SELECT isexy.fulfill_stripe_boost_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_b1', 'boost_10')::text$q$, 'true');
SELECT pg_temp.returns('webhook v6: boost replay -> false',
  $q$SELECT isexy.fulfill_stripe_boost_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_b1', 'boost_10')::text$q$, 'false');
SELECT pg_temp.returns('webhook v6: super_likes_3 -> true',
  $q$SELECT isexy.fulfill_stripe_boost_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_b2', 'super_likes_3')::text$q$, 'true');
SELECT pg_temp.returns('webhook v6: 10 boosts in the wallet, 3 Super Likes spendable (1 + 3)',
  $q$SELECT w.boosts || '/' || p.super_likes_remaining FROM isexy.boost_wallets w JOIN isexy.profiles p ON p.id = w.profile_id WHERE w.profile_id = '11fe0000-0000-4000-8000-00000000000a'$q$, '10/4');
SELECT pg_temp.fails('webhook v6: unknown boost product -> 22023',
  $q$SELECT isexy.fulfill_stripe_boost_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_b3', 'boost_999')$q$, '22023');
SELECT pg_temp.fails('webhook v6: unknown profile -> 22023 (never credits a stranger)',
  $q$SELECT isexy.fulfill_stripe_boost_purchase('11fe0000-0000-4000-8000-0000000000ff', 'cs_test_live_compat_b4', 'boost_1')$q$, '22023');

-- gifts and donations (v6 writes the rows itself)
SELECT pg_temp.rows('webhook v6: gift_transactions insert',
  $q$INSERT INTO isexy.gift_transactions (sender_profile_id, receiver_profile_id, gift_package_id, amount_usd, status, stripe_session_id, completed_at)
     SELECT '11fe0000-0000-4000-8000-00000000000a', '11fe0000-0000-4000-8000-00000000000b', id, 5, 'completed', 'cs_test_live_compat_gift', now()
       FROM isexy.gift_packages LIMIT 1$q$, (SELECT LEAST(count(*), 1)::int FROM isexy.gift_packages));
SELECT pg_temp.rows('webhook v6: donations insert',
  $q$INSERT INTO isexy.donations (donor_profile_id, amount_usd, donation_type, status, stripe_session_id, completed_at)
     VALUES ('11fe0000-0000-4000-8000-00000000000a', 5, 'cash', 'completed', 'cs_test_live_compat_don', now())$q$, 1);

-- isexy-reset-allowances v3 -----------------------------------------------------------------
SELECT pg_temp.returns('reset-allowances v3: reset_weekly_allowances() as service role',
  $q$SELECT (isexy.reset_weekly_allowances() >= 0)::text$q$, 'true');
SELECT pg_temp.returns('reset-allowances v3: reset_monthly_allowances() as service role',
  $q$SELECT (isexy.reset_monthly_allowances() >= 0)::text$q$, 'true');
SELECT pg_temp.rows('reset-allowances v3: promotions expiry update runs',
  $q$UPDATE isexy.promotions SET eligible = false WHERE offer_expires_at < now() AND redeemed_at IS NULL AND eligible = true$q$, 0);

-- isexy-send-whatsapp-otp ------------------------------------------------------------------
SELECT pg_temp.rows('whatsapp-otp: delete old codes',
  $q$DELETE FROM isexy.otp_codes WHERE email = 'whatsapp:+15145550100' AND type = 'whatsapp' AND used_at IS NULL$q$, 0);
SELECT pg_temp.rows('whatsapp-otp: store a code',
  $q$INSERT INTO isexy.otp_codes (email, code, type, expires_at) VALUES ('whatsapp:+15145550100', '123456', 'whatsapp', now() + interval '10 minutes')$q$, 1);
SELECT pg_temp.returns('whatsapp-otp: verify_otp wrong code (service role) -> invalid',
  $q$SELECT isexy.verify_otp('whatsapp:+15145550100', '000000', 'whatsapp')->>'valid'$q$, 'false');
SELECT pg_temp.returns('whatsapp-otp: verify_otp right code (service role) -> valid',
  $q$SELECT isexy.verify_otp('whatsapp:+15145550100', '123456', 'whatsapp')->>'valid'$q$, 'true');
SELECT pg_temp.returns('whatsapp-otp: a used code is refused',
  $q$SELECT isexy.verify_otp('whatsapp:+15145550100', '123456', 'whatsapp')->>'valid'$q$, 'false');

-- isexy-send-missed-call-notification -----------------------------------------------------
SELECT pg_temp.rows('missed-call: missed_calls insert (service role)',
  $q$INSERT INTO isexy.missed_calls (caller_id, receiver_id, match_id)
     VALUES ('11fe0000-0000-4000-8000-00000000000b', '11fe0000-0000-4000-8000-00000000000a', '11fea000-0000-4000-8000-000000000001')$q$, 1);
SELECT pg_temp.rows('missed-call: notified flags update',
  $q$UPDATE isexy.missed_calls SET notified_email = true, notified_push = true WHERE match_id = '11fea000-0000-4000-8000-000000000001'$q$, 1);

-- isexy-twilio-inbound-phone-line / isexy-twilio-call-status ---------------------------------
SELECT pg_temp.rows('twilio inbound: unknown caller log',
  $q$INSERT INTO isexy.phone_line_inbound_call_logs (call_sid, caller_hash, caller_masked, call_status, reason)
     VALUES ('CAlivecompat0', 'hash', '+15***00', 'ringing', 'no_caller_id')$q$, 1);
SELECT pg_temp.rows('twilio inbound: phone_line_menu call session',
  $q$INSERT INTO isexy.call_sessions (caller_profile_id, call_type, provider, provider_call_sid, status, started_at, answered_at)
     VALUES ('11fe0000-0000-4000-8000-00000000000a', 'phone_line_menu', 'twilio', 'CAlivecompat1', 'initiating', now(), now())$q$, 1);
SELECT pg_temp.rows('twilio call-status: update by provider_call_sid',
  $q$UPDATE isexy.call_sessions SET status = 'completed', ended_at = now() WHERE provider_call_sid = 'CAlivecompat1'$q$, 1);

-- isexy-ai-chat -------------------------------------------------------------------------
SELECT pg_temp.rows('ai-chat: conversation, messages, handoff',
  $q$WITH c AS (INSERT INTO isexy.chatbot_conversations (user_id, session_id, status)
                VALUES ('11fe0000-0000-4000-8000-00000000000a', 'live-compat', 'active') RETURNING id),
          m AS (INSERT INTO isexy.chatbot_messages (conversation_id, role, content) SELECT id, 'user', 'hello' FROM c RETURNING 1)
     INSERT INTO isexy.live_chat_sessions (user_id, status, chatbot_conversation_id) SELECT '11fe0000-0000-4000-8000-00000000000a', 'waiting', id FROM c$q$, 1);

-- Service-only RPCs still refuse members and anonymous callers -----------------------------
RESET ROLE;
SET ROLE authenticated;
SELECT pg_temp.as_user('11fe0000-0000-4000-8000-00000000000a');
SELECT pg_temp.fails('member: fulfill_stripe_credit_purchase refused (42501)',
  $q$SELECT isexy.fulfill_stripe_credit_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_m1', 'credits_100')$q$, '42501');
SELECT pg_temp.fails('member: fulfill_stripe_boost_purchase refused (42501)',
  $q$SELECT isexy.fulfill_stripe_boost_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_m2', 'boost_20')$q$, '42501');
SELECT pg_temp.fails('member: fulfill_stripe_payment refused (42501)',
  $q$SELECT isexy.fulfill_stripe_payment('cs_test_live_compat_m3', '11fe0000-0000-4000-8000-00000000000a', 'credits_100')$q$, '42501');
SELECT pg_temp.fails('member: reset_weekly_allowances refused (42501)', $q$SELECT isexy.reset_weekly_allowances()$q$, '42501');
SELECT pg_temp.fails('member: reset_monthly_allowances refused (42501)', $q$SELECT isexy.reset_monthly_allowances()$q$, '42501');
SELECT pg_temp.fails('member: sync_entitlements of another member refused',
  $q$SELECT isexy.sync_entitlements('11fe0000-0000-4000-8000-00000000000b')$q$, '42501');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.as_anon();
SELECT pg_temp.fails('anon: fulfill_stripe_credit_purchase refused (42501)',
  $q$SELECT isexy.fulfill_stripe_credit_purchase('11fe0000-0000-4000-8000-00000000000a', 'cs_test_live_compat_a1', 'credits_100')$q$, '42501');
SELECT pg_temp.fails('anon: reset_monthly_allowances refused (42501)', $q$SELECT isexy.reset_monthly_allowances()$q$, '42501');
RESET ROLE;

-- Main's hardening of the functions 0013 replaces is kept (catalog) -----------------------
SELECT pg_temp.ok('catalog: main''s empty search_path kept (normalize_gender 0004, reset_monthly_allowances 0007, fulfill_stripe_* 0011/0012)',
  bool_and(proconfig = ARRAY['search_path=""']), string_agg(proname || ':' || array_to_string(proconfig, ','), ' '))
  FROM pg_proc
 WHERE pronamespace = 'isexy'::regnamespace
   AND proname IN ('normalize_gender', 'reset_monthly_allowances', 'fulfill_stripe_credit_purchase', 'fulfill_stripe_boost_purchase');
SELECT pg_temp.ok('catalog: main''s triggers still on (adult profiles 0006, ticket staff fields 0009)',
  count(*) = 2, string_agg(tgname, ', '))
  FROM pg_trigger
 WHERE tgenabled = 'O' AND tgname IN ('isexy_require_adult_profile', 'isexy_support_ticket_staff_fields_guard');
SELECT pg_temp.ok('catalog: main''s 12 relationship indexes (0005) kept', count(*) = 12, NULL)
  FROM pg_indexes WHERE schemaname = 'isexy' AND indexname LIKE 'idx\_isexy\_%';

\o
-- Report ------------------------------------------------------------------------------
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, left(detail, 120) AS detail FROM results ORDER BY n;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM results WHERE NOT ok) THEN RAISE EXCEPTION 'live functions compatibility tests failed'; END IF;
  RAISE WARNING 'all % live functions compatibility tests passed', (SELECT count(*) FROM results);
END $$;
