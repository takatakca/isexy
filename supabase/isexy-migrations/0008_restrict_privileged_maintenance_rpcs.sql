-- Protect sensitive maintenance procedures and staff directory against RPC abuse.
-- Do not modify TAKATAK shared public/auth objects.
SET LOCAL search_path = isexy, extensions;

REVOKE ALL ON FUNCTION isexy.cleanup_expired_otps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION isexy.purge_old_telemetry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.cleanup_expired_otps() TO service_role;
GRANT EXECUTE ON FUNCTION isexy.purge_old_telemetry() TO service_role;

-- The admin ticket page needs this RPC for authenticated staff, but the
-- original SECURITY DEFINER body exposed the staff directory to everyone.
CREATE OR REPLACE FUNCTION isexy.get_admin_users()
RETURNS TABLE(user_id uuid, role isexy.app_role, first_name text, profile_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $func$
  SELECT staff.user_id, staff.role, profile.first_name, profile.id
  FROM isexy.user_roles AS staff
  LEFT JOIN isexy.profiles AS profile ON profile.user_id = staff.user_id
  WHERE staff.role IN ('admin', 'moderator')
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM isexy.user_roles AS requester
        WHERE requester.user_id = auth.uid()
          AND requester.role IN ('admin', 'moderator')
      )
    );
$func$;

REVOKE ALL ON FUNCTION isexy.get_admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_admin_users() TO authenticated, service_role;
