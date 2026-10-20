-- Enforce ISEXY's minimum declared age of 18 at the database boundary.
-- This protects direct Data API clients as well as the normal sign-up form.
-- Existing profile rows are not edited, and TAKATAK V1 public is untouched.
SET LOCAL search_path = isexy, extensions;

CREATE OR REPLACE FUNCTION isexy.reject_underage_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.birth_date > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'ISEXY is reserved for adults aged 18 or older'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS isexy_require_adult_profile ON isexy.profiles;
CREATE TRIGGER isexy_require_adult_profile
BEFORE INSERT OR UPDATE OF birth_date ON isexy.profiles
FOR EACH ROW EXECUTE FUNCTION isexy.reject_underage_profile();
