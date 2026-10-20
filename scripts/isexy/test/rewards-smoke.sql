-- Smoke tests for part R of supabase/isexy-migrations/0013_app_completion.sql
-- (wf/rewards: points, credits, loyalty, boosts, payments). Run on a
-- THROWAWAY local Postgres only (never on V1), after v1-mock.sql and
-- migrate.sh --apply (0001-0013, part R included):
--   printf 'BEGIN;\n\\i scripts/isexy/test/rewards-smoke.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q
-- Fake members call each RPC as authenticated / anon / service_role with
-- request.jwt.claim(s) set: at least one allowed and one forbidden call each.
\set ON_ERROR_STOP on
SET client_min_messages = warning;
\o /dev/null

CREATE TEMP TABLE r_results (name text, ok boolean, detail text);
GRANT ALL ON r_results TO authenticated, anon, service_role;

-- Members: A free (new), B free (new), C gold, D platinum, E plus,
-- F old member (60 days), G moderator, H Cuban
INSERT INTO auth.users (id, email) VALUES
 ('dddddddd-0000-0000-0000-000000000001', 'ra@test.ca'),
 ('dddddddd-0000-0000-0000-000000000002', 'rb@test.ca'),
 ('dddddddd-0000-0000-0000-000000000003', 'rc@test.ca'),
 ('dddddddd-0000-0000-0000-000000000004', 'rd@test.ca'),
 ('dddddddd-0000-0000-0000-000000000005', 're@test.ca'),
 ('dddddddd-0000-0000-0000-000000000006', 'rf@test.ca'),
 ('dddddddd-0000-0000-0000-000000000007', 'rg@test.ca'),
 ('dddddddd-0000-0000-0000-000000000008', 'rh@test.ca');
INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, interested_in, is_active, created_at) VALUES
 ('dddddddd-0000-0000-0000-000000000001', 'Ari',  '1990-01-01', 'woman', ARRAY['everyone'], true, now()),
 ('dddddddd-0000-0000-0000-000000000002', 'Bo',   '1991-01-01', 'man',   ARRAY['everyone'], true, now()),
 ('dddddddd-0000-0000-0000-000000000003', 'Cy',   '1992-01-01', 'woman', ARRAY['everyone'], true, now()),
 ('dddddddd-0000-0000-0000-000000000004', 'Di',   '1993-01-01', 'woman', ARRAY['everyone'], true, now()),
 ('dddddddd-0000-0000-0000-000000000005', 'Ed',   '1994-01-01', 'man',   ARRAY['everyone'], true, now()),
 ('dddddddd-0000-0000-0000-000000000006', 'Flo',  '1980-01-01', 'woman', ARRAY['everyone'], true, now() - interval '60 days'),
 ('dddddddd-0000-0000-0000-000000000007', 'Gus',  '1985-01-01', 'man',   ARRAY['everyone'], true, now()),
 ('dddddddd-0000-0000-0000-000000000008', 'Hana', '1995-01-01', 'woman', ARRAY['everyone'], true, now());
