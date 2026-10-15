-- Prevent unauthenticated and member-triggered global subscription resets.
-- All changes are confined to ISEXY's schema; other TAKATAK products are untouched.
SET LOCAL search_path = isexy, extensions;

-- This job must only be called by the service-role client inside the
-- authenticated isexy-reset-allowances Edge Function.
REVOKE ALL ON FUNCTION isexy.reset_weekly_allowances() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION isexy.reset_monthly_allowances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.reset_weekly_allowances() TO service_role;
GRANT EXECUTE ON FUNCTION isexy.reset_monthly_allowances() TO service_role;

-- The prior monthly job regranted the boost wallet on *every* invocation.
-- Apply the grant only when the wallet is due for its own monthly reset.
CREATE OR REPLACE FUNCTION isexy.reset_monthly_allowances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE isexy.allowances
     SET monthly_boosts = monthly_boosts_max,
         monthly_reset_at = now() + interval '30 days',
         updated_at = now()
   WHERE monthly_reset_at <= now();

  UPDATE isexy.boost_wallets AS wallet
     SET monthly_boost_available = true,
         monthly_boost_reset_at = now() + interval '30 days',
         updated_at = now()
   WHERE (wallet.monthly_boost_reset_at IS NULL
          OR wallet.monthly_boost_reset_at <= now())
     AND wallet.profile_id IN (
       SELECT profile.id
         FROM isexy.profiles AS profile
        WHERE profile.subscription_tier IN ('gold', 'platinum')
          AND profile.subscription_expires_at > now()
     );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- A CREATE OR REPLACE does not change ownership or previous EXECUTE grants;
-- repeat revocation so privilege scope is explicit for future readers.
REVOKE ALL ON FUNCTION isexy.reset_monthly_allowances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.reset_monthly_allowances() TO service_role;
