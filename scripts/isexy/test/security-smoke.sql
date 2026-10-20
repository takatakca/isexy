-- Smoke tests for supabase/isexy-migrations/0014_security_and_performance.sql
-- (security + DB performance pass). Run on a THROWAWAY local Postgres only
-- (never on V1), after:
--   psql "$ISEXY_DB_URL" -f scripts/isexy/test/v1-mock.sql
--   scripts/isexy/migrate.sh --apply        (0001-0014)
-- then (everything is rolled back):
--   printf 'BEGIN;\n\\i scripts/isexy/test/security-smoke.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q
-- Each closed hole is tried as a member (authenticated with request.jwt.claim(s)
-- set) and must fail; each legitimate path the app uses instead must still
-- work. Part C (performance) is checked on the catalog.
\set ON_ERROR_STOP on
SET client_min_messages = warning;
\o /dev/null

CREATE TEMP TABLE results (n serial, name text, ok boolean, detail text);
CREATE TEMP TABLE kept (k text PRIMARY KEY, v jsonb);
GRANT ALL ON results, kept TO authenticated, anon, service_role;
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
CREATE OR REPLACE FUNCTION pg_temp.keep(p_k text, p_v jsonb) RETURNS jsonb LANGUAGE sql AS $$
  INSERT INTO kept VALUES (p_k, p_v) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v RETURNING v;
