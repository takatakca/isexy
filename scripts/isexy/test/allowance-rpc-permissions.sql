-- These checks run against disposable Postgres in GitHub Actions.
-- Service-role-only global resets cannot be reached from member/anon RPCs.
DO $test$
DECLARE
  routine regprocedure;
BEGIN
  FOREACH routine IN ARRAY ARRAY[
    'isexy.reset_weekly_allowances()'::regprocedure,
    'isexy.reset_monthly_allowances()'::regprocedure
  ] LOOP
    IF has_function_privilege('anon', routine, 'EXECUTE')
       OR has_function_privilege('authenticated', routine, 'EXECUTE') THEN
      RAISE EXCEPTION 'Global reset RPC % is accessible to a non-service role', routine;
    END IF;
    IF NOT has_function_privilege('service_role', routine, 'EXECUTE') THEN
      RAISE EXCEPTION 'Global reset RPC % is inaccessible to service role', routine;
    END IF;
  END LOOP;
END;
$test$;
