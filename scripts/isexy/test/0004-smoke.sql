-- Smoke tests for supabase/isexy-migrations/0004_app_completion.sql.
-- Run on a THROWAWAY local Postgres only (never on V1), after:
--   psql "$ISEXY_DB_URL" -f scripts/isexy/test/v1-mock.sql
--   scripts/isexy/migrate.sh --apply
-- then (everything is rolled back):
--   printf 'BEGIN;\n\\i scripts/isexy/test/0004-smoke.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q
-- Fake members call each RPC as the authenticated / anon roles with
-- request.jwt.claim(s) set; at least one allowed and one forbidden call each.
\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE TEMP TABLE results (name text, ok boolean, detail text);
GRANT ALL ON results TO authenticated, anon;

-- Test members ---------------------------------------------------------------
-- A platinum, B free, C gold, D outsider, E moderator, F incognito
INSERT INTO auth.users (id, email, phone) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.ca', '+15145550001'),
 ('aaaaaaaa-0000-0000-0000-000000000002', 'b@test.ca', '+15145550002'),
 ('aaaaaaaa-0000-0000-0000-000000000003', 'c@test.ca', '+15145550003'),
 ('aaaaaaaa-0000-0000-0000-000000000004', 'd@test.ca', '+15145550004'),
 ('aaaaaaaa-0000-0000-0000-000000000005', 'e@test.ca', '+15145550005'),
 ('aaaaaaaa-0000-0000-0000-000000000006', 'f@test.ca', '+15145550006');

INSERT INTO isexy.profiles (user_id, first_name, birth_date, gender, interested_in, subscription_tier, is_active)
VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001', 'Ana',  '1990-01-01', 'woman', ARRAY['everyone'], 'platinum', true),
 ('aaaaaaaa-0000-0000-0000-000000000002', 'Bea',  '1991-01-01', 'woman', ARRAY['everyone'], 'free', true),
 ('aaaaaaaa-0000-0000-0000-000000000003', 'Cleo', '1992-01-01', 'woman', ARRAY['everyone'], 'gold', true),
 ('aaaaaaaa-0000-0000-0000-000000000004', 'Dan',  '1993-01-01', 'man',   ARRAY['everyone'], 'free', true),
 ('aaaaaaaa-0000-0000-0000-000000000005', 'Eve',  '1985-01-01', 'woman', ARRAY['everyone'], 'free', true),
 ('aaaaaaaa-0000-0000-0000-000000000006', 'Fay',  '1994-01-01', 'woman', ARRAY['everyone'], 'free', true);
INSERT INTO isexy.profile_photos (profile_id, photo_url, position)
SELECT id, 'https://x/' || first_name || '.jpg', 0 FROM isexy.profiles;
INSERT INTO isexy.user_roles (user_id, role) VALUES ('aaaaaaaa-0000-0000-0000-000000000005', 'moderator');

-- B likes A, C likes A, A super-likes D (no match), D likes A then A likes D? no.
INSERT INTO isexy.swipes (swiper_id, swiped_id, action) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'like'),
 ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'super_like'),
 ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004', 'super_like'),
 ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'like');

-- A match between B and C with 2 messages from C to B.
INSERT INTO isexy.matches (id, profile1_id, profile2_id, is_active)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', true);
INSERT INTO isexy.messages (match_id, sender_id, content, created_at) VALUES
 ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'hi', now() - interval '2 minutes'),
 ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'there', now() - interval '1 minute'),
 ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'hello', now());

INSERT INTO results SELECT 'C2 trigger sets matches.last_message_at',
  last_message_at IS NOT NULL AND last_message_at > now() - interval '5 seconds', last_message_at::text
  FROM isexy.matches WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- Group chat with B and C.
INSERT INTO isexy.group_chats (id, name) VALUES ('cccccccc-0000-0000-0000-000000000001', 'Hangout');
INSERT INTO isexy.group_chat_members (group_chat_id, profile_id) VALUES
 ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002'),
 ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003');

-- F is incognito.
INSERT INTO isexy.user_preferences (user_id, settings)
VALUES ('aaaaaaaa-0000-0000-0000-000000000006', '{"discovery": {"visibility": "incognito"}}');

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', p_uid, false),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false),
         set_config('request.jwt.claim.role', 'authenticated', false);
$$;

-- A1 get_likes_received ------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
INSERT INTO results SELECT 'A1 platinum sees 2 likers with names',
  count(*) = 2 AND bool_and(NOT locked) AND bool_and(first_name IS NOT NULL), string_agg(first_name, ',')
  FROM isexy.get_likes_received(30, NULL);