$$;
CREATE OR REPLACE FUNCTION pg_temp.r(p_k text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT v FROM kept WHERE k = p_k;
$$;
-- The statement must be refused with insufficient_privilege (42501: RLS,
-- missing grant, or the 0014 guards); its effects are rolled back.
CREATE OR REPLACE FUNCTION pg_temp.refused(p_name text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  PERFORM pg_temp.ok(p_name, false, 'statement succeeded');
EXCEPTION
  WHEN insufficient_privilege THEN PERFORM pg_temp.ok(p_name, true, SQLERRM);
  WHEN OTHERS THEN PERFORM pg_temp.ok(p_name, false, SQLSTATE || ' ' || SQLERRM);
END;
$$;
-- The statement must run without error and touch exactly p_rows rows.
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

-- Members ------------------------------------------------------------------------
-- A and B matched, C outsider, M moderator, N and N2 new signups (no profile yet).
INSERT INTO auth.users (id, email) VALUES
 ('5ec00000-0000-4000-8000-00000000000a', 'a@sec.test'),
 ('5ec00000-0000-4000-8000-00000000000b', 'b@sec.test'),
 ('5ec00000-0000-4000-8000-00000000000c', 'c@sec.test'),
 ('5ec00000-0000-4000-8000-00000000000d', 'm@sec.test'),
 ('5ec00000-0000-4000-8000-00000000000e', 'n@sec.test'),
 ('5ec00000-0000-4000-8000-00000000000f', 'n2@sec.test');
INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, interested_in, is_active) VALUES
 ('5ec00000-0000-4000-8000-00000000000a', 'Ava',  '1990-01-01', 'woman', ARRAY['everyone'], true),
 ('5ec00000-0000-4000-8000-00000000000b', 'Ben',  '1991-01-01', 'man',   ARRAY['everyone'], true),
 ('5ec00000-0000-4000-8000-00000000000c', 'Cora', '1992-01-01', 'woman', ARRAY['everyone'], true),
 ('5ec00000-0000-4000-8000-00000000000d', 'Max',  '1985-01-01', 'man',   ARRAY['everyone'], true);
INSERT INTO isexy.user_roles (user_id, role) VALUES ('5ec00000-0000-4000-8000-00000000000d', 'moderator');
INSERT INTO isexy.matches (id, profile1_id, profile2_id, is_active)
VALUES ('5ec0a000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000b', true);
INSERT INTO isexy.messages (id, match_id, sender_id, content) VALUES
 ('5ec0b000-0000-4000-8000-000000000001', '5ec0a000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000b', 'hi Ava');
INSERT INTO isexy.user_credits (profile_id, credits, video_minutes) VALUES ('5ec00000-0000-4000-8000-00000000000a', 5, 5);
INSERT INTO isexy.boost_wallets (profile_id, boosts) VALUES ('5ec00000-0000-4000-8000-00000000000a', 1);
INSERT INTO isexy.allowances (profile_id) VALUES ('5ec00000-0000-4000-8000-00000000000a');
INSERT INTO isexy.credit_transactions (profile_id, amount, type, description)
VALUES ('5ec00000-0000-4000-8000-00000000000a', 5, 'bonus', 'seed');
INSERT INTO isexy.forum_categories (id, name) VALUES ('5ec0c000-0000-4000-8000-000000000001', 'General');
UPDATE isexy.profiles SET shadow_banned = true, shadow_banned_reason = 'spam' WHERE id = '5ec00000-0000-4000-8000-00000000000b';
UPDATE isexy.profiles SET is_active = false WHERE id = '5ec00000-0000-4000-8000-00000000000c';

-- A. Protected profile columns -----------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.refused('A member cannot set own is_premium',
  $q$UPDATE isexy.profiles SET is_premium = true WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$);
SELECT pg_temp.refused('A member cannot set own is_verified',
  $q$UPDATE isexy.profiles SET is_verified = true WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$);
SELECT pg_temp.refused('A member cannot set own likes_remaining',
  $q$UPDATE isexy.profiles SET likes_remaining = 9999 WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$);
SELECT pg_temp.refused('A member cannot set own subscription_tier / expiry',
  $q$UPDATE isexy.profiles SET subscription_tier = 'platinum', subscription_expires_at = now() + interval '1 year' WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$);
SELECT pg_temp.refused('A member cannot set own super_likes / boosts / super_boost_until',
  $q$UPDATE isexy.profiles SET super_likes_remaining = 50, boosts_remaining = 9, super_boost_until = now() + interval '1 day' WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$);
SELECT pg_temp.refused('A member cannot reset own swipe counters / cooldown / last boost',
  $q$UPDATE isexy.profiles SET daily_swipe_count = 0, last_swipe_reset_at = now() - interval '2 days', swipe_cooldown_until = NULL, last_boost_at = now() WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$);
SELECT pg_temp.refused('A member cannot set own promo flags',
  $q$UPDATE isexy.profiles SET first_purchase_promo_used = true, promo_expires_at = now() + interval '1 day' WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$);
SELECT pg_temp.refused('A member cannot set own is_cuban or referral_code directly',
  $q$UPDATE isexy.profiles SET is_cuban = true, referral_code = 'VIP0001' WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$);
SELECT pg_temp.refused('A member cannot change own id / user_id / created_at',
  $q$UPDATE isexy.profiles SET created_at = now() - interval '5 years' WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$);
SELECT pg_temp.rows('A member edits bio, interests, city, presence (1 row)',
  $q$UPDATE isexy.profiles SET bio = 'Hiking and coffee in Montreal', interests = ARRAY['hiking','coffee'], city = 'Montreal', last_active_at = now() WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$, 1);
SELECT pg_temp.rows('A settings save: distance, ages, show me, show gender (1 row)',
  $q$UPDATE isexy.profiles SET distance_preference = 50, age_min = 25, age_max = 45, interested_in = ARRAY['women'], show_gender = false, show_orientation = false WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$, 1);
SELECT pg_temp.rows('A a write that repeats protected values unchanged is allowed',
  $q$UPDATE isexy.profiles SET first_name = 'Ava', is_premium = false, subscription_tier = 'free', is_verified = false WHERE id = '5ec00000-0000-4000-8000-00000000000a'$q$, 1);
SELECT pg_temp.rows('A settings save: user_preferences upsert of own settings',
  $q$INSERT INTO isexy.user_preferences (user_id, settings) VALUES ('5ec00000-0000-4000-8000-00000000000a', '{"discovery": {"minPhotos": 1}}')
     ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings$q$, 1);
SELECT isexy.set_my_cuban_flag(true);
SELECT pg_temp.ok('A get_my_referral_code still stores a code', isexy.get_my_referral_code() IS NOT NULL, NULL);
SELECT pg_temp.ok('A RPC writes landed (set_my_cuban_flag: is_cuban, get_my_referral_code: referral_code)', is_cuban AND referral_code IS NOT NULL, referral_code)
  FROM isexy.profiles WHERE id = '5ec00000-0000-4000-8000-00000000000a';
SELECT isexy.set_my_cuban_flag(false);
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000b');
SELECT pg_temp.refused('A shadow-banned member cannot lift the ban',
  $q$UPDATE isexy.profiles SET shadow_banned = false, shadow_banned_at = NULL, shadow_banned_reason = NULL WHERE id = '5ec00000-0000-4000-8000-00000000000b'$q$);
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000c');
SELECT pg_temp.rows('A banned (inactive) member: own row not visible, filtered UPDATE touches nothing',
  $q$UPDATE isexy.profiles SET is_active = true WHERE id = '5ec00000-0000-4000-8000-00000000000c'$q$, 0);
SELECT pg_temp.refused('A banned (inactive) member cannot reactivate (unfiltered UPDATE reaches the trigger)',
  $q$UPDATE isexy.profiles SET is_active = true$q$);
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000e');
SELECT pg_temp.rows('A new member creates a profile with the defaults (trigger defaults = column defaults)',
  $q$INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, interested_in, bio, privacy_accepted)
     VALUES ('5ec00000-0000-4000-8000-00000000000e', 'Nia', '1996-01-01', 'woman', ARRAY['everyone'], 'New here', true)$q$, 1);
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000f');
SELECT pg_temp.refused('A new member cannot create a verified premium profile',
  $q$INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, is_verified, is_premium, subscription_tier)
     VALUES ('5ec00000-0000-4000-8000-00000000000f', 'Noa', '1996-01-01', 'woman', true, true, 'platinum')$q$);
