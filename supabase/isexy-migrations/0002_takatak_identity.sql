-- ISEXY on TAKATAK V1: one identity everywhere.
--
-- Members sign in with Takatak Auth (shared auth.users). An ISEXY profile is
-- keyed by the auth user id: profiles.id = profiles.user_id = auth.users.id,
-- so every ISEXY foreign key (matches, messages, swipes, ...) points at the
-- same id the rest of TAKATAK uses. No trigger is added on auth.users: a V1
-- account only gets an ISEXY profile when the member signs up in ISEXY.

SET LOCAL search_path = isexy, extensions;

CREATE OR REPLACE FUNCTION isexy.profiles_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = isexy, pg_catalog
AS $$
BEGIN
  NEW.id := NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_id_from_user ON isexy.profiles;
CREATE TRIGGER profiles_id_from_user
  BEFORE INSERT ON isexy.profiles
  FOR EACH ROW EXECUTE FUNCTION isexy.profiles_id_from_user();

ALTER TABLE isexy.profiles DROP CONSTRAINT IF EXISTS profiles_id_is_user_id;
ALTER TABLE isexy.profiles ADD CONSTRAINT profiles_id_is_user_id CHECK (id = user_id);

COMMENT ON TABLE isexy.profiles IS
  'ISEXY member profile. id = user_id = auth.users.id (Takatak Auth on TAKATAK V1).';
