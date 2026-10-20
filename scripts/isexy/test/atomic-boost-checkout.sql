-- Runs against disposable stand-in only; everything rolls back.
BEGIN;

DO $tests$
DECLARE
  v_user_id uuid := gen_random_uuid();
  granted boolean;
BEGIN
  INSERT INTO auth.users(id,email)
  VALUES(v_user_id,'ci-isexy-boost@example.invalid');
  INSERT INTO isexy.profiles(id,user_id,first_name,birth_date,gender)
  VALUES(v_user_id,v_user_id,'Adult',(CURRENT_DATE - INTERVAL '22 years')::date,'other');

  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  BEGIN
    PERFORM isexy.fulfill_stripe_boost_purchase(
      v_user_id,'cs_test_isexy_boost_unauth','boost_10');
    RAISE EXCEPTION 'Member invoked service-only boost grant';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  granted := isexy.fulfill_stripe_boost_purchase(
    v_user_id,'cs_test_isexy_boost_1','boost_10');
  IF NOT granted THEN RAISE EXCEPTION 'Initial boost grant was rejected'; END IF;
  granted := isexy.fulfill_stripe_boost_purchase(
    v_user_id,'cs_test_isexy_boost_1','boost_10');
  IF granted THEN RAISE EXCEPTION 'Duplicate boost session was credited'; END IF;

  PERFORM isexy.fulfill_stripe_boost_purchase(
    v_user_id,'cs_test_isexy_boost_2','super_likes_15');
  PERFORM isexy.fulfill_stripe_boost_purchase(
    v_user_id,'cs_test_isexy_boost_3','primetime_3');
  PERFORM isexy.fulfill_stripe_boost_purchase(
    v_user_id,'cs_test_isexy_boost_4','superboost_6h');

  IF NOT EXISTS (SELECT 1 FROM isexy.boost_wallets
    WHERE profile_id=v_user_id AND boosts=10
      AND primetime_boosts=3 AND super_boost_hours=6)
  THEN RAISE EXCEPTION 'Incorrect boost wallet totals'; END IF;
  -- Since 0013 purchased Super Likes go to the spendable balance (the profile
  -- starts with 1), not to the weekly allowance maximum that the weekly reset
  -- refilled forever and sync_entitlements resets to the plan's value.
  IF NOT EXISTS (SELECT 1 FROM isexy.profiles
    WHERE id=v_user_id AND super_likes_remaining=16)
  THEN RAISE EXCEPTION 'Incorrect super-like balance'; END IF;
  IF EXISTS (SELECT 1 FROM isexy.allowances
    WHERE profile_id=v_user_id AND weekly_super_likes_max=15)
  THEN RAISE EXCEPTION 'Super Likes raised the weekly allowance'; END IF;
  IF (SELECT count(*) FROM isexy.boost_transactions
    WHERE profile_id=v_user_id) <> 4
  THEN RAISE EXCEPTION 'Boost transaction ledger inconsistency'; END IF;

  BEGIN
    PERFORM isexy.fulfill_stripe_boost_purchase(
      v_user_id,'cs_test_isexy_boost_invalid','boost_999');
    RAISE EXCEPTION 'Unlisted boost product was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$tests$;

ROLLBACK;