SELECT pg_temp.refused('A new member cannot create a profile with more likes',
  $q$INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, likes_remaining)
     VALUES ('5ec00000-0000-4000-8000-00000000000f', 'Noa', '1996-01-01', 'woman', 100000)$q$);
SELECT pg_temp.refused('A member cannot create a profile for someone else',
  $q$INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender)
     VALUES ('5ec00000-0000-4000-8000-00000000000c', 'Noa', '1996-01-01', 'woman')$q$);
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000d');
SELECT pg_temp.rows('A staff (moderator) may change protected columns',
  $q$UPDATE isexy.profiles SET is_verified = true WHERE id = '5ec00000-0000-4000-8000-00000000000d'$q$, 1);
SELECT isexy.staff_set_profile_verified('5ec00000-0000-4000-8000-00000000000a', true);
RESET ROLE;
SELECT pg_temp.ok('A staff_set_profile_verified (SECURITY DEFINER) still works', is_verified, NULL)
  FROM isexy.profiles WHERE id = '5ec00000-0000-4000-8000-00000000000a';
SELECT pg_temp.ok('A nothing protected changed for A, B, C, N',
  bool_and(NOT is_premium AND subscription_tier = 'free' AND likes_remaining = 100 AND super_likes_remaining = 1
           AND (id <> '5ec00000-0000-4000-8000-00000000000b' OR shadow_banned)
           AND (id <> '5ec00000-0000-4000-8000-00000000000c' OR NOT is_active)
           AND (id <> '5ec00000-0000-4000-8000-00000000000e' OR (NOT is_verified AND is_active AND NOT is_cuban))),
  string_agg(first_name || ':' || subscription_tier || '/' || likes_remaining, ' '))
  FROM isexy.profiles WHERE id::text LIKE '5ec00000-%' AND id <> '5ec00000-0000-4000-8000-00000000000d';
SELECT pg_temp.ok('A edits and settings landed', bio = 'Hiking and coffee in Montreal' AND distance_preference = 50 AND age_min = 25 AND interested_in = ARRAY['women'],
  bio || ' / ' || distance_preference)
  FROM isexy.profiles WHERE id = '5ec00000-0000-4000-8000-00000000000a';
SET ROLE service_role;
SELECT pg_temp.as_service();
SELECT pg_temp.rows('A service role (edge functions) may still write protected columns',
  $q$UPDATE isexy.profiles SET likes_remaining = 99 WHERE id = '5ec00000-0000-4000-8000-00000000000e'$q$, 1);
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.as_anon();
SELECT pg_temp.rows('A anon updates no profile', $q$UPDATE isexy.profiles SET bio = 'x'$q$, 0);
SELECT pg_temp.refused('A anon cannot insert a profile',
  $q$INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender) VALUES ('5ec00000-0000-4000-8000-00000000000f', 'Noa', '1996-01-01', 'woman')$q$);
RESET ROLE;

-- B1. Money, ledger and call tables ---------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.refused('B1 member cannot INSERT credit_transactions',
  $q$INSERT INTO isexy.credit_transactions (profile_id, amount, type) VALUES ('5ec00000-0000-4000-8000-00000000000a', 1000, 'purchase')$q$);
SELECT pg_temp.refused('B1 member cannot INSERT boost_transactions',
  $q$INSERT INTO isexy.boost_transactions (profile_id, boost_type, action, quantity) VALUES ('5ec00000-0000-4000-8000-00000000000a', 'boost', 'purchase', 50)$q$);
SELECT pg_temp.refused('B1 member cannot INSERT a boost wallet',
  $q$INSERT INTO isexy.boost_wallets (profile_id, boosts) VALUES ('5ec00000-0000-4000-8000-00000000000e', 50)$q$);
