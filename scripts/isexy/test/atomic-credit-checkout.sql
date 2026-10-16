-- This suite executes on the disposable V1 stand-in only.
BEGIN;
DO $test$
DECLARE
  id uuid := gen_random_uuid();
  session_one text := 'cs_test_isexy_atomic_one';
  granted boolean;
BEGIN
  INSERT INTO auth.users(id, email)
  VALUES (id, 'ci-isexy-credit@example.invalid');
  INSERT INTO isexy.profiles(id,user_id,first_name,birth_date,gender)
  VALUES (id,id,'Adult',(CURRENT_DATE - INTERVAL '20 years')::date,'other');

  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  BEGIN
    PERFORM isexy.fulfill_stripe_credit_purchase(id, session_one, 'credits_10');
    RAISE EXCEPTION 'Authenticated customer invoked privileged Stripe grant';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  granted := isexy.fulfill_stripe_credit_purchase(id,session_one,'credits_10');
  IF NOT granted THEN RAISE EXCEPTION 'First credit grant rejected'; END IF;
  granted := isexy.fulfill_stripe_credit_purchase(id,session_one,'credits_10');
  IF granted THEN RAISE EXCEPTION 'Duplicate credit grant succeeded'; END IF;

  PERFORM isexy.fulfill_stripe_credit_purchase(id,'cs_test_isexy_atomic_two','phone_20');
  PERFORM isexy.fulfill_stripe_credit_purchase(id,'cs_test_isexy_atomic_three','video_150');
  IF NOT EXISTS (
    SELECT 1 FROM isexy.user_credits
    WHERE profile_id=id AND credits=10 AND lifetime_credits=10
      AND phone_minutes=20 AND video_minutes=150
  ) THEN RAISE EXCEPTION 'Atomic balances incorrect'; END IF;
  IF (SELECT count(*) FROM isexy.credit_transactions WHERE profile_id=id) <> 3
  THEN RAISE EXCEPTION 'Incorrect number of credit ledger records'; END IF;

  BEGIN
    PERFORM isexy.fulfill_stripe_credit_purchase(id,'cs_test_isexy_bad','credits_999');
    RAISE EXCEPTION 'Unsupported product granted credits';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$test$;
ROLLBACK;
