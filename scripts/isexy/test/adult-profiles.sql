-- Assertions executed only against the disposable V1 stand-in in CI.
-- This rolls back all fixture data. Real users are never created.
BEGIN;

DO $tests$
DECLARE
  test_user uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email) VALUES (test_user, 'ci-isexy-adult@example.invalid');

  BEGIN
    INSERT INTO isexy.profiles (id, user_id, first_name, birth_date, gender)
    VALUES (test_user, test_user, 'Minor', (CURRENT_DATE - INTERVAL '17 years')::date, 'other');
    RAISE EXCEPTION 'ISEXY accepted a profile younger than 18';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO isexy.profiles (id, user_id, first_name, birth_date, gender)
  VALUES (test_user, test_user, 'Adult', (CURRENT_DATE - INTERVAL '18 years')::date, 'other');

  IF NOT EXISTS (SELECT 1 FROM isexy.profiles WHERE id = test_user) THEN
    RAISE EXCEPTION 'ISEXY rejected a profile exactly 18';
  END IF;

  BEGIN
    UPDATE isexy.profiles
       SET birth_date = (CURRENT_DATE - INTERVAL '17 years')::date
     WHERE id = test_user;
    RAISE EXCEPTION 'ISEXY allowed an adult profile to become underage';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  IF (SELECT birth_date FROM isexy.profiles WHERE id = test_user) <>
     (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'ISEXY failed to preserve the previous adult birth date';
  END IF;
END;
$tests$;

ROLLBACK;