SELECT pg_temp.rows('B1 member UPDATE of own boost wallet changes nothing',
  $q$UPDATE isexy.boost_wallets SET boosts = 99 WHERE profile_id = '5ec00000-0000-4000-8000-00000000000a'$q$, 0);
SELECT pg_temp.refused('B1 member cannot INSERT allowances',
  $q$INSERT INTO isexy.allowances (profile_id, weekly_super_likes, weekly_super_likes_max) VALUES ('5ec00000-0000-4000-8000-00000000000e', 99, 99)$q$);
SELECT pg_temp.rows('B1 member UPDATE of own allowances changes nothing',
  $q$UPDATE isexy.allowances SET weekly_super_likes = 99, monthly_boosts = 99 WHERE profile_id = '5ec00000-0000-4000-8000-00000000000a'$q$, 0);
SELECT pg_temp.refused('B1 member cannot INSERT star_transactions',
  $q$INSERT INTO isexy.star_transactions (sender_profile_id, receiver_profile_id, stars_amount, usd_value, transaction_type)
     VALUES ('5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000b', 5000, 0, 'gift')$q$);
SELECT pg_temp.refused('B1 member cannot INSERT gift_transactions',
  $q$INSERT INTO isexy.gift_transactions (sender_profile_id, receiver_profile_id, gift_package_id, amount_usd, status)
     VALUES ('5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000b', (SELECT id FROM isexy.gift_packages LIMIT 1), 0, 'completed')$q$);
SELECT pg_temp.refused('B1 member cannot INSERT coupon_redemptions',
  $q$INSERT INTO isexy.coupon_redemptions (coupon_id, profile_id, applied_benefit) VALUES (gen_random_uuid(), '5ec00000-0000-4000-8000-00000000000a', 'platinum')$q$);
SELECT pg_temp.refused('B1 member cannot INSERT a missed call for someone else',
  $q$INSERT INTO isexy.missed_calls (caller_id, receiver_id, match_id)
     VALUES ('5ec00000-0000-4000-8000-00000000000c', '5ec00000-0000-4000-8000-00000000000b', '5ec0a000-0000-4000-8000-000000000001')$q$);
SELECT pg_temp.refused('B1 member cannot INSERT missed calls directly at all (record_missed_call does)',
  $q$INSERT INTO isexy.missed_calls (caller_id, receiver_id, match_id)
     VALUES ('5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000b', '5ec0a000-0000-4000-8000-000000000001')$q$);
SELECT pg_temp.rows('B1 member cannot UPDATE the other member''s message (content)',
  $q$UPDATE isexy.messages SET content = 'edited by Ava' WHERE id = '5ec0b000-0000-4000-8000-000000000001'$q$, 0);
SELECT pg_temp.rows('B1 member cannot UPDATE read status directly',
  $q$UPDATE isexy.messages SET is_read = true WHERE match_id = '5ec0a000-0000-4000-8000-000000000001'$q$, 0);
SELECT pg_temp.ok('B1 SELECT policies kept: own ledger, wallet, credits readable',
  (SELECT count(*) FROM isexy.credit_transactions) = 1 AND (SELECT count(*) FROM isexy.boost_wallets) = 1
  AND (SELECT count(*) FROM isexy.user_credits) = 1 AND (SELECT count(*) FROM isexy.allowances) = 1, NULL);
-- Legitimate paths: chat send, read receipts (RPC), wallet, boost, credits.
SELECT pg_temp.rows('B1 member sends a message in the match',
  $q$INSERT INTO isexy.messages (match_id, sender_id, content) VALUES ('5ec0a000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000a', 'hi Ben')$q$, 1);
SELECT pg_temp.ok('B1 get_my_wallet', (w->>'boosts')::int = 1 AND (w->>'credits')::int = 5, w::text)
  FROM (SELECT isexy.get_my_wallet() AS w) x;
SELECT pg_temp.ok('B1 use_boost spends a wallet Boost', (r->>'success')::boolean, r::text)
  FROM (SELECT isexy.use_boost('5ec00000-0000-4000-8000-00000000000a', 'boost') AS r) x;
SELECT pg_temp.ok('B1 convert_credits_to_minutes', (r->>'success')::boolean AND (r->>'video_minutes')::int = 7, r::text)
  FROM (SELECT isexy.convert_credits_to_minutes(2, 'video') AS r) x;
SELECT pg_temp.ok('B1 ensure_user_credits', r IS NOT NULL, r::text)
  FROM (SELECT isexy.ensure_user_credits() AS r) x;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('B1 mark_messages_read marks the other member''s message', n = 1, n::text)
  FROM (SELECT isexy.mark_messages_read('5ec0a000-0000-4000-8000-000000000001') AS n) x;
