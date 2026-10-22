-- Atomic, idempotent Stripe purchases of ISEXY boosts and Super Likes.
-- Wallet grant and Stripe ledger insert must succeed or roll back together.
SET LOCAL search_path = isexy, extensions;

CREATE UNIQUE INDEX IF NOT EXISTS isexy_boost_transactions_stripe_session_unique
ON isexy.boost_transactions (stripe_session_id)
WHERE stripe_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION isexy.fulfill_stripe_boost_purchase(
  p_profile_id uuid,
  p_stripe_session_id text,
  p_product_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_count integer;
  v_category text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'ISEXY Stripe boost fulfillment is service-only'
      USING ERRCODE='42501';
  END IF;
  IF p_profile_id IS NULL OR p_stripe_session_id IS NULL
     OR length(p_stripe_session_id) < 8 OR length(p_stripe_session_id) > 255
     OR p_stripe_session_id NOT LIKE 'cs_%' THEN
    RAISE EXCEPTION 'Invalid Stripe session reference' USING ERRCODE='22023';
  END IF;

  CASE p_product_id
    WHEN 'super_likes_3' THEN v_count := 3; v_category := 'super_like';
    WHEN 'super_likes_15' THEN v_count := 15; v_category := 'super_like';
    WHEN 'super_likes_30' THEN v_count := 30; v_category := 'super_like';
    WHEN 'boost_1' THEN v_count := 1; v_category := 'boost';
    WHEN 'boost_10' THEN v_count := 10; v_category := 'boost';
    WHEN 'boost_20' THEN v_count := 20; v_category := 'boost';
    WHEN 'primetime_1' THEN v_count := 1; v_category := 'primetime_boost';
    WHEN 'primetime_3' THEN v_count := 3; v_category := 'primetime_boost';
    WHEN 'primetime_5' THEN v_count := 5; v_category := 'primetime_boost';
    WHEN 'superboost_3h' THEN v_count := 3; v_category := 'super_boost';
    WHEN 'superboost_6h' THEN v_count := 6; v_category := 'super_boost';
    WHEN 'superboost_12h' THEN v_count := 12; v_category := 'super_boost';
    ELSE RAISE EXCEPTION 'Unknown ISEXY boost product' USING ERRCODE='22023';
  END CASE;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('isexy:boost:' || p_stripe_session_id, 0)
  );
  IF EXISTS (
    SELECT 1 FROM isexy.boost_transactions
     WHERE stripe_session_id = p_stripe_session_id
  ) THEN RETURN false; END IF;

  IF v_category = 'super_like' THEN
    INSERT INTO isexy.allowances(profile_id, weekly_super_likes_max)
    VALUES (p_profile_id, v_count)
    ON CONFLICT (profile_id) DO UPDATE
      SET weekly_super_likes_max =
            isexy.allowances.weekly_super_likes_max + EXCLUDED.weekly_super_likes_max,
          updated_at = now();
  ELSIF v_category = 'boost' THEN
    INSERT INTO isexy.boost_wallets(profile_id, boosts)
    VALUES (p_profile_id, v_count)
    ON CONFLICT (profile_id) DO UPDATE
      SET boosts = isexy.boost_wallets.boosts + EXCLUDED.boosts,
          updated_at = now();
  ELSIF v_category = 'primetime_boost' THEN
    INSERT INTO isexy.boost_wallets(profile_id, primetime_boosts)
    VALUES (p_profile_id, v_count)
    ON CONFLICT (profile_id) DO UPDATE
      SET primetime_boosts =
            isexy.boost_wallets.primetime_boosts + EXCLUDED.primetime_boosts,
          updated_at = now();
  ELSE
    INSERT INTO isexy.boost_wallets(profile_id, super_boost_hours)
    VALUES (p_profile_id, v_count)
    ON CONFLICT (profile_id) DO UPDATE
      SET super_boost_hours =
            isexy.boost_wallets.super_boost_hours + EXCLUDED.super_boost_hours,
          updated_at = now();
  END IF;

  INSERT INTO isexy.boost_transactions (
    profile_id, boost_type, action, quantity, stripe_session_id
  ) VALUES (
    p_profile_id, v_category, 'credit', v_count, p_stripe_session_id
  );
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION isexy.fulfill_stripe_boost_purchase(uuid,text,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.fulfill_stripe_boost_purchase(uuid,text,text)
TO service_role;