INSERT INTO results SELECT 'A1 plain select of received swipes is empty under RLS',
  count(*) = 0, count(*)::text FROM isexy.swipes WHERE swiped_id = 'aaaaaaaa-0000-0000-0000-000000000001';

SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
INSERT INTO results SELECT 'A1 free member gets anonymous locked rows',
  count(*) = 1 AND bool_and(locked) AND bool_and(liker_id IS NULL AND first_name IS NULL), count(*)::text
  FROM isexy.get_likes_received(30, NULL);
RESET ROLE;

SET ROLE anon;
DO $$ BEGIN
  PERFORM isexy.get_likes_received(30, NULL);
  INSERT INTO results VALUES ('A1 anon refused', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('A1 anon refused', true, SQLERRM);
END $$;
RESET ROLE;

-- A2 set_first_impression ----------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
INSERT INTO results SELECT 'A2 platinum attaches message to own super like',
  (r->>'success')::boolean, r::text
  FROM (SELECT isexy.set_first_impression('aaaaaaaa-0000-0000-0000-000000000004', 'Hello Dan') AS r) x;
INSERT INTO results SELECT 'A2 second call refused (once per super like)',
  NOT (r->>'success')::boolean AND r->>'error' = 'no_super_like', r::text
  FROM (SELECT isexy.set_first_impression('aaaaaaaa-0000-0000-0000-000000000004', 'Again') AS r) x;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
INSERT INTO results SELECT 'A2 free member refused (not_platinum)',
  r->>'error' = 'not_platinum', r::text
  FROM (SELECT isexy.set_first_impression('aaaaaaaa-0000-0000-0000-000000000001', 'Hi') AS r) x;
RESET ROLE;
INSERT INTO results SELECT 'A2 message stored on the swipe',
  message = 'Hello Dan', coalesce(message, 'NULL')
  FROM isexy.swipes WHERE swiper_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND swiped_id = 'aaaaaaaa-0000-0000-0000-000000000004';

-- B1/B2 settings + photo verification ----------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
INSERT INTO isexy.photo_verifications (profile_id, selfie_path)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002/selfie.jpg');
INSERT INTO results SELECT 'B2 member files own pending request', count(*) = 1, count(*)::text
  FROM isexy.photo_verifications;
DO $$ BEGIN
  INSERT INTO isexy.photo_verifications (profile_id, selfie_path)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001/selfie.jpg');
  INSERT INTO results VALUES ('B2 member cannot file for someone else', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('B2 member cannot file for someone else', true, SQLERRM);
END $$;
DO $$ BEGIN
  UPDATE isexy.photo_verifications SET status = 'approved';
  INSERT INTO results VALUES ('B2 member cannot approve own request (no UPDATE)', false, 'update allowed');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('B2 member cannot approve own request (no UPDATE)', true, SQLERRM);
END $$;
DO $$ BEGIN
  PERFORM isexy.review_photo_verification((SELECT id FROM isexy.photo_verifications LIMIT 1), true, NULL);
  INSERT INTO results VALUES ('B2 member cannot call review', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('B2 member cannot call review', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000004');
INSERT INTO results SELECT 'B2 other member cannot read the request', count(*) = 0, count(*)::text
  FROM isexy.photo_verifications;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000005');
INSERT INTO results SELECT 'B2 moderator approves', status = 'approved', status
  FROM isexy.review_photo_verification(
    (SELECT id FROM isexy.photo_verifications WHERE profile_id = 'aaaaaaaa-0000-0000-0000-000000000002'), true, NULL);
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
INSERT INTO isexy.user_preferences (user_id, settings) VALUES ('aaaaaaaa-0000-0000-0000-000000000002', '{"discovery": {"minPhotos": 1}}')
  ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings;
DO $$ BEGIN
  UPDATE isexy.user_preferences SET settings = '[]'::jsonb WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  INSERT INTO results VALUES ('B1 settings must be an object', false, 'array accepted');
EXCEPTION WHEN check_violation THEN
  INSERT INTO results VALUES ('B1 settings must be an object', true, SQLERRM);
END $$;
RESET ROLE;
INSERT INTO results SELECT 'B2 approval sets profiles.is_verified', is_verified, is_verified::text
  FROM isexy.profiles WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002';
SET ROLE anon;
DO $$ BEGIN
  PERFORM 1 FROM isexy.photo_verifications;
  INSERT INTO results VALUES ('B2 anon has no access to photo_verifications', false, 'select allowed');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('B2 anon has no access to photo_verifications', true, SQLERRM);
END $$;
RESET ROLE;

-- B3 get_discover_feed -------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000004');
INSERT INTO results SELECT 'B3 feed returns candidates and hides incognito Fay',
  count(*) > 0 AND NOT bool_or(first_name = 'Fay'), string_agg(first_name, ',')
  FROM isexy.get_discover_feed(30, '{}', false, NULL);
RESET ROLE;
-- Fay liked Dan: Dan sees her despite incognito.
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000006');
INSERT INTO isexy.swipes (swiper_id, swiped_id, action) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000004', 'like');
-- Dan lists Cleo's email in Block Contacts.
INSERT INTO isexy.user_preferences (user_id, settings)
VALUES ('aaaaaaaa-0000-0000-0000-000000000004', '{"blockedContacts": [{"email": "C@test.ca"}]}');
SET ROLE authenticated;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000004');
INSERT INTO results SELECT 'B3 incognito member visible to someone she liked; blocked contact hidden',
  bool_or(first_name = 'Fay') AND NOT bool_or(first_name = 'Cleo'), string_agg(first_name, ',')
  FROM isexy.get_discover_feed(30, '{}', false, NULL);
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000003');
INSERT INTO results SELECT 'B3 block contacts works both ways (Cleo does not see Dan)',
  NOT coalesce(bool_or(first_name = 'Dan'), false), coalesce(string_agg(first_name, ','), '(none)')
  FROM isexy.get_discover_feed(30, '{}', false, NULL);
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  PERFORM isexy.get_discover_feed(30, '{}', false, NULL);
  INSERT INTO results VALUES ('B3 anon refused', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('B3 anon refused', true, SQLERRM);
END $$;
RESET ROLE;

-- C1 mark_messages_read / C3 badges ------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
INSERT INTO results SELECT 'C3 Bea: 2 unread, 1 pending like (Dan)', unread_messages = 2 AND new_likes = 1,
  unread_messages || '/' || new_likes FROM isexy.get_my_badge_counts();
INSERT INTO results SELECT 'C1 Bea marks 2 messages read', n = 2, n::text
  FROM (SELECT isexy.mark_messages_read('bbbbbbbb-0000-0000-0000-000000000001') AS n) x;
INSERT INTO results SELECT 'C3 Bea: 0 unread after read', unread_messages = 0,
  unread_messages || '/' || new_likes FROM isexy.get_my_badge_counts();
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000004');
DO $$ BEGIN
  PERFORM isexy.mark_messages_read('bbbbbbbb-0000-0000-0000-000000000001');
  INSERT INTO results VALUES ('C1 outsider refused', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('C1 outsider refused', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
INSERT INTO results SELECT 'C3 Ana: 2 pending likes, same as get_likes_received', new_likes = 2,
  unread_messages || '/' || new_likes FROM isexy.get_my_badge_counts();
RESET ROLE;
INSERT INTO results SELECT 'C1 sender''s own message left unread', NOT is_read, is_read::text
  FROM isexy.messages WHERE content = 'hello';
SET ROLE anon;
DO $$ BEGIN
  PERFORM isexy.get_my_badge_counts();
  INSERT INTO results VALUES ('C3 anon refused', false, 'call succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('C3 anon refused', true, SQLERRM);
END $$;
RESET ROLE;

-- C4 group chat --------------------------------------------------------------
SET ROLE authenticated;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
INSERT INTO results SELECT 'C4 member sees group and 2 members (no recursion)',
  (SELECT count(*) FROM isexy.group_chats) = 1 AND (SELECT count(*) FROM isexy.group_chat_members) = 2, NULL;
INSERT INTO isexy.group_messages (group_chat_id, sender_id, content)
VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'hey all');
INSERT INTO results SELECT 'C4 member can post as self', count(*) = 1, count(*)::text FROM isexy.group_messages;
DO $$ BEGIN
  INSERT INTO isexy.group_messages (group_chat_id, sender_id, content)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'spoof');
  INSERT INTO results VALUES ('C4 spoofed sender rejected', false, 'insert succeeded');
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('C4 spoofed sender rejected', true, SQLERRM);
END $$;
SELECT pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000004');
INSERT INTO results SELECT 'C4 outsider sees nothing',
  (SELECT count(*) FROM isexy.group_chats) = 0 AND (SELECT count(*) FROM isexy.group_messages) = 0, NULL;
RESET ROLE;
SET ROLE anon;
INSERT INTO results SELECT 'C4 anon sees no group chats (no error)', count(*) = 0, count(*)::text FROM isexy.group_chats;
RESET ROLE;

-- Report ---------------------------------------------------------------------
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, detail FROM results;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM results WHERE NOT ok) THEN RAISE EXCEPTION 'smoke tests failed'; END IF;
  RAISE NOTICE 'all % smoke tests passed', (SELECT count(*) FROM results);
END $$;