-- Calls: session RPCs and the missed call.
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('B1 start_call', (r->>'success')::boolean, r::text)
  FROM (SELECT pg_temp.keep('S1', isexy.start_call('5ec0a000-0000-4000-8000-000000000001', 'video')) AS r) x;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('B1 answer_call', (r->>'success')::boolean, r::text)
  FROM (SELECT isexy.answer_call((pg_temp.r('S1')->>'call_session_id')::uuid) AS r) x;
SELECT pg_temp.ok('B1 mark_call_connected', (r->>'success')::boolean, r::text)
  FROM (SELECT isexy.mark_call_connected((pg_temp.r('S1')->>'call_session_id')::uuid) AS r) x;
SELECT pg_temp.ok('B1 end_call', r->>'status' = 'ended', r::text)
  FROM (SELECT isexy.end_call((pg_temp.r('S1')->>'call_session_id')::uuid, 'hangup') AS r) x;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.keep('S2', isexy.start_call('5ec0a000-0000-4000-8000-000000000001', 'video'));
RESET ROLE;
UPDATE isexy.video_call_sessions SET created_at = now() - interval '36 seconds' WHERE id = (pg_temp.r('S2')->>'call_session_id')::uuid;
SET ROLE authenticated;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('B1 record_missed_call still inserts the missed call', (r->>'success')::boolean AND r->>'missed_call_id' IS NOT NULL, r::text)
  FROM (SELECT isexy.record_missed_call((pg_temp.r('S2')->>'call_session_id')::uuid) AS r) x;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000b');
SELECT pg_temp.ok('B1 the receiver sees that missed call', count(*) = 1, count(*)::text)
  FROM isexy.missed_calls WHERE call_session_id = (pg_temp.r('S2')->>'call_session_id')::uuid;
RESET ROLE;
SELECT pg_temp.ok('B1 money tables unchanged by the refused writes (wallet 0 after one Boost, ledger rows only from RPCs)',
  (SELECT boosts FROM isexy.boost_wallets WHERE profile_id = '5ec00000-0000-4000-8000-00000000000a') = 0
  AND NOT EXISTS (SELECT 1 FROM isexy.credit_transactions WHERE amount = 1000)
  AND NOT EXISTS (SELECT 1 FROM isexy.boost_wallets WHERE profile_id = '5ec00000-0000-4000-8000-00000000000e')
  AND (SELECT content FROM isexy.messages WHERE id = '5ec0b000-0000-4000-8000-000000000001') = 'hi Ava', NULL);

-- B2. Same class of hole --------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.rows('B2 member cannot swap the other participant of a match',
  $q$UPDATE isexy.matches SET profile2_id = '5ec00000-0000-4000-8000-00000000000c' WHERE id = '5ec0a000-0000-4000-8000-000000000001'$q$, 0);
SELECT pg_temp.rows('B2 member cannot re-activate / change a match',
  $q$UPDATE isexy.matches SET is_active = true, last_message_at = now() WHERE id = '5ec0a000-0000-4000-8000-000000000001'$q$, 0);
SELECT pg_temp.refused('B2 member cannot INSERT swipes directly (skips perform_like limits)',
  $q$INSERT INTO isexy.swipes (swiper_id, swiped_id, action) VALUES ('5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000d', 'super_like')$q$);
SELECT pg_temp.ok('B2 perform_like records the like', (r->>'success')::boolean, r::text)
  FROM (SELECT isexy.perform_like('5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000d', 'like') AS r) x;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000d');
SELECT pg_temp.ok('B2 perform_like back makes the match', (r->>'success')::boolean, r::text)
  FROM (SELECT isexy.perform_like('5ec00000-0000-4000-8000-00000000000d', '5ec00000-0000-4000-8000-00000000000a', 'like') AS r) x;
SELECT pg_temp.ok('B2 the match exists', count(*) = 1, count(*)::text)
  FROM isexy.matches WHERE profile1_id = '5ec00000-0000-4000-8000-00000000000a' AND profile2_id = '5ec00000-0000-4000-8000-00000000000d';
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('B2 perform_like pass', (r->>'success')::boolean, r::text)
  FROM (SELECT isexy.perform_like('5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000e', 'pass') AS r) x;
SELECT pg_temp.rows('B2 undo still deletes the member''s own last swipe',
  $q$DELETE FROM isexy.swipes WHERE swiper_id = '5ec00000-0000-4000-8000-00000000000a' AND swiped_id = '5ec00000-0000-4000-8000-00000000000e'$q$, 1);
