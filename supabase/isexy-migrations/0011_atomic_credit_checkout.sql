-- Atomic, retry-safe Stripe credit/minute fulfillment for ISEXY only.
-- A failed ledger write rolls back the wallet increment in the same transaction.
SET LOCAL search_path = isexy, extensions;

CREATE UNIQUE INDEX IF NOT EXISTS isexy_credit_transactions_stripe_session_unique
ON isexy.credit_transactions (stripe_session_id)
WHERE stripe_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION isexy.fulfill_stripe_credit_purchase(
  p_profile_id uuid,
  p_stripe_session_id text,
  p_package_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_amount integer;
  v_kind text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Stripe fulfillment is service-only' USING ERRCODE='42501';
  END IF;
  IF p_profile_id IS NULL OR p_stripe_session_id IS NULL
     OR length(p_stripe_session_id) < 8 OR length(p_stripe_session_id) > 255
     OR p_stripe_session_id NOT LIKE 'cs_%' THEN
    RAISE EXCEPTION 'Invalid Stripe session reference' USING ERRCODE='22023';
  END IF;

  CASE p_package_id
    WHEN 'credits_10' THEN v_amount := 10; v_kind := 'credits';
    WHEN 'credits_25' THEN v_amount := 30; v_kind := 'credits';
    WHEN 'credits_50' THEN v_amount := 65; v_kind := 'credits';
    WHEN 'credits_100' THEN v_amount := 140; v_kind := 'credits';
    WHEN 'phone_20' THEN v_amount := 20; v_kind := 'phone';
    WHEN 'phone_150' THEN v_amount := 150; v_kind := 'phone';
    WHEN 'phone_450' THEN v_amount := 450; v_kind := 'phone';
    WHEN 'video_20' THEN v_amount := 20; v_kind := 'video';
    WHEN 'video_150' THEN v_amount := 150; v_kind := 'video';
    WHEN 'video_450' THEN v_amount := 450; v_kind := 'video';
    ELSE RAISE EXCEPTION 'Unknown ISEXY package' USING ERRCODE='22023';
  END CASE;

  -- Serialize retries of a single Stripe session, including concurrent hooks.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('isexy:' || p_stripe_session_id, 0)
  );
  IF EXISTS (
    SELECT 1 FROM isexy.credit_transactions
     WHERE stripe_session_id = p_stripe_session_id
  ) THEN
    RETURN false;
  END IF;

  IF v_kind = 'credits' THEN
    INSERT INTO isexy.user_credits (profile_id, credits, lifetime_credits, last_purchase_at)
    VALUES (p_profile_id, v_amount, v_amount, now())
    ON CONFLICT (profile_id) DO UPDATE
       SET credits = isexy.user_credits.credits + EXCLUDED.credits,
           lifetime_credits = isexy.user_credits.lifetime_credits + EXCLUDED.lifetime_credits,
           last_purchase_at = now();
  ELSIF v_kind = 'phone' THEN
    INSERT INTO isexy.user_credits (profile_id, phone_minutes, last_purchase_at)
    VALUES (p_profile_id, v_amount, now())
    ON CONFLICT (profile_id) DO UPDATE
       SET phone_minutes = isexy.user_credits.phone_minutes + EXCLUDED.phone_minutes,
           last_purchase_at = now();
  ELSE
    INSERT INTO isexy.user_credits (profile_id, video_minutes, last_purchase_at)
    VALUES (p_profile_id, v_amount, now())
    ON CONFLICT (profile_id) DO UPDATE
       SET video_minutes = isexy.user_credits.video_minutes + EXCLUDED.video_minutes,
           last_purchase_at = now();
  END IF;

  INSERT INTO isexy.credit_transactions (
    profile_id, amount, type, category, description, stripe_session_id
  ) VALUES (
    p_profile_id, v_amount, 'purchase',
    CASE WHEN v_kind='credits' THEN 'general' ELSE v_kind END,
    'Purchased ' || v_amount || ' ' || v_kind || ' (' || p_package_id || ')',
    p_stripe_session_id
  );
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION isexy.fulfill_stripe_credit_purchase(uuid,text,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.fulfill_stripe_credit_purchase(uuid,text,text)
TO service_role;