INSERT INTO isexy.user_roles (user_id, role) VALUES ('dddddddd-0000-0000-0000-000000000007', 'moderator');

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, false),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false),
         set_config('request.jwt.claim.role', 'authenticated', false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', '', false),
         set_config('request.jwt.claims', '{"role":"service_role"}', false),
         set_config('request.jwt.claim.role', 'service_role', false);
$$;
-- Expect a call to be refused with insufficient_privilege (42501).
CREATE OR REPLACE FUNCTION pg_temp.refused(p_name text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  INSERT INTO r_results VALUES (p_name, false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO r_results VALUES (p_name, true, SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.refused(text, text) TO authenticated, anon, service_role;

\set A '''dddddddd-0000-0000-0000-000000000001'''
\set B '''dddddddd-0000-0000-0000-000000000002'''
\set C '''dddddddd-0000-0000-0000-000000000003'''
\set D '''dddddddd-0000-0000-0000-000000000004'''
\set E '''dddddddd-0000-0000-0000-000000000005'''
\set F '''dddddddd-0000-0000-0000-000000000006'''
\set H '''dddddddd-0000-0000-0000-000000000008'''

-- R1 credit_transactions.type ------------------------------------------------
INSERT INTO isexy.credit_transactions (profile_id, amount, type) VALUES (:A, -1, 'spend'), (:A, 1, 'referral_bonus');
INSERT INTO r_results VALUES ('R1 spend and referral_bonus accepted', true, NULL);
DO $$ BEGIN
  INSERT INTO isexy.credit_transactions (profile_id, amount, type) VALUES ('dddddddd-0000-0000-0000-000000000001', 1, 'bogus');
  INSERT INTO r_results VALUES ('R1 unknown type still rejected', false, 'insert succeeded');
EXCEPTION WHEN check_violation THEN
  INSERT INTO r_results VALUES ('R1 unknown type still rejected', true, SQLERRM);
END $$;
DELETE FROM isexy.credit_transactions WHERE profile_id = :A;  -- test rows only (rolled back)

-- R3 plans via service role (Stripe) ------------------------------------------
SET ROLE service_role;
SELECT pg_temp.as_service();
SELECT isexy.apply_stripe_subscription(:C, 'cus_c', 'sub_c', 'gold', 'active', now(), now() + interval '30 days');
SELECT isexy.apply_stripe_subscription(:D, 'cus_d', 'sub_d', 'platinum', 'active', now(), now() + interval '30 days');
SELECT isexy.apply_stripe_subscription(:E, 'cus_e', 'sub_e', 'plus', 'active', now(), now() + interval '30 days');
RESET ROLE;
INSERT INTO r_results SELECT 'R3 Stripe subscription sets the plan (gold/platinum/plus)',
  string_agg(first_name || ':' || subscription_tier || ':' || is_premium, ',' ORDER BY first_name) = 'Cy:gold:true,Di:platinum:true,Ed:plus:true',
  string_agg(first_name || ':' || subscription_tier || ':' || is_premium, ',' ORDER BY first_name)
  FROM isexy.profiles WHERE id IN (:C, :D, :E);
INSERT INTO r_results SELECT 'R3 gold: 5 weekly Super Likes, see who liked, monthly Boost',
  a.weekly_super_likes = 5 AND e.see_who_liked AND NOT e.priority_likes AND w.monthly_boost_available,
  a.weekly_super_likes || ' ' || e.see_who_liked || ' ' || e.priority_likes || ' ' || w.monthly_boost_available
  FROM isexy.allowances a JOIN isexy.entitlements_cache e USING (profile_id) JOIN isexy.boost_wallets w USING (profile_id)
  WHERE a.profile_id = :C;
INSERT INTO r_results SELECT 'R3 platinum: 3 First Impressions, priority likes',
  a.weekly_first_impressions = 3 AND e.priority_likes AND e.pre_match_message, a.weekly_first_impressions::text
  FROM isexy.allowances a JOIN isexy.entitlements_cache e USING (profile_id) WHERE a.profile_id = :D;
INSERT INTO r_results SELECT 'R3 one subscriptions row per member', count(*) = 3, count(*)::text
  FROM isexy.subscriptions WHERE profile_id IN (:C, :D, :E);
SET ROLE service_role;
SELECT pg_temp.as_service();
SELECT isexy.apply_stripe_subscription(:C, 'cus_c', 'sub_c', 'gold', 'active', now(), now() + interval '60 days');
RESET ROLE;
INSERT INTO r_results SELECT 'R3 renewal moves the end date, still one row',
  count(*) = 1 AND max(current_period_end) > now() + interval '50 days', count(*)::text
  FROM isexy.subscriptions WHERE profile_id = :C;

SET ROLE authenticated;
SELECT pg_temp.as_user(:C);
SELECT pg_temp.refused('R3 member cannot call refresh_member_plan', $q$SELECT isexy.refresh_member_plan('dddddddd-0000-0000-0000-000000000003')$q$);
SELECT pg_temp.refused('R4 member cannot call apply_stripe_subscription',
  $q$SELECT isexy.apply_stripe_subscription('dddddddd-0000-0000-0000-000000000003', 'x', 'sub_x', 'platinum', 'active', now(), now() + interval '1 year')$q$);
SELECT pg_temp.refused('R4 member cannot call fulfill_stripe_payment',
  $q$SELECT isexy.fulfill_stripe_payment('cs_fake', 'dddddddd-0000-0000-0000-000000000003', 'credits_100')$q$);
DO $$ BEGIN
  INSERT INTO isexy.plan_grants (profile_id, tier, source) VALUES ('dddddddd-0000-0000-0000-000000000003', 'platinum', 'staff');
  INSERT INTO r_results VALUES ('R3 member cannot insert plan_grants', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO r_results VALUES ('R3 member cannot insert plan_grants', true, SQLERRM);
END $$;
RESET ROLE;

-- R3 perform_like (ownership wrapper -> perform_like_unchecked) -------------
SET ROLE authenticated;
SELECT pg_temp.as_user(:A);
INSERT INTO r_results SELECT 'R3 free member: 1 starting Super Like spent',
  (r->>'success')::boolean AND (r->>'super_likes_remaining')::int = 0, r::text
  FROM (SELECT isexy.perform_like(:A, :B, 'super_like') AS r) x;
INSERT INTO r_results SELECT 'R3 free member: no second Super Like',
  r->>'error' = 'no_super_likes_remaining', r::text
  FROM (SELECT isexy.perform_like(:A, :F, 'super_like') AS r) x;
INSERT INTO r_results SELECT 'R3 free member: like spends likes_remaining',
  (r->>'likes_remaining')::int = 99, r::text
  FROM (SELECT isexy.perform_like(:A, :F, 'like') AS r) x;
SELECT pg_temp.refused('R3 like as someone else refused', $q$SELECT isexy.perform_like('dddddddd-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 'like')$q$);
SELECT pg_temp.as_user(:C);
INSERT INTO r_results SELECT 'R3 gold Super Like spends the weekly allowance first',
  (r->>'success')::boolean AND (r->>'super_likes_remaining')::int = 5, r::text  -- 4 weekly + 1 starting
  FROM (SELECT isexy.perform_like(:C, :A, 'super_like') AS r) x;
SELECT pg_temp.as_user(:E);
INSERT INTO r_results SELECT 'R3 plus: likes unlimited',
  (r->>'success')::boolean, r::text FROM (SELECT isexy.perform_like(:E, :A, 'like') AS r) x;
INSERT INTO r_results SELECT 'R3 plus: Super Likes not unlimited (1 starting one, then none)',
  (SELECT (isexy.perform_like(:E, :B, 'super_like')->>'success')::boolean)
  AND (SELECT isexy.perform_like(:E, :C, 'super_like')->>'error') = 'no_super_likes_remaining', NULL;
SELECT pg_temp.as_user(:D);
INSERT INTO r_results SELECT 'R3 platinum: Super Likes unlimited',
  (SELECT bool_and((isexy.perform_like(:D, x, 'super_like')->>'success')::boolean)
     FROM unnest(ARRAY[:A, :B, :C]::uuid[]) x), NULL;
RESET ROLE;
INSERT INTO r_results SELECT 'R3 platinum balance untouched', super_likes_remaining = 1, super_likes_remaining::text
  FROM isexy.profiles WHERE id = :D;

-- R4 fulfilment ----------------------------------------------------------------
SET ROLE service_role;
SELECT pg_temp.as_service();
INSERT INTO r_results SELECT 'R4 credits_25 adds 30 credits', (r->>'quantity')::int = 30, r::text
  FROM (SELECT isexy.fulfill_stripe_payment('cs_test_r1', :A, 'credits_25', 1999, 'cad') AS r) x;
INSERT INTO r_results SELECT 'R4 same session again changes nothing', (r->>'already_fulfilled')::boolean, r::text
  FROM (SELECT isexy.fulfill_stripe_payment('cs_test_r1', :A, 'credits_100', 5999, 'cad') AS r) x;
SELECT isexy.fulfill_stripe_payment('cs_test_r2', :A, 'video_20', 1500, 'cad');
SELECT isexy.fulfill_stripe_payment('cs_test_r3', :A, 'super_likes_15', 4890, 'cad');
SELECT isexy.fulfill_stripe_payment('cs_test_r4', :A, 'boost_10', 3290, 'cad');
SELECT isexy.fulfill_stripe_payment('cs_test_r5', :A, 'superboost_6h', 9299, 'cad');
SELECT isexy.fulfill_stripe_payment('cs_test_r6', :A, 'primetime_3', 2799, 'cad');
INSERT INTO r_results SELECT 'R4 unknown product refused', r->>'error' = 'unknown_product', r::text
  FROM (SELECT isexy.fulfill_stripe_payment('cs_test_r7', :A, 'credits_9999', 1, 'cad') AS r) x;
INSERT INTO r_results SELECT 'R4 chat subscription created',
  (r->>'status') = 'active', r::text
  FROM (SELECT isexy.apply_chat_subscription(:B, 'sub_chat_b', 'cs_chat_b', 'active', now() + interval '30 days') AS r) x;
SELECT isexy.apply_chat_subscription(NULL, 'sub_chat_b', NULL, 'active', now() + interval '60 days');
RESET ROLE;
INSERT INTO r_results SELECT 'R4 balances: 30 credits, 20 video min, 15 Super Likes, wallet 10/3/6h',
  c.credits = 30 AND c.video_minutes = 20 AND p.super_likes_remaining = 15
  AND w.boosts = 10 AND w.primetime_boosts = 3 AND w.super_boost_hours = 6,
  format('%s %s %s %s %s %s', c.credits, c.video_minutes, p.super_likes_remaining, w.boosts, w.primetime_boosts, w.super_boost_hours)
  FROM isexy.profiles p JOIN isexy.user_credits c ON c.profile_id = p.id JOIN isexy.boost_wallets w ON w.profile_id = p.id
  WHERE p.id = :A;
INSERT INTO r_results SELECT 'R4 one ledger row per session', count(*) = 1, count(*)::text
  FROM isexy.credit_transactions WHERE stripe_session_id = 'cs_test_r1';
INSERT INTO r_results SELECT 'R4 chat renewal extends the same row',
  count(*) = 1 AND max(expires_at) > now() + interval '50 days', count(*)::text
  FROM isexy.chat_subscriptions WHERE profile_id = :B;

-- Gift of Stars (Cuba on hold: bug fix) credits the receiver.
SET ROLE service_role;
SELECT pg_temp.as_service();
SELECT isexy.fulfill_stripe_payment('cs_test_gift', :A, 'gift_' || (SELECT id FROM isexy.gift_packages WHERE name = '500 Stars'),
  650, 'usd', jsonb_build_object('recipient_profile_id', :H, 'message', 'hi'));
SELECT isexy.fulfill_stripe_payment('cs_test_gift', :A, 'gift_' || (SELECT id FROM isexy.gift_packages WHERE name = '500 Stars'),
  650, 'usd', jsonb_build_object('recipient_profile_id', :H, 'message', 'hi'));
RESET ROLE;
INSERT INTO r_results SELECT 'R4 Stars gift credits 500 stars once', stars_balance = 500, stars_balance::text
  FROM isexy.user_stars WHERE profile_id = :H;

-- R5 wallet -----------------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user(:A);
INSERT INTO r_results SELECT 'R5 wallet shows the member balances',
  (w->>'credits')::int = 30 AND (w->>'boosts')::int = 10 AND (w->>'super_likes')::int = 15 AND w->>'tier' = 'free', w::text
  FROM (SELECT isexy.get_my_wallet() AS w) x;
SELECT pg_temp.as_user(:D);
INSERT INTO r_results SELECT 'R5 platinum wallet: unlimited Super Likes, plan from Stripe',
  (w->>'super_likes_unlimited')::boolean AND w->>'plan_source' = 'stripe', w::text
  FROM (SELECT isexy.get_my_wallet() AS w) x;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.refused('R5 anon cannot read a wallet', $q$SELECT isexy.get_my_wallet()$q$);
RESET ROLE;

-- R6 boosts -------------------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user(:A);
INSERT INTO r_results SELECT 'R6 Boost activates for 30 minutes', (r->>'success')::boolean, r::text
  FROM (SELECT isexy.use_boost(:A, 'boost') AS r) x;
INSERT INTO r_results SELECT 'R6 no second Boost while one is running', r->>'error' = 'boost_active', r::text
  FROM (SELECT isexy.use_boost(:A, 'primetime') AS r) x;
INSERT INTO r_results SELECT 'R6 Super Boost spends all banked hours', (r->>'hours')::int = 6, r::text
  FROM (SELECT isexy.use_boost(:A, 'super') AS r) x;
INSERT INTO r_results SELECT 'R6 free member has no monthly Boost', r->>'error' IN ('no_monthly_boost', 'boost_active'), r::text
  FROM (SELECT isexy.use_boost(:A, 'monthly') AS r) x;
SELECT pg_temp.refused('R6 cannot spend someone else''s Boost', $q$SELECT isexy.use_boost('dddddddd-0000-0000-0000-000000000003', 'monthly')$q$);
SELECT pg_temp.as_user(:C);
INSERT INTO r_results SELECT 'R6 gold monthly Boost works once', (r->>'success')::boolean, r::text
  FROM (SELECT isexy.use_boost(:C, 'monthly') AS r) x;
RESET ROLE;
INSERT INTO r_results SELECT 'R6 wallet after use: 9 Boosts, 0 Super Boost hours, Super Boost running',
  w.boosts = 9 AND w.super_boost_hours = 0 AND p.super_boost_until > now() + interval '5 hours',
  format('%s %s %s', w.boosts, w.super_boost_hours, p.super_boost_until)
  FROM isexy.boost_wallets w JOIN isexy.profiles p ON p.id = w.profile_id WHERE w.profile_id = :A;

-- R7 codes -----------------------------------------------------------------------------
INSERT INTO isexy.coupon_codes (code, code_type, subscription_tier, duration_days, max_uses) VALUES
 ('RWGOLD7', 'trial', 'gold', 7, 1),
 ('RWDISC', 'discount', NULL, NULL, NULL);
SET ROLE authenticated;
SELECT pg_temp.as_user(:B);
INSERT INTO r_results SELECT 'R7 discount code refused, not counted', NOT (r->>'success')::boolean, r::text
  FROM (SELECT isexy.redeem_coupon('rwdisc', :B) AS r) x;
INSERT INTO r_results SELECT 'R7 trial code gives Gold for 7 days', (r->>'success')::boolean, r::text
  FROM (SELECT isexy.redeem_coupon('rwgold7', :B) AS r) x;
SELECT pg_temp.refused('R7 cannot redeem for someone else', $q$SELECT isexy.redeem_coupon('RWGOLD7', 'dddddddd-0000-0000-0000-000000000001')$q$);
SELECT pg_temp.as_user(:A);
INSERT INTO r_results SELECT 'R7 max uses enforced', NOT (r->>'success')::boolean, r::text
  FROM (SELECT isexy.redeem_coupon('RWGOLD7', :A) AS r) x;
RESET ROLE;
UPDATE isexy.coupon_codes SET max_uses = NULL WHERE code = 'RWGOLD7';
SET ROLE authenticated;
SELECT pg_temp.as_user(:D);
INSERT INTO r_results SELECT 'R7 platinum member: Gold code refused (already covered), plan kept',
  NOT (r->>'success')::boolean, r::text
  FROM (SELECT isexy.redeem_coupon('RWGOLD7', :D) AS r) x;
RESET ROLE;
INSERT INTO r_results SELECT 'R7 plans after codes: Bo gold (7 days), Di platinum',
  string_agg(first_name || ':' || subscription_tier, ',' ORDER BY first_name) = 'Bo:gold,Di:platinum',
  string_agg(first_name || ':' || subscription_tier, ',' ORDER BY first_name)
  FROM isexy.profiles WHERE id IN (:B, :D);
INSERT INTO r_results SELECT 'R7 discount code use not counted', coalesce(current_uses, 0) = 0, current_uses::text
  FROM isexy.coupon_codes WHERE code = 'RWDISC';

-- R8 scheduler + plan end --------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user(:A);
SELECT pg_temp.refused('R8 member cannot reset weekly allowances', $q$SELECT isexy.reset_weekly_allowances()$q$);
SELECT pg_temp.refused('R8 member cannot grant monthly Boosts', $q$SELECT isexy.reset_monthly_allowances()$q$);
SELECT pg_temp.refused('R8 member cannot run expire_member_plans', $q$SELECT isexy.expire_member_plans()$q$);
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.as_service();
INSERT INTO r_results SELECT 'R8 monthly Boost not refilled before it is due', isexy.reset_monthly_allowances() = 0, NULL;
RESET ROLE;
UPDATE isexy.plan_grants SET starts_at = now() - interval '8 days', expires_at = now() - interval '1 day' WHERE profile_id = :B;
UPDATE isexy.profiles SET subscription_expires_at = now() - interval '1 day' WHERE id = :B;
SET ROLE service_role;
SELECT pg_temp.as_service();
SELECT isexy.expire_member_plans();
SELECT isexy.apply_stripe_subscription(NULL, NULL, 'sub_e', NULL, 'canceled', NULL, NULL);
RESET ROLE;
INSERT INTO r_results SELECT 'R8 expired code plan and canceled Stripe plan back to free',
  string_agg(first_name || ':' || subscription_tier || ':' || is_premium, ',' ORDER BY first_name) = 'Bo:free:false,Ed:free:false',
  string_agg(first_name || ':' || subscription_tier || ':' || is_premium, ',' ORDER BY first_name)
  FROM isexy.profiles WHERE id IN (:B, :E);
INSERT INTO r_results SELECT 'R8 entitlements follow the plan end', tier = 'free' AND NOT unlimited_likes, tier
  FROM isexy.entitlements_cache WHERE profile_id = :E;

-- R2 referrals ---------------------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user(:F);
INSERT INTO r_results SELECT 'R2 member gets a referral code', length(isexy.get_my_referral_code()) = 8, isexy.get_my_referral_code();
INSERT INTO r_results SELECT 'R2 same code on the next call',
  isexy.get_my_referral_code() = (SELECT referral_code FROM isexy.profiles WHERE id = :F), NULL;
SELECT pg_temp.as_user(:A);
INSERT INTO r_results SELECT 'R2 new member applies a code', (r->>'success')::boolean, r::text
  FROM (SELECT isexy.apply_referral_code((SELECT referral_code FROM isexy.profiles WHERE id = :F)) AS r) x;
INSERT INTO r_results SELECT 'R2 second code refused', NOT (r->>'success')::boolean, r::text
  FROM (SELECT isexy.apply_referral_code((SELECT referral_code FROM isexy.profiles WHERE id = :F)) AS r) x;
SELECT pg_temp.as_user(:B);
INSERT INTO r_results SELECT 'R2 the same code works for a second friend', (r->>'success')::boolean, r::text
  FROM (SELECT isexy.apply_referral_code((SELECT referral_code FROM isexy.profiles WHERE id = :F)) AS r) x;
INSERT INTO r_results SELECT 'R2 own code refused', NOT (r->>'success')::boolean, r::text
  FROM (SELECT isexy.apply_referral_code(isexy.get_my_referral_code()) AS r) x;
SELECT pg_temp.as_user(:F);
SELECT pg_temp.as_user(:A);
SELECT isexy.get_my_referral_code();
SELECT pg_temp.as_user(:F);
INSERT INTO r_results SELECT 'R2 old member (60 days) cannot apply a code', r->>'error' LIKE '%new members%', r::text
  FROM (SELECT isexy.apply_referral_code((SELECT referral_code FROM isexy.profiles WHERE id = :A)) AS r) x;
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-000000000007');
SELECT isexy.get_my_referral_code();
SELECT pg_temp.as_user(:H);
SELECT isexy.get_my_referral_code();
SELECT isexy.apply_referral_code((SELECT referral_code FROM isexy.profiles WHERE first_name = 'Gus'));
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-000000000007');
INSERT INTO r_results SELECT 'R2 swapping codes refused', r->>'error' LIKE '%cannot be swapped%', r::text
  FROM (SELECT isexy.apply_referral_code((SELECT referral_code FROM isexy.profiles WHERE id = :H)) AS r) x;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.refused('R2 anon cannot get a code', $q$SELECT isexy.get_my_referral_code()$q$);
RESET ROLE;
INSERT INTO r_results SELECT 'R2 credits: referrer 20, each friend 10 more',
  (SELECT credits FROM isexy.user_credits WHERE profile_id = :F) = 20
  AND (SELECT credits FROM isexy.user_credits WHERE profile_id = :B) = 10, NULL;

-- R9 loyalty ---------------------------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user(:F);
INSERT INTO r_results SELECT 'R9 first visit: streak 1, +5, referral points counted',
  (r->>'streak')::int = 1 AND (r->>'points')::int = 5 + 400, r::text
  FROM (SELECT isexy.record_daily_visit() AS r) x;
INSERT INTO r_results SELECT 'R9 second visit the same day adds nothing',
  (r->>'points_earned')::int = 0 AND (r->>'points')::int = 405, r::text
  FROM (SELECT isexy.record_daily_visit() AS r) x;
INSERT INTO r_results SELECT 'R9 badge not given on a browser-claimed streak',
  NOT (isexy.award_streak_badge('7_day', 99)->>'success')::boolean, NULL;
RESET ROLE;
UPDATE isexy.loyalty_accounts SET current_streak = 2, last_visit_on = (now() AT TIME ZONE 'America/Toronto')::date - 1
 WHERE profile_id = :F;
SET ROLE authenticated;
SELECT pg_temp.as_user(:F);
-- (same calendar day as the first visit, so no second daily +5: only the badge's +25)
INSERT INTO r_results SELECT 'R9 next visit: streak 3, 3-day badge, +25',
  (r->>'streak')::int = 3 AND r->'new_badges' ? '3_day' AND (r->>'points')::int = 430
  AND (r->>'points_earned')::int = 25, r::text
  FROM (SELECT isexy.record_daily_visit() AS r) x;
INSERT INTO r_results SELECT 'R9 rewards page shows the points and history',
  (l->>'points')::int = 430 AND jsonb_array_length(l->'history') >= 4, l::text
  FROM (SELECT isexy.get_my_loyalty() AS l) x;
INSERT INTO r_results SELECT 'R9 1 Super Like for 100 points', (r->>'success')::boolean AND (r->>'points')::int = 330, r::text
  FROM (SELECT isexy.redeem_loyalty_reward('super_like_1') AS r) x;
INSERT INTO r_results SELECT 'R9 Gold week refused without enough points', r->>'error' = 'not_enough_points', r::text
  FROM (SELECT isexy.redeem_loyalty_reward('gold_week') AS r) x;
INSERT INTO r_results SELECT 'R9 unknown reward refused', r->>'error' = 'unknown_reward', r::text
  FROM (SELECT isexy.redeem_loyalty_reward('free_money') AS r) x;
DO $$ BEGIN
  UPDATE isexy.loyalty_accounts SET points = 100000;
  INSERT INTO r_results VALUES ('R9 member cannot write own points', false, 'update allowed');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO r_results VALUES ('R9 member cannot write own points', true, SQLERRM);
END $$;
SELECT pg_temp.as_user(:A);
INSERT INTO r_results SELECT 'R9 members see only their own loyalty rows',
  (SELECT count(*) FROM isexy.loyalty_events WHERE profile_id = :F) = 0, NULL;
RESET ROLE;
UPDATE isexy.loyalty_accounts SET points = 1000 WHERE profile_id = :F;
SET ROLE authenticated;
SELECT pg_temp.as_user(:F);
INSERT INTO r_results SELECT 'R9 Gold week for 1000 points', (r->>'success')::boolean, r::text
  FROM (SELECT isexy.redeem_loyalty_reward('gold_week') AS r) x;
RESET ROLE;
INSERT INTO r_results SELECT 'R9 reward plan applied (gold) and Super Like given',
  subscription_tier = 'gold' AND is_premium AND super_likes_remaining = 2, subscription_tier || ' ' || super_likes_remaining
  FROM isexy.profiles WHERE id = :F;
SET ROLE anon;
SELECT pg_temp.refused('R9 anon cannot record a visit', $q$SELECT isexy.record_daily_visit()$q$);
SELECT pg_temp.refused('R9 anon cannot redeem', $q$SELECT isexy.redeem_loyalty_reward('super_like_1')$q$);
RESET ROLE;

-- R10 credits -> minutes ------------------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user(:A);
INSERT INTO r_results SELECT 'R10 10 credits become 10 video minutes',
  (r->>'success')::boolean AND (r->>'credits')::int = 30 AND (r->>'video_minutes')::int = 30, r::text
  FROM (SELECT isexy.convert_credits_to_minutes(10, 'video') AS r) x;
INSERT INTO r_results SELECT 'R10 cannot convert more than the balance', r->>'error' = 'not_enough_credits', r::text
  FROM (SELECT isexy.convert_credits_to_minutes(500, 'phone') AS r) x;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.refused('R10 anon cannot convert', $q$SELECT isexy.convert_credits_to_minutes(1, 'video')$q$);
RESET ROLE;

-- R11 protected writes -------------------------------------------------------------------------
UPDATE isexy.profiles SET is_cuban = true WHERE id = :H;
UPDATE isexy.user_stars SET stars_balance = 1500 WHERE profile_id = :H;
SET ROLE authenticated;
SELECT pg_temp.as_user(:H);
INSERT INTO r_results SELECT 'R11 cash-out amount computed on the server',
  (r->>'success')::boolean AND (r->>'usd_amount')::numeric = 10.00, r::text
  FROM (SELECT isexy.request_star_cashout(1000, 'mobile_topup', '{"usd_amount": 9999}') AS r) x;
INSERT INTO r_results SELECT 'R11 cash-out beyond the balance minus open requests refused',
  r->>'error' = 'invalid_amount', r::text
  FROM (SELECT isexy.request_star_cashout(1000, 'mobile_topup') AS r) x;
SELECT pg_temp.as_user(:A);
SELECT pg_temp.refused('R11 non-Cuban member cannot request a cash-out', $q$SELECT isexy.request_star_cashout(1000, 'mobile_topup')$q$);
SELECT isexy.set_my_cuban_flag();
INSERT INTO r_results SELECT 'R11 set_my_cuban_flag sets only the caller',
  (SELECT is_cuban FROM isexy.profiles WHERE id = :A) AND NOT coalesce((SELECT is_cuban FROM isexy.profiles WHERE id = :B), false), NULL;
SELECT isexy.set_my_cuban_flag(false);
INSERT INTO r_results SELECT 'R11 set_my_cuban_flag(false) clears the caller (tourist signup)',
  NOT (SELECT is_cuban FROM isexy.profiles WHERE id = :A), NULL;
SELECT isexy.set_my_cuban_flag(true);
SELECT pg_temp.refused('R11 member cannot create promotions (check_promo_eligibility)', $q$SELECT isexy.check_promo_eligibility('dddddddd-0000-0000-0000-000000000002', 'gold')$q$);
RESET ROLE;
SET ROLE service_role;
INSERT INTO r_results SELECT 'R11 service_role may call check_promo_eligibility',
  (r ? 'eligible'), r::text FROM (SELECT isexy.check_promo_eligibility(:B, 'gold') AS r) x;
RESET ROLE;
SET ROLE authenticated;
SELECT pg_temp.as_user(:A);
SELECT pg_temp.refused('R11 member cannot mark someone verified', $q$SELECT isexy.staff_set_profile_verified('dddddddd-0000-0000-0000-000000000001', true)$q$);
SELECT pg_temp.as_user('dddddddd-0000-0000-0000-000000000007');
SELECT isexy.staff_set_profile_verified(:A, true);
RESET ROLE;
INSERT INTO r_results SELECT 'R11 moderator marks a member verified', is_verified, NULL FROM isexy.profiles WHERE id = :A;
INSERT INTO r_results SELECT 'R11 cash-out row has the server amount', usd_amount = 10.00, usd_amount::text
  FROM isexy.star_cashout_requests WHERE profile_id = :H;

-- R4b main's 0011/0012 RPCs (the live webhook v6 calls them) share
-- fulfill_stripe_payment's crediting and its one-ledger-row-per-session rule.
RESET ROLE;
SELECT coalesce(p.super_likes_remaining, 0) AS sl_before, coalesce(a.weekly_super_likes_max, 0) AS max_before
  FROM isexy.profiles p LEFT JOIN isexy.allowances a ON a.profile_id = p.id WHERE p.id = :A \gset
SET ROLE service_role;
SELECT pg_temp.as_service();
INSERT INTO r_results SELECT 'R4b main credit RPC: a session fulfill_stripe_payment credited is a replay',
  NOT isexy.fulfill_stripe_credit_purchase(:A, 'cs_test_r1', 'credits_25'), NULL;
INSERT INTO r_results SELECT 'R4b main boost RPC credits a new session',
  isexy.fulfill_stripe_boost_purchase(:A, 'cs_test_r8', 'super_likes_3'), NULL;
INSERT INTO r_results SELECT 'R4b fulfill_stripe_payment: a session main''s boost RPC credited is a replay',
  (r->>'already_fulfilled')::boolean, r::text
  FROM (SELECT isexy.fulfill_stripe_payment('cs_test_r8', :A, 'super_likes_3') AS r) x;
DO $$ BEGIN
  PERFORM isexy.fulfill_stripe_payment('not_a_session', 'dddddddd-0000-0000-0000-000000000001', 'credits_10');
  INSERT INTO r_results VALUES ('R4b malformed Stripe session id refused', false, 'call succeeded');
EXCEPTION WHEN invalid_parameter_value THEN
  INSERT INTO r_results VALUES ('R4b malformed Stripe session id refused', true, SQLERRM);
END $$;
RESET ROLE;
INSERT INTO r_results SELECT 'R4b Super Likes from main''s RPC land in the balance (+3), not the weekly maximum',
  p.super_likes_remaining = :sl_before + 3 AND coalesce(a.weekly_super_likes_max, 0) = :max_before,
  format('%s -> %s, max %s -> %s', :sl_before, p.super_likes_remaining, :max_before, a.weekly_super_likes_max)
  FROM isexy.profiles p LEFT JOIN isexy.allowances a ON a.profile_id = p.id WHERE p.id = :A;
INSERT INTO r_results SELECT 'R4b one boost ledger row for that session', count(*) = 1, count(*)::text
  FROM isexy.boost_transactions WHERE stripe_session_id = 'cs_test_r8';
-- Even with a matching claim, a non-service role cannot reach them (grant).
SET ROLE authenticated;
SELECT pg_temp.as_service();
SELECT pg_temp.refused('R4b member role cannot call fulfill_stripe_credit_purchase',
  $q$SELECT isexy.fulfill_stripe_credit_purchase('dddddddd-0000-0000-0000-000000000001', 'cs_test_r9', 'credits_10')$q$);
RESET ROLE;

\o
-- Report ---------------------------------------------------------------------------------------
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, left(detail, 140) AS detail FROM r_results;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM r_results WHERE NOT ok) THEN RAISE EXCEPTION 'rewards smoke tests failed'; END IF;
  RAISE NOTICE 'all % rewards smoke tests passed', (SELECT count(*) FROM r_results);
END $$;