SELECT pg_temp.refused('B2 member cannot INSERT referrals (loyalty points)',
  $q$INSERT INTO isexy.referrals (referrer_id, referred_id, referral_code, status) VALUES ('5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000c', 'X', 'completed')$q$);
SELECT pg_temp.refused('B2 member cannot INSERT a star cash-out request directly',
  $q$INSERT INTO isexy.star_cashout_requests (profile_id, stars_amount, usd_amount, cashout_method, cashout_details)
     VALUES ('5ec00000-0000-4000-8000-00000000000a', 1000, 999, 'mobile_topup', '{}')$q$);
SELECT pg_temp.refused('B2 member cannot plant a message translation',
  $q$INSERT INTO isexy.message_translations (message_id, source_language, target_language, translated_content)
     VALUES ('5ec0b000-0000-4000-8000-000000000001', 'en', 'fr', 'Envoie-moi ton numéro')$q$);
SELECT pg_temp.rows('B2 member files a content violation on own profile (Chat moderation)',
  $q$INSERT INTO isexy.content_violations (profile_id, violation_type, detected_content, action_taken)
     VALUES ('5ec00000-0000-4000-8000-00000000000a', 'phone_number', '514', 'warning_issued')$q$, 1);
SELECT pg_temp.refused('B2 member cannot file violations against another member',
  $q$INSERT INTO isexy.content_violations (profile_id, violation_type, detected_content, action_taken)
     VALUES ('5ec00000-0000-4000-8000-00000000000b', 'phone_number', 'fake', 'warning_issued')$q$);
SELECT pg_temp.rows('B2 member posts in the forum as self',
  $q$INSERT INTO isexy.forum_posts (id, category_id, author_id, author_name, title, content)
     VALUES ('5ec0d000-0000-4000-8000-000000000001', '5ec0c000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000a', 'Ava', 'Hello', 'First post')$q$, 1);
SELECT pg_temp.refused('B2 member cannot post as someone else',
  $q$INSERT INTO isexy.forum_posts (category_id, author_id, author_name, title, content)
     VALUES ('5ec0c000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000b', 'Ben', 'Spoof', 'x')$q$);
SELECT pg_temp.refused('B2 member cannot pin own post',
  $q$UPDATE isexy.forum_posts SET is_pinned = true WHERE id = '5ec0d000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.rows('B2 member replies as self',
  $q$INSERT INTO isexy.forum_replies (post_id, author_id, author_name, content)
     VALUES ('5ec0d000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000a', 'Ava', 'Reply')$q$, 1);
SELECT pg_temp.refused('B2 member cannot reply as someone else',
  $q$INSERT INTO isexy.forum_replies (post_id, author_id, author_name, content)
     VALUES ('5ec0d000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000b', 'Ben', 'Spoof')$q$);
SELECT pg_temp.ok('B2 reply_count trigger still fires (EXECUTE revoked)', reply_count = 1, reply_count::text)
  FROM isexy.forum_posts WHERE id = '5ec0d000-0000-4000-8000-000000000001';
SELECT pg_temp.rows('B2 member schedules a call in an active match',
  $q$INSERT INTO isexy.scheduled_calls (id, match_id, scheduler_id, recipient_id, scheduled_at, status)
     VALUES ('5ec0e000-0000-4000-8000-000000000001', '5ec0a000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000b', now() + interval '1 day', 'pending')$q$, 1);
SELECT pg_temp.refused('B2 member cannot schedule a call with a stranger',
  $q$INSERT INTO isexy.scheduled_calls (match_id, scheduler_id, recipient_id, scheduled_at, status)
     VALUES ('5ec0a000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000c', now() + interval '1 day', 'pending')$q$);
SELECT pg_temp.refused('B2 member cannot schedule a call already "confirmed"',
  $q$INSERT INTO isexy.scheduled_calls (match_id, scheduler_id, recipient_id, scheduled_at, status)
     VALUES ('5ec0a000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000b', now() + interval '1 day', 'confirmed')$q$);
SELECT pg_temp.refused('B2 member cannot move a scheduled call to a stranger',
  $q$UPDATE isexy.scheduled_calls SET recipient_id = '5ec00000-0000-4000-8000-00000000000c' WHERE id = '5ec0e000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000b');
