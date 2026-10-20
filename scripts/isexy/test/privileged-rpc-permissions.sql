-- The stand-in database has no authenticated staff fixture: the staff
-- directory must therefore return an empty result to a normal member.
DO $test$
BEGIN
  IF has_function_privilege('anon', 'isexy.cleanup_expired_otps()'::regprocedure, 'EXECUTE')
  OR has_function_privilege('authenticated', 'isexy.cleanup_expired_otps()'::regprocedure, 'EXECUTE')
  OR has_function_privilege('anon', 'isexy.purge_old_telemetry()'::regprocedure, 'EXECUTE')
  OR has_function_privilege('authenticated', 'isexy.purge_old_telemetry()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Privileged ISEXY maintenance RPC is publicly callable';
  END IF;
  IF has_function_privilege('anon', 'isexy.get_admin_users()'::regprocedure, 'EXECUTE')
  OR NOT has_function_privilege('authenticated', 'isexy.get_admin_users()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Staff listing RPC permission misconfiguration';
  END IF;
END;
$test$;