SELECT pg_temp.rows('B2 recipient confirms the scheduled call',
  $q$UPDATE isexy.scheduled_calls SET status = 'confirmed' WHERE id = '5ec0e000-0000-4000-8000-000000000001'$q$, 1);
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.rows('B2 member invites a friend to Double Hangout (pending)',
  $q$INSERT INTO isexy.double_date_pairs (id, user1_id, user2_id, status)
     VALUES ('5ec0f000-0000-4000-8000-000000000001', '5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000e', 'pending')$q$, 1);
SELECT pg_temp.refused('B2 member cannot create an already active pair',
  $q$INSERT INTO isexy.double_date_pairs (user1_id, user2_id, status) VALUES ('5ec00000-0000-4000-8000-00000000000a', '5ec00000-0000-4000-8000-00000000000b', 'active')$q$);
SELECT pg_temp.refused('B2 the inviter cannot accept for the invitee',
  $q$UPDATE isexy.double_date_pairs SET status = 'active', accepted_at = now() WHERE id = '5ec0f000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.refused('B2 the inviter cannot swap the invitee',
  $q$UPDATE isexy.double_date_pairs SET user2_id = '5ec00000-0000-4000-8000-00000000000b' WHERE id = '5ec0f000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000e');
SELECT pg_temp.rows('B2 the invitee accepts',
  $q$UPDATE isexy.double_date_pairs SET status = 'active', accepted_at = now() WHERE id = '5ec0f000-0000-4000-8000-000000000001'$q$, 1);
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.rows('B2 either member ends the pair',
  $q$UPDATE isexy.double_date_pairs SET status = 'ended' WHERE id = '5ec0f000-0000-4000-8000-000000000001'$q$, 1);
SELECT pg_temp.rows('B2 Cuban verification request starts pending (signup path, on hold)',
  $q$INSERT INTO isexy.cuban_verifications (profile_id, whatsapp_number, carnet_id) VALUES ('5ec00000-0000-4000-8000-00000000000a', '+5355555555', 'X1')$q$, 1);
SELECT pg_temp.refused('B2 member cannot file an approved Cuban verification',
  $q$INSERT INTO isexy.cuban_verifications (profile_id, whatsapp_number, carnet_id, verification_status, verified_at)
     VALUES ('5ec00000-0000-4000-8000-00000000000a', '+5355555555', 'X2', 'approved', now())$q$);
SELECT pg_temp.rows('B2 member uploads a photo into own folder',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('isexy-profile-photos', '5ec00000-0000-4000-8000-00000000000a/1.jpg')$q$, 1);
SELECT pg_temp.refused('B2 member cannot upload into another member''s folder',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('isexy-profile-photos', '5ec00000-0000-4000-8000-00000000000b/evil.jpg')$q$);
RESET ROLE;

-- B3. Functions -----------------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000a');
SELECT pg_temp.ok('B3 get_admin_users lists nobody to a member', count(*) = 0, count(*)::text) FROM isexy.get_admin_users();
SELECT pg_temp.as_user('5ec00000-0000-4000-8000-00000000000d');
SELECT pg_temp.ok('B3 get_admin_users lists staff to staff', count(*) >= 1, count(*)::text) FROM isexy.get_admin_users();
SELECT pg_temp.refused('B3 member cannot run purge_old_telemetry', $q$SELECT isexy.purge_old_telemetry()$q$);
SELECT pg_temp.refused('B3 member cannot run cleanup_expired_otps', $q$SELECT isexy.cleanup_expired_otps()$q$);
SELECT pg_temp.refused('B3 member cannot read calculate_profile_score', $q$SELECT isexy.calculate_profile_score('5ec00000-0000-4000-8000-00000000000a')$q$);
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.as_anon();
SELECT pg_temp.refused('B3 anon cannot call get_admin_users', $q$SELECT * FROM isexy.get_admin_users()$q$);
RESET ROLE;
SELECT pg_temp.ok('B3 EXECUTE grants: service-only, no anon, trigger functions closed',
  has_function_privilege('service_role', 'isexy.purge_old_telemetry()', 'EXECUTE')
  AND has_function_privilege('service_role', 'isexy.cleanup_expired_otps()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'isexy.deduct_call_minute(uuid, text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'isexy.deduct_call_minute(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'isexy.mark_voice_reply_read(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'isexy.assert_profile_owner(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'isexy.analytics_overview(integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'isexy.check_and_create_match()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'isexy.validate_message_allowed()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'isexy.increment_reply_count()', 'EXECUTE')
  AND has_function_privilege('anon', 'isexy.has_role(uuid, isexy.app_role)', 'EXECUTE'), NULL);
SELECT pg_temp.ok('B3 no SECURITY DEFINER function in isexy without a fixed search_path', count(*) = 0, string_agg(p.oid::regprocedure::text, ', '))
  FROM pg_proc p WHERE p.pronamespace = 'isexy'::regnamespace AND p.prosecdef
   AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%');

-- B4. Grants ------------------------------------------------------------------------
CREATE TABLE isexy._security_smoke_probe (id serial PRIMARY KEY);
SELECT pg_temp.ok('B4 no TRUNCATE/TRIGGER/REFERENCES for anon or authenticated on any isexy table (new ones too)',
  count(*) = 0, string_agg(c.relname || ':' || r.rolname, ', '))
  FROM pg_class c CROSS JOIN (VALUES ('anon'), ('authenticated')) r(rolname)
 WHERE c.relnamespace = 'isexy'::regnamespace AND c.relkind IN ('r', 'p')
   AND (has_table_privilege(r.rolname, c.oid, 'TRUNCATE') OR has_table_privilege(r.rolname, c.oid, 'TRIGGER')
        OR has_table_privilege(r.rolname, c.oid, 'REFERENCES'));
SELECT pg_temp.ok('B4 sequences: USAGE kept (nextval), UPDATE (setval) gone',
  bool_and(has_sequence_privilege('authenticated', c.oid, 'USAGE') AND NOT has_sequence_privilege('authenticated', c.oid, 'UPDATE')
           AND NOT has_sequence_privilege('anon', c.oid, 'UPDATE')), string_agg(c.relname, ', '))
  FROM pg_class c WHERE c.relnamespace = 'isexy'::regnamespace AND c.relkind = 'S';
SELECT pg_temp.ok('B4 PostgREST grants unchanged (SELECT/INSERT/UPDATE/DELETE, RLS decides)',
  has_table_privilege('authenticated', 'isexy.profiles', 'SELECT,INSERT,UPDATE,DELETE')
  AND has_table_privilege('authenticated', 'isexy._security_smoke_probe', 'SELECT,INSERT,UPDATE,DELETE'), NULL);
DROP TABLE isexy._security_smoke_probe;

-- C. Performance ----------------------------------------------------------------------
SET LOCAL search_path = public;
SELECT pg_temp.ok('C2 no isexy policy calls auth.*() or has_role(auth.uid()) per row',
  count(*) = 0, string_agg(tablename || '.' || policyname, ', '))
  FROM pg_policies
 WHERE (schemaname = 'isexy' OR (schemaname = 'storage' AND policyname LIKE 'isexy: %'))
   AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )(?<!SELECT \()(auth\.(uid|jwt|role)\(\)|isexy\.has_role\()';
RESET search_path;
SELECT pg_temp.ok('C1 every isexy foreign key has a covering index', count(*) = 0, string_agg(fk.conrelid::regclass || '.' || fk.conname, ', '))
  FROM pg_constraint fk
 WHERE fk.contype = 'f' AND fk.connamespace = 'isexy'::regnamespace
   AND NOT EXISTS (
     SELECT 1 FROM pg_index i
      WHERE i.indrelid = fk.conrelid AND i.indisvalid
        AND (i.indkey::int2[])[0:cardinality(fk.conkey) - 1] @> fk.conkey
        AND (i.indkey::int2[])[0:cardinality(fk.conkey) - 1] <@ fk.conkey
        AND (i.indpred IS NULL OR pg_get_expr(i.indpred, i.indrelid) ~ 'IS NOT NULL'));
SELECT pg_temp.ok('C3 normalize_gender has a fixed search_path (main''s 0004)', EXISTS (SELECT 1 FROM unnest(proconfig) c WHERE c LIKE 'search_path=%'), array_to_string(proconfig, ','))
  FROM pg_proc WHERE oid = 'isexy.normalize_gender(text)'::regprocedure;
SELECT pg_temp.ok('C4 swipes_swiper_idx dropped, unique constraints on swipes and matches kept',
  to_regclass('isexy.swipes_swiper_idx') IS NULL
  AND (SELECT count(*) FROM pg_constraint WHERE conrelid = 'isexy.swipes'::regclass AND contype = 'u') = 2
  AND (SELECT count(*) FROM pg_constraint WHERE conrelid = 'isexy.matches'::regclass AND contype = 'u') = 2, NULL);

\o
-- Report ------------------------------------------------------------------------------
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, left(detail, 120) AS detail FROM results ORDER BY n;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM results WHERE NOT ok) THEN RAISE EXCEPTION 'security smoke tests failed'; END IF;
  RAISE WARNING 'all % security smoke tests passed', (SELECT count(*) FROM results);
END $$;
