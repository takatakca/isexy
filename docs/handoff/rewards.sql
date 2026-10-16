-- FOLDED INTO supabase/isexy-migrations/0004_app_completion.sql (part R). Kept as the branch notes; do not apply this file.
-- ISEXY rewards area (branch wf/rewards): points, credits, loyalty, boosts and
-- payments. NOT a migration file: the integrator appends it to
-- supabase/isexy-migrations/0004_app_completion.sql (part R) before 0004 is
-- applied. isexy schema only. Idempotent (re-running changes nothing). Deletes
-- no data. Every SECURITY DEFINER function pins search_path = isexy,
-- extensions and checks auth.uid() itself; EXECUTE is revoked from PUBLIC and
-- anon, and granted to authenticated only for the member-facing RPCs. The
-- Stripe/scheduler functions are service_role only.
--
-- Goal: one economy where the browser never decides an amount. Balances,
-- plans and limits change only here or in the isexy-* payment functions
-- (which call the service_role functions below), so the Security stage can
-- drop the member INSERT/UPDATE policies on the wallet tables.
--
-- R1. credit_transactions.type accepts 'spend' and 'referral_bonus'.
-- R2. Referrals: one referral per new member (was: one per CODE, so a code
--     worked once), get_my_referral_code(), apply_referral_code() hardened.
-- R3. Plans: plan_grants (codes, rewards, staff), subscriptions one row per
--     member, refresh_member_plan() = the best active source decides
--     profiles.is_premium / subscription_tier / subscription_expires_at;
--     sync_entitlements_unchecked() with the plan table the pages show;
--     perform_like_unchecked() spends weekly then purchased Super Likes.
-- R4. Stripe fulfilment: fulfill_stripe_payment(), apply_stripe_subscription(),
--     apply_chat_subscription() (atomic, idempotent per Stripe session).
-- R5. get_my_wallet(): every balance in one read.
-- R6. use_boost_unchecked(): Boost, Primetime, monthly and Super Boost.
-- R7. redeem_coupon_unchecked(): locked, never downgrades, no fake "discount".
-- R8. Scheduler: reset_monthly_allowances() only when due,
--     expire_member_plans(), reset_daily_likes().
-- R9. Loyalty points and streaks earned for real actions, rewards redeemed
--     server-side; award_streak_badge() uses the server streak.
-- R10. convert_credits_to_minutes(): credits are spendable (1 credit = 1 min).
-- R11. Protected writes moved to RPCs: request_star_cashout(),
--     set_my_cuban_flag(), staff_set_profile_verified(); check_promo_eligibility()
--     (anyone could create promotion rows for any member) is service_role only.

SET LOCAL search_path = isexy, extensions;

-- ===========================================================================
-- R1. credit_transactions.type
-- ===========================================================================
-- The CHECK allows purchase/video_call/bonus/refund only, so
-- apply_referral_code ('referral_bonus') and every minute charge ('spend')
-- fail. Add the missing values, keeping whatever another part already added
-- (wf/calls widens the same CHECK for 'spend').
DO $$
DECLARE
  v_def text;
  v_val text;
  v_add text := '';
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conrelid = 'isexy.credit_transactions'::regclass
     AND conname = 'credit_transactions_type_check';
  IF v_def IS NULL OR position('ARRAY[' IN v_def) = 0 THEN
    RETURN;
  END IF;
  FOREACH v_val IN ARRAY ARRAY['spend', 'referral_bonus'] LOOP
    IF position(quote_literal(v_val) IN v_def) = 0 THEN
      v_add := v_add || quote_literal(v_val) || '::text, ';
    END IF;
  END LOOP;
  IF v_add <> '' THEN
    ALTER TABLE isexy.credit_transactions DROP CONSTRAINT credit_transactions_type_check;
    EXECUTE 'ALTER TABLE isexy.credit_transactions ADD CONSTRAINT credit_transactions_type_check '
         || replace(v_def, 'ARRAY[', 'ARRAY[' || v_add);
  END IF;
END;
$$;

-- ===========================================================================
-- R2. Referrals
-- ===========================================================================
-- referrals.referral_code was UNIQUE although every row of one referrer
-- carries the same code: the second friend using a code hit a unique
-- violation. The rule that matters is one referral per referred member.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM isexy.referrals WHERE referred_id IS NOT NULL
    GROUP BY referred_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_once_idx
      ON isexy.referrals (referred_id) WHERE referred_id IS NOT NULL;
    IF EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = 'isexy.referrals'::regclass AND conname = 'referrals_referral_code_key'
    ) THEN
      ALTER TABLE isexy.referrals DROP CONSTRAINT referrals_referral_code_key;
    END IF;
  ELSE
    RAISE NOTICE 'referrals: duplicate referred_id rows, unique code constraint kept';
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON isexy.referrals (referrer_id, created_at DESC);

-- The caller's referral code, created on first use (the page used to write
-- profiles.referral_code from the browser).
CREATE OR REPLACE FUNCTION isexy.get_my_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me UUID;
  v_code TEXT;
  i INTEGER;
BEGIN
  SELECT id, referral_code INTO v_me, v_code FROM isexy.profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;
  FOR i IN 1..8 LOOP
    BEGIN
      UPDATE isexy.profiles SET referral_code = isexy.generate_referral_code()
       WHERE id = v_me AND referral_code IS NULL
      RETURNING referral_code INTO v_code;
      IF v_code IS NULL THEN
        SELECT referral_code INTO v_code FROM isexy.profiles WHERE id = v_me;
      END IF;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- another member already has this random code: try again
    END;
  END LOOP;
  RAISE EXCEPTION 'could not create a referral code';
END;
$$;
REVOKE ALL ON FUNCTION isexy.get_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_referral_code() TO authenticated;

-- Apply a friend's code: new members only (profile younger than 30 days),
-- once, never your own code or a code of someone you referred, the referrer
-- must be an active member. Both get 10 credits; a referrer earns at most 20
-- referral bonuses per 30 days (the friend still gets theirs).
CREATE OR REPLACE FUNCTION isexy.apply_referral_code(p_friend_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me profiles%ROWTYPE;
  v_referrer profiles%ROWTYPE;
  v_code text := upper(btrim(coalesce(p_friend_code, '')));
  v_amount integer := 10;
  v_referrer_paid boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  SELECT * INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No profile');
  END IF;
  IF v_code !~ '^[A-Z0-9]{4,16}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  SELECT * INTO v_referrer FROM profiles
   WHERE referral_code = v_code AND is_active = true AND coalesce(shadow_banned, false) = false;
  IF v_referrer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  IF v_referrer.id = v_me.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot use your own code');
  END IF;
  IF v_me.created_at < now() - interval '30 days' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral codes are for new members (first 30 days)');
  END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referrer_id = v_me.id AND referred_id = v_referrer.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You invited this member: codes cannot be swapped');
  END IF;

  BEGIN
    INSERT INTO referrals (referrer_id, referred_id, referral_code, status, completed_at)
    VALUES (v_referrer.id, v_me.id, v_code, 'completed', now());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already used a referral code');
  END;

  v_referrer_paid := (
    SELECT count(*) FROM credit_transactions
     WHERE profile_id = v_referrer.id AND type = 'referral_bonus'
       AND description = 'Referral bonus' AND created_at > now() - interval '30 days'
  ) < 20;

  INSERT INTO user_credits (profile_id, credits, lifetime_credits)
  VALUES (v_me.id, v_amount, v_amount)
  ON CONFLICT (profile_id) DO UPDATE
    SET credits = user_credits.credits + v_amount,
        lifetime_credits = user_credits.lifetime_credits + v_amount,
        updated_at = now();
  INSERT INTO credit_transactions (profile_id, type, amount, description)
  VALUES (v_me.id, 'referral_bonus', v_amount, 'Welcome referral bonus');

  IF v_referrer_paid THEN
    INSERT INTO user_credits (profile_id, credits, lifetime_credits)
    VALUES (v_referrer.id, v_amount, v_amount)
    ON CONFLICT (profile_id) DO UPDATE
      SET credits = user_credits.credits + v_amount,
          lifetime_credits = user_credits.lifetime_credits + v_amount,
          updated_at = now();
    INSERT INTO credit_transactions (profile_id, type, amount, description)
    VALUES (v_referrer.id, 'referral_bonus', v_amount, 'Referral bonus');
  END IF;

  RETURN jsonb_build_object('success', true, 'credits', v_amount);
END;
$$;
REVOKE ALL ON FUNCTION isexy.apply_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.apply_referral_code(text) TO authenticated;

-- ===========================================================================
-- R3. Plans and limits
-- ===========================================================================
-- Plan table (the one Compare Plans shows):
--   Plus:     unlimited Likes and Rewinds, Passport, visibility controls, no ads
--   Gold:     + See who likes you, Top Picks, 5 Super Likes a week, 1 Boost a month
--   Platinum: + Priority Likes, message before matching, unlimited Super Likes,
--             3 First Impressions a week, 1 Boost a month
-- Free: 100 Likes a day; Super Likes only from the balance (1 to start,
-- bought, or earned with loyalty points).

CREATE OR REPLACE FUNCTION isexy.tier_rank(p_tier text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = isexy, extensions
AS $$
  SELECT CASE p_tier WHEN 'plus' THEN 1 WHEN 'gold' THEN 2 WHEN 'platinum' THEN 3 ELSE 0 END;
$$;

-- Stripe keeps one subscription row per member (the webhook upserts on
-- profile_id, which had no unique constraint, so it never wrote the row).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM isexy.subscriptions GROUP BY profile_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_profile_id_key ON isexy.subscriptions (profile_id);
  ELSE
    RAISE NOTICE 'subscriptions: several rows for one member, unique index not created';
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_idx
  ON isexy.subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Plans that do not come from Stripe: redeemed codes, loyalty rewards, staff.
CREATE TABLE IF NOT EXISTS isexy.plan_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES isexy.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('plus', 'gold', 'platinum')),
  source TEXT NOT NULL CHECK (source IN ('coupon', 'loyalty', 'staff')),
  source_ref TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,  -- NULL: permanent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE isexy.plan_grants ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS plan_grants_profile_idx ON isexy.plan_grants (profile_id, expires_at DESC);
DROP POLICY IF EXISTS "Members view own plan grants" ON isexy.plan_grants;
CREATE POLICY "Members view own plan grants" ON isexy.plan_grants
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));
REVOKE ALL ON isexy.plan_grants FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON isexy.plan_grants FROM authenticated;
GRANT SELECT ON isexy.plan_grants TO authenticated;

-- Entitlements and allowances for the member's current tier.
CREATE OR REPLACE FUNCTION isexy.sync_entitlements_unchecked(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_tier text;
  v_rank integer;
  v_super integer;
  v_fi integer;
  v_boosts integer;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  v_tier := CASE WHEN coalesce(v_profile.is_premium, false)
                 THEN coalesce(nullif(v_profile.subscription_tier, ''), 'free') ELSE 'free' END;
  IF tier_rank(v_tier) = 0 THEN v_tier := 'free'; END IF;
  v_rank := tier_rank(v_tier);
  v_super := CASE v_tier WHEN 'gold' THEN 5 ELSE 0 END;  -- Platinum: unlimited (perform_like)
  v_fi := CASE v_tier WHEN 'platinum' THEN 3 ELSE 0 END;
  v_boosts := CASE WHEN v_rank >= 2 THEN 1 ELSE 0 END;

  INSERT INTO entitlements_cache (profile_id, tier, unlimited_likes, unlimited_rewinds, passport_enabled,
    visibility_controls, ads_disabled, see_who_liked, priority_likes, top_picks_enabled,
    pre_match_message, priority_score_multiplier, weekly_super_likes, weekly_first_impressions, monthly_boosts)
  VALUES (
    p_profile_id, v_tier,
    v_rank >= 1, v_rank >= 1, v_rank >= 1, v_rank >= 1, v_rank >= 1,
    v_rank >= 2,
    v_rank >= 3,
    v_rank >= 2,
    v_rank >= 3,
    CASE v_tier WHEN 'platinum' THEN 2.0 WHEN 'gold' THEN 1.5 WHEN 'plus' THEN 1.2 ELSE 1.0 END,
    v_super, v_fi, v_boosts
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    tier = EXCLUDED.tier,
    unlimited_likes = EXCLUDED.unlimited_likes,
    unlimited_rewinds = EXCLUDED.unlimited_rewinds,
    passport_enabled = EXCLUDED.passport_enabled,
    visibility_controls = EXCLUDED.visibility_controls,
    ads_disabled = EXCLUDED.ads_disabled,
    see_who_liked = EXCLUDED.see_who_liked,
    priority_likes = EXCLUDED.priority_likes,
    top_picks_enabled = EXCLUDED.top_picks_enabled,
    pre_match_message = EXCLUDED.pre_match_message,
    priority_score_multiplier = EXCLUDED.priority_score_multiplier,
    weekly_super_likes = EXCLUDED.weekly_super_likes,
    weekly_first_impressions = EXCLUDED.weekly_first_impressions,
    monthly_boosts = EXCLUDED.monthly_boosts,
    last_synced_at = now(),
    updated_at = now();

  -- Weekly allowances: a member who moves up gets the new allowance at once;
  -- moving down caps what is left at the new maximum.
  INSERT INTO allowances (profile_id, weekly_super_likes, weekly_super_likes_max,
    weekly_first_impressions, weekly_first_impressions_max, monthly_boosts, monthly_boosts_max)
  VALUES (p_profile_id, v_super, v_super, v_fi, v_fi, v_boosts, v_boosts)
  ON CONFLICT (profile_id) DO UPDATE SET
    weekly_super_likes = CASE WHEN EXCLUDED.weekly_super_likes_max > allowances.weekly_super_likes_max
                              THEN EXCLUDED.weekly_super_likes_max
                              ELSE least(allowances.weekly_super_likes, EXCLUDED.weekly_super_likes_max) END,
    weekly_super_likes_max = EXCLUDED.weekly_super_likes_max,
    weekly_first_impressions = CASE WHEN EXCLUDED.weekly_first_impressions_max > allowances.weekly_first_impressions_max
                                    THEN EXCLUDED.weekly_first_impressions_max
                                    ELSE least(allowances.weekly_first_impressions, EXCLUDED.weekly_first_impressions_max) END,
    weekly_first_impressions_max = EXCLUDED.weekly_first_impressions_max,
    monthly_boosts = least(allowances.monthly_boosts, EXCLUDED.monthly_boosts_max),
    monthly_boosts_max = EXCLUDED.monthly_boosts_max,
    updated_at = now();

  -- Monthly Boost (Gold/Platinum): the first one comes with the plan, then
  -- reset_monthly_allowances() grants one every 30 days. Lost on downgrade.
  IF v_boosts > 0 THEN
    INSERT INTO boost_wallets (profile_id, monthly_boost_available, monthly_boost_reset_at)
    VALUES (p_profile_id, true, now() + interval '30 days')
    ON CONFLICT (profile_id) DO UPDATE SET
      monthly_boost_available = CASE WHEN boost_wallets.monthly_boost_reset_at IS NULL THEN true
                                     ELSE boost_wallets.monthly_boost_available END,
      monthly_boost_reset_at = coalesce(boost_wallets.monthly_boost_reset_at, now() + interval '30 days'),
      updated_at = now();
  ELSE
    UPDATE boost_wallets SET monthly_boost_available = false, monthly_boost_reset_at = NULL, updated_at = now()
     WHERE profile_id = p_profile_id AND (monthly_boost_available OR monthly_boost_reset_at IS NOT NULL);
  END IF;

  RETURN jsonb_build_object('success', true, 'tier', v_tier);
END;
$$;
REVOKE ALL ON FUNCTION isexy.sync_entitlements_unchecked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.sync_entitlements_unchecked(uuid) TO service_role;

-- The best active plan source decides the member's plan: an active Stripe
-- subscription (1 day of grace after the period end while Stripe renews),
-- a plan grant (code, reward, staff) or a code redeemed before plan_grants
-- existed. Highest tier wins, then the longest. Nothing active: free.
CREATE OR REPLACE FUNCTION isexy.refresh_member_plan(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_tier text;
  v_expires timestamptz;
  v_source text;
  v_found boolean := false;
BEGIN
  SELECT c.tier, c.expires_at, c.source, true INTO v_tier, v_expires, v_source, v_found
  FROM (
    SELECT s.tier, s.current_period_end AS expires_at, 'stripe' AS source
      FROM subscriptions s
     WHERE s.profile_id = p_profile_id
       AND s.status IN ('active', 'trialing')
       AND tier_rank(s.tier) > 0
       AND (s.current_period_end IS NULL OR s.current_period_end + interval '1 day' > now())
    UNION ALL
    SELECT g.tier, g.expires_at, g.source
      FROM plan_grants g
     WHERE g.profile_id = p_profile_id
       AND g.starts_at <= now()
       AND (g.expires_at IS NULL OR g.expires_at > now())
    UNION ALL
    SELECT split_part(r.applied_benefit, ':', 2), r.expires_at, 'coupon'
      FROM coupon_redemptions r
     WHERE r.profile_id = p_profile_id
       AND split_part(r.applied_benefit, ':', 1) IN ('trial', 'permanent', 'vip')
       AND tier_rank(split_part(r.applied_benefit, ':', 2)) > 0
       AND (r.expires_at IS NULL OR r.expires_at > now())
       AND NOT EXISTS (SELECT 1 FROM plan_grants g2 WHERE g2.source = 'coupon' AND g2.source_ref = r.id::text)
  ) c
  ORDER BY tier_rank(c.tier) DESC, (c.expires_at IS NULL) DESC, c.expires_at DESC
  LIMIT 1;

  IF v_found THEN
    UPDATE profiles SET is_premium = true, subscription_tier = v_tier, subscription_expires_at = v_expires,
           updated_at = now()
     WHERE id = p_profile_id
       AND (is_premium IS DISTINCT FROM true OR subscription_tier IS DISTINCT FROM v_tier
            OR subscription_expires_at IS DISTINCT FROM v_expires);
  ELSE
    v_tier := 'free';
    v_expires := NULL;
    v_source := NULL;
    UPDATE profiles SET is_premium = false, subscription_tier = 'free', subscription_expires_at = NULL,
           updated_at = now()
     WHERE id = p_profile_id
       AND (is_premium IS DISTINCT FROM false OR subscription_tier IS DISTINCT FROM 'free'
            OR subscription_expires_at IS NOT NULL);
  END IF;

  PERFORM sync_entitlements_unchecked(p_profile_id);
  RETURN jsonb_build_object('tier', v_tier, 'expires_at', v_expires, 'source', v_source);
END;
$$;
REVOKE ALL ON FUNCTION isexy.refresh_member_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.refresh_member_plan(uuid) TO service_role;

-- Likes and Super Likes (called through the perform_like ownership wrapper).
-- Likes: unlimited on any paid plan, otherwise profiles.likes_remaining.
-- Super Likes: unlimited on Platinum; otherwise this week's allowance first
-- (Gold: 5), then the member's balance (profiles.super_likes_remaining:
-- bought, earned, or the 1 every member starts with). Before, every paid
-- plan (Plus too) had unlimited Super Likes.
CREATE OR REPLACE FUNCTION isexy.perform_like_unchecked(p_swiper_id uuid, p_swiped_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_paid boolean;
  v_weekly integer;
  v_super_total integer;
BEGIN
  IF p_action NOT IN ('like', 'super_like', 'pass') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
  IF p_swiper_id = p_swiped_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot swipe on yourself');
  END IF;
  IF EXISTS (SELECT 1 FROM swipes WHERE swiper_id = p_swiper_id AND swiped_id = p_swiped_id) THEN
    RETURN jsonb_build_object('success', true, 'already_swiped', true);
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_swiper_id FOR UPDATE;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  v_paid := coalesce(v_profile.is_premium, false) AND tier_rank(v_profile.subscription_tier) > 0;

  IF p_action = 'like' AND NOT v_paid THEN
    IF coalesce(v_profile.likes_remaining, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_likes_remaining', 'likes_remaining', 0);
    END IF;
    UPDATE profiles SET likes_remaining = greatest(0, coalesce(likes_remaining, 0) - 1)
     WHERE id = p_swiper_id;
  ELSIF p_action = 'super_like' AND NOT (v_paid AND v_profile.subscription_tier = 'platinum') THEN
    SELECT weekly_super_likes INTO v_weekly FROM allowances WHERE profile_id = p_swiper_id FOR UPDATE;
    IF coalesce(v_weekly, 0) > 0 THEN
      UPDATE allowances SET weekly_super_likes = weekly_super_likes - 1, updated_at = now()
       WHERE profile_id = p_swiper_id;
    ELSIF coalesce(v_profile.super_likes_remaining, 0) > 0 THEN
      UPDATE profiles SET super_likes_remaining = super_likes_remaining - 1 WHERE id = p_swiper_id;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'no_super_likes_remaining', 'super_likes_remaining', 0);
    END IF;
  END IF;

  INSERT INTO swipes (swiper_id, swiped_id, action) VALUES (p_swiper_id, p_swiped_id, p_action);

  SELECT p.likes_remaining, coalesce(p.super_likes_remaining, 0) + coalesce(a.weekly_super_likes, 0)
    INTO v_profile.likes_remaining, v_super_total
    FROM profiles p LEFT JOIN allowances a ON a.profile_id = p.id
   WHERE p.id = p_swiper_id;

  RETURN jsonb_build_object(
    'success', true,
    'likes_remaining', v_profile.likes_remaining,
    'super_likes_remaining', v_super_total
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.perform_like_unchecked(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.perform_like_unchecked(uuid, uuid, text) TO service_role;

-- ===========================================================================
-- R4. Stripe fulfilment (service_role only; called by isexy-stripe-webhook
--     and isexy-check-subscription)
-- ===========================================================================
-- Chat subscriptions renew on Stripe: keep the Stripe subscription id so a
-- renewal extends the row instead of letting it expire after 30 days.
ALTER TABLE isexy.chat_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS chat_subscriptions_stripe_subscription_key
  ON isexy.chat_subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_subscriptions_profile_idx ON isexy.chat_subscriptions (profile_id, expires_at DESC);

-- One-time purchase. The server catalog decides what a product gives; the
-- ledger row is written first with the Stripe session id (unique), so a
-- retried or duplicated event changes nothing. All or nothing.
CREATE OR REPLACE FUNCTION isexy.fulfill_stripe_payment(
  p_session_id text,
  p_profile_id uuid,
  p_product text,
  p_amount_cents integer DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_kind text;
  v_qty integer;
  v_ledger uuid;
  v_gift gift_packages%ROWTYPE;
  v_recipient uuid;
  v_stars integer;
  v_amount numeric := round(coalesce(p_amount_cents, 0) / 100.0, 2);
BEGIN
  IF coalesce(p_session_id, '') = '' OR p_profile_id IS NULL OR coalesce(p_product, '') = '' THEN
    RAISE EXCEPTION 'session, profile and product are required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'unknown profile %', p_profile_id USING ERRCODE = '22023';
  END IF;

  -- Catalog: quantities live here, never in the Stripe metadata.
  SELECT k, q INTO v_kind, v_qty FROM (VALUES
    ('credits_10', 'credits', 10), ('credits_25', 'credits', 30),
    ('credits_50', 'credits', 65), ('credits_100', 'credits', 140),
    ('phone_20', 'phone', 20), ('phone_150', 'phone', 150), ('phone_450', 'phone', 450),
    ('video_20', 'video', 20), ('video_150', 'video', 150), ('video_450', 'video', 450),
    ('super_likes_3', 'super_like', 3), ('super_likes_15', 'super_like', 15), ('super_likes_30', 'super_like', 30),
    ('boost_1', 'boost', 1), ('boost_10', 'boost', 10), ('boost_20', 'boost', 20),
    ('primetime_1', 'primetime_boost', 1), ('primetime_3', 'primetime_boost', 3), ('primetime_5', 'primetime_boost', 5),
    ('superboost_3h', 'super_boost', 3), ('superboost_6h', 'super_boost', 6), ('superboost_12h', 'super_boost', 12)
  ) AS c(product, k, q)
  WHERE c.product = p_product;

  IF v_kind IN ('credits', 'phone', 'video') THEN
    INSERT INTO credit_transactions (profile_id, amount, type, category, description, stripe_session_id)
    VALUES (p_profile_id, v_qty, 'purchase',
            CASE v_kind WHEN 'credits' THEN 'general' ELSE v_kind END,
            CASE v_kind WHEN 'credits' THEN format('Purchased %s credits (%s)', v_qty, p_product)
                        ELSE format('Purchased %s %s minutes (%s)', v_qty, v_kind, p_product) END,
            p_session_id)
    ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_ledger;
    IF v_ledger IS NULL THEN
      RETURN jsonb_build_object('success', true, 'already_fulfilled', true, 'product', p_product);
    END IF;
    INSERT INTO user_credits (profile_id, credits, lifetime_credits, phone_minutes, video_minutes, last_purchase_at)
    VALUES (p_profile_id,
            CASE WHEN v_kind = 'credits' THEN v_qty ELSE 0 END,
            CASE WHEN v_kind = 'credits' THEN v_qty ELSE 0 END,
            CASE WHEN v_kind = 'phone' THEN v_qty ELSE 0 END,
            CASE WHEN v_kind = 'video' THEN v_qty ELSE 0 END,
            now())
    ON CONFLICT (profile_id) DO UPDATE SET
      credits = user_credits.credits + EXCLUDED.credits,
      lifetime_credits = user_credits.lifetime_credits + EXCLUDED.lifetime_credits,
      phone_minutes = user_credits.phone_minutes + EXCLUDED.phone_minutes,
      video_minutes = user_credits.video_minutes + EXCLUDED.video_minutes,
      last_purchase_at = now(),
      updated_at = now();
    RETURN jsonb_build_object('success', true, 'product', p_product, 'kind', v_kind, 'quantity', v_qty);
  END IF;

  IF v_kind IN ('super_like', 'boost', 'primetime_boost', 'super_boost') THEN
    INSERT INTO boost_transactions (profile_id, boost_type, action, quantity, stripe_session_id)
    VALUES (p_profile_id, v_kind, 'purchase', v_qty, p_session_id)
    ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_ledger;
    IF v_ledger IS NULL THEN
      RETURN jsonb_build_object('success', true, 'already_fulfilled', true, 'product', p_product);
    END IF;
    IF v_kind = 'super_like' THEN
      UPDATE profiles SET super_likes_remaining = coalesce(super_likes_remaining, 0) + v_qty
       WHERE id = p_profile_id;
    ELSE
      INSERT INTO boost_wallets (profile_id, boosts, primetime_boosts, super_boost_hours)
      VALUES (p_profile_id,
              CASE WHEN v_kind = 'boost' THEN v_qty ELSE 0 END,
              CASE WHEN v_kind = 'primetime_boost' THEN v_qty ELSE 0 END,
              CASE WHEN v_kind = 'super_boost' THEN v_qty ELSE 0 END)
      ON CONFLICT (profile_id) DO UPDATE SET
        boosts = boost_wallets.boosts + EXCLUDED.boosts,
        primetime_boosts = boost_wallets.primetime_boosts + EXCLUDED.primetime_boosts,
        super_boost_hours = boost_wallets.super_boost_hours + EXCLUDED.super_boost_hours,
        updated_at = now();
    END IF;
    RETURN jsonb_build_object('success', true, 'product', p_product, 'kind', v_kind, 'quantity', v_qty);
  END IF;

  -- Gifts (Cuba features are on hold: bug fixes only). A Stars package now
  -- really credits the receiver's Stars balance.
  IF p_product LIKE 'gift\_%' THEN
    BEGIN
      SELECT * INTO v_gift FROM gift_packages WHERE id = substr(p_product, 6)::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_gift := NULL;
    END;
    BEGIN
      v_recipient := nullif(p_meta->>'recipient_profile_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_recipient := NULL;
    END;
    IF v_gift.id IS NULL OR v_recipient IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_recipient) THEN
      RETURN jsonb_build_object('success', false, 'error', 'gift_metadata_invalid', 'product', p_product);
    END IF;
    INSERT INTO gift_transactions (sender_profile_id, receiver_profile_id, gift_package_id, amount_usd,
                                   message, status, stripe_session_id, completed_at)
    VALUES (p_profile_id, v_recipient, v_gift.id, v_amount, left(p_meta->>'message', 200),
            'completed', p_session_id, now())
    ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_ledger;
    IF v_ledger IS NULL THEN
      UPDATE gift_transactions SET status = 'completed', completed_at = coalesce(completed_at, now())
       WHERE stripe_session_id = p_session_id AND status <> 'completed';
      RETURN jsonb_build_object('success', true, 'already_fulfilled', true, 'product', p_product);
    END IF;
    IF v_gift.category = 'stars' THEN
      v_stars := nullif(substring(v_gift.name FROM '^([0-9]+)'), '')::integer;
      IF coalesce(v_stars, 0) > 0 THEN
        INSERT INTO star_transactions (sender_profile_id, receiver_profile_id, stars_amount, usd_value,
                                       transaction_type, status, stripe_session_id, message)
        VALUES (p_profile_id, v_recipient, v_stars, round(v_stars * 0.01, 2), 'gift', 'completed',
                p_session_id, left(p_meta->>'message', 200));
        INSERT INTO user_stars (profile_id, stars_balance, lifetime_stars_received)
        VALUES (v_recipient, v_stars, v_stars)
        ON CONFLICT (profile_id) DO UPDATE SET
          stars_balance = user_stars.stars_balance + v_stars,
          lifetime_stars_received = user_stars.lifetime_stars_received + v_stars,
          updated_at = now();
        INSERT INTO user_stars (profile_id, lifetime_stars_sent)
        VALUES (p_profile_id, v_stars)
        ON CONFLICT (profile_id) DO UPDATE SET
          lifetime_stars_sent = user_stars.lifetime_stars_sent + v_stars,
          updated_at = now();
      END IF;
    END IF;
    RETURN jsonb_build_object('success', true, 'product', p_product, 'kind', 'gift', 'stars', v_stars);
  END IF;

  -- Donations, mobile top-ups, food packages (Cuba, on hold: recorded as before).
  IF p_product ~ '^(donation|topup|food)_[0-9]+$' THEN
    INSERT INTO donations (donor_profile_id, recipient_profile_id, amount_usd, donation_type, phone_number,
                           recipient_name, status, stripe_session_id, completed_at)
    VALUES (p_profile_id,
            CASE WHEN coalesce(p_meta->>'recipient_profile_id', '') ~ '^[0-9a-f-]{36}$'
                 THEN (p_meta->>'recipient_profile_id')::uuid END,
            v_amount,
            CASE split_part(p_product, '_', 1) WHEN 'topup' THEN 'topup' WHEN 'food' THEN 'food' ELSE 'cash' END,
            left(p_meta->>'phone_number', 40), left(p_meta->>'recipient_name', 120),
            'completed', p_session_id, now())
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING id INTO v_ledger;
    IF v_ledger IS NULL THEN
      UPDATE donations SET status = 'completed', completed_at = coalesce(completed_at, now())
       WHERE stripe_session_id = p_session_id AND status <> 'completed';
      RETURN jsonb_build_object('success', true, 'already_fulfilled', true, 'product', p_product);
    END IF;
    RETURN jsonb_build_object('success', true, 'product', p_product, 'kind', 'donation');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'unknown_product', 'product', p_product);
END;
$$;
REVOKE ALL ON FUNCTION isexy.fulfill_stripe_payment(text, uuid, text, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.fulfill_stripe_payment(text, uuid, text, integer, text, jsonb) TO service_role;

-- A plan subscription's state from Stripe (checkout completed, updated,
-- deleted, or a member's "Restore purchases"). The row of that Stripe
-- subscription is updated; an active subscription with no row yet becomes
-- the member's row. Then the member's plan is recomputed.
CREATE OR REPLACE FUNCTION isexy.apply_stripe_subscription(
  p_profile_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_tier text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_profile uuid;
  v_active boolean := coalesce(p_status, '') IN ('active', 'trialing');
  v_tier text := CASE WHEN tier_rank(p_tier) > 0 THEN p_tier END;
BEGIN
  IF coalesce(p_subscription_id, '') = '' THEN
    RAISE EXCEPTION 'subscription id required' USING ERRCODE = '22023';
  END IF;

  UPDATE subscriptions SET
      status = coalesce(p_status, status),
      tier = coalesce(v_tier, tier),
      stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
      current_period_start = coalesce(p_period_start, current_period_start),
      current_period_end = coalesce(p_period_end, current_period_end),
      updated_at = now()
   WHERE stripe_subscription_id = p_subscription_id
  RETURNING profile_id INTO v_profile;

  IF v_profile IS NULL THEN
    IF p_profile_id IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unknown_subscription');
    END IF;
    IF NOT v_active OR v_tier IS NULL THEN
      RETURN jsonb_build_object('success', true, 'ignored', true);
    END IF;
    v_profile := p_profile_id;
    INSERT INTO subscriptions (profile_id, stripe_customer_id, stripe_subscription_id, tier, status,
                               current_period_start, current_period_end)
    VALUES (v_profile, p_customer_id, p_subscription_id, v_tier, p_status, p_period_start, p_period_end)
    ON CONFLICT (profile_id) DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      tier = EXCLUDED.tier,
      status = EXCLUDED.status,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = now();
  END IF;

  IF v_active THEN
    UPDATE profiles SET first_purchase_promo_used = true
     WHERE id = v_profile AND first_purchase_promo_used IS DISTINCT FROM true;
  END IF;

  RETURN jsonb_build_object('success', true, 'profile_id', v_profile) || refresh_member_plan(v_profile);
END;
$$;
REVOKE ALL ON FUNCTION isexy.apply_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.apply_stripe_subscription(uuid, text, text, text, text, timestamptz, timestamptz) TO service_role;

-- Chat subscription (chat_1mo): created at checkout, extended or ended by the
-- Stripe subscription's later events.
CREATE OR REPLACE FUNCTION isexy.apply_chat_subscription(
  p_profile_id uuid,
  p_subscription_id text,
  p_session_id text,
  p_status text,
  p_expires_at timestamptz,
  p_plan_months integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_status text := CASE WHEN coalesce(p_status, '') IN ('active', 'trialing') THEN 'active'
                        WHEN coalesce(p_status, '') IN ('past_due', 'unpaid') THEN 'past_due'
                        ELSE 'canceled' END;
  v_id uuid;
BEGIN
  IF coalesce(p_subscription_id, '') = '' AND coalesce(p_session_id, '') = '' THEN
    RAISE EXCEPTION 'subscription or session id required' USING ERRCODE = '22023';
  END IF;

  UPDATE chat_subscriptions SET
      status = v_status,
      expires_at = coalesce(p_expires_at, expires_at),
      stripe_subscription_id = coalesce(stripe_subscription_id, nullif(p_subscription_id, '')),
      updated_at = now()
   WHERE (p_subscription_id <> '' AND stripe_subscription_id = p_subscription_id)
      OR (coalesce(p_session_id, '') <> '' AND stripe_session_id = p_session_id)
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    IF p_profile_id IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'unknown_subscription');
    END IF;
    IF v_status <> 'active' THEN
      RETURN jsonb_build_object('success', true, 'ignored', true);
    END IF;
    INSERT INTO chat_subscriptions (profile_id, plan_months, status, expires_at, stripe_session_id, stripe_subscription_id)
    VALUES (p_profile_id, greatest(coalesce(p_plan_months, 1), 1), 'active',
            coalesce(p_expires_at, now() + make_interval(days => 30 * greatest(coalesce(p_plan_months, 1), 1))),
            nullif(p_session_id, ''), nullif(p_subscription_id, ''))
    RETURNING id INTO v_id;
    IF coalesce(p_session_id, '') <> '' THEN
      INSERT INTO credit_transactions (profile_id, amount, type, category, description, stripe_session_id)
      VALUES (p_profile_id, 0, 'purchase', 'chat_sub', 'Chat subscription', p_session_id)
      ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION isexy.apply_chat_subscription(uuid, text, text, text, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.apply_chat_subscription(uuid, text, text, text, timestamptz, integer) TO service_role;

-- ===========================================================================
-- R5. Wallet: every balance of the caller in one read
-- ===========================================================================
CREATE OR REPLACE FUNCTION isexy.get_my_wallet()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_c user_credits%ROWTYPE;
  v_w boost_wallets%ROWTYPE;
  v_a allowances%ROWTYPE;
  v_paid boolean;
  v_source text;
  v_boost_until timestamptz;
  v_chat_until timestamptz;
  v_stars integer;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE user_id = auth.uid();
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_c FROM user_credits WHERE profile_id = v_p.id;
  SELECT * INTO v_w FROM boost_wallets WHERE profile_id = v_p.id;
  SELECT * INTO v_a FROM allowances WHERE profile_id = v_p.id;
  v_paid := coalesce(v_p.is_premium, false) AND tier_rank(v_p.subscription_tier) > 0;

  IF v_paid THEN
    SELECT src INTO v_source FROM (
      SELECT 'stripe' AS src, tier_rank(s.tier) AS r, s.current_period_end AS e
        FROM subscriptions s
       WHERE s.profile_id = v_p.id AND s.status IN ('active', 'trialing') AND s.tier = v_p.subscription_tier
      UNION ALL
      SELECT g.source, tier_rank(g.tier), g.expires_at
        FROM plan_grants g
       WHERE g.profile_id = v_p.id AND g.tier = v_p.subscription_tier
         AND g.starts_at <= now() AND (g.expires_at IS NULL OR g.expires_at > now())
    ) x ORDER BY (x.src = 'stripe') DESC LIMIT 1;
  END IF;

  v_boost_until := greatest(
    CASE WHEN v_p.last_boost_at > now() - interval '30 minutes' THEN v_p.last_boost_at + interval '30 minutes' END,
    CASE WHEN v_p.super_boost_until > now() THEN v_p.super_boost_until END);

  SELECT max(expires_at) INTO v_chat_until FROM chat_subscriptions
   WHERE profile_id = v_p.id AND status = 'active' AND expires_at > now();
  SELECT stars_balance INTO v_stars FROM user_stars WHERE profile_id = v_p.id;

  RETURN jsonb_build_object(
    'profile_id', v_p.id,
    'tier', CASE WHEN v_paid THEN v_p.subscription_tier ELSE 'free' END,
    'is_premium', v_paid,
    'plan_expires_at', CASE WHEN v_paid THEN v_p.subscription_expires_at END,
    'plan_source', v_source,
    'credits', coalesce(v_c.credits, 0),
    'phone_minutes', coalesce(v_c.phone_minutes, 0),
    'video_minutes', coalesce(v_c.video_minutes, 0),
    'boosts', coalesce(v_w.boosts, 0),
    'primetime_boosts', coalesce(v_w.primetime_boosts, 0),
    'super_boost_hours', coalesce(v_w.super_boost_hours, 0),
    'monthly_boost_available', coalesce(v_w.monthly_boost_available, false)
                               AND v_paid AND tier_rank(v_p.subscription_tier) >= 2,
    'monthly_boost_reset_at', v_w.monthly_boost_reset_at,
    'boost_active_until', v_boost_until,
    'super_likes', coalesce(v_p.super_likes_remaining, 0),
    'weekly_super_likes', coalesce(v_a.weekly_super_likes, 0),
    'weekly_super_likes_max', coalesce(v_a.weekly_super_likes_max, 0),
    'super_likes_unlimited', v_paid AND v_p.subscription_tier = 'platinum',
    'weekly_first_impressions', coalesce(v_a.weekly_first_impressions, 0),
    'weekly_first_impressions_max', coalesce(v_a.weekly_first_impressions_max, 0),
    'weekly_reset_at', v_a.weekly_reset_at,
    'likes_remaining', coalesce(v_p.likes_remaining, 0),
    'likes_unlimited', v_paid,
    'chat_subscription_until', v_chat_until,
    'stars', coalesce(v_stars, 0)
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.get_my_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_wallet() TO authenticated;

-- ===========================================================================
-- R6. Boosts (called through the use_boost ownership wrapper)
-- ===========================================================================
-- boost / primetime / monthly: 30 minutes at the top of Discover (the
-- ranking reads profiles.last_boost_at). super: all banked Super Boost hours
-- at once (profiles.super_boost_until, extended if one is running). A Boost
-- is not spent while another one is still running.
CREATE OR REPLACE FUNCTION isexy.use_boost_unchecked(p_profile_id uuid, p_boost_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_w boost_wallets%ROWTYPE;
  v_until timestamptz;
  v_hours integer;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  SELECT * INTO v_w FROM boost_wallets WHERE profile_id = p_profile_id FOR UPDATE;

  IF p_boost_type IN ('boost', 'primetime', 'monthly') THEN
    v_until := greatest(
      CASE WHEN v_p.last_boost_at > now() - interval '30 minutes' THEN v_p.last_boost_at + interval '30 minutes' END,
      CASE WHEN v_p.super_boost_until > now() THEN v_p.super_boost_until END);
    IF v_until IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'boost_active', 'active_until', v_until);
    END IF;
  END IF;

  IF p_boost_type = 'boost' THEN
    IF coalesce(v_w.boosts, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_boosts', 'remaining', 0);
    END IF;
    UPDATE boost_wallets SET boosts = boosts - 1, updated_at = now() WHERE profile_id = p_profile_id;
  ELSIF p_boost_type = 'primetime' THEN
    IF coalesce(v_w.primetime_boosts, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_primetime_boosts', 'remaining', 0);
    END IF;
    UPDATE boost_wallets SET primetime_boosts = primetime_boosts - 1, updated_at = now() WHERE profile_id = p_profile_id;
  ELSIF p_boost_type = 'monthly' THEN
    IF NOT coalesce(v_w.monthly_boost_available, false)
       OR NOT (coalesce(v_p.is_premium, false) AND tier_rank(v_p.subscription_tier) >= 2) THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_monthly_boost');
    END IF;
    UPDATE boost_wallets SET monthly_boost_available = false, updated_at = now() WHERE profile_id = p_profile_id;
  ELSIF p_boost_type = 'super' THEN
    v_hours := coalesce(v_w.super_boost_hours, 0);
    IF v_hours <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_super_boost', 'remaining', 0);
    END IF;
    v_until := greatest(now(), coalesce(v_p.super_boost_until, now())) + make_interval(hours => v_hours);
    UPDATE boost_wallets SET super_boost_hours = 0, updated_at = now() WHERE profile_id = p_profile_id;
    UPDATE profiles SET super_boost_until = v_until WHERE id = p_profile_id;
    INSERT INTO boost_transactions (profile_id, boost_type, action, quantity)
    VALUES (p_profile_id, 'super_boost', 'use', v_hours);
    RETURN jsonb_build_object('success', true, 'boost_type', 'super', 'hours', v_hours, 'active_until', v_until);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_boost_type');
  END IF;

  UPDATE profiles SET last_boost_at = now() WHERE id = p_profile_id;
  INSERT INTO boost_transactions (profile_id, boost_type, action, quantity)
  VALUES (p_profile_id, CASE p_boost_type WHEN 'primetime' THEN 'primetime_boost' ELSE p_boost_type END, 'use', 1);

  RETURN jsonb_build_object('success', true, 'boost_type', p_boost_type,
                            'duration', 1800, 'active_until', now() + interval '30 minutes');
END;
$$;
REVOKE ALL ON FUNCTION isexy.use_boost_unchecked(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.use_boost_unchecked(uuid, text) TO service_role;

-- ===========================================================================
-- R7. Redeem a code (called through the redeem_coupon ownership wrapper)
-- ===========================================================================
-- Checked server-side as before (active, dates, max uses, once per member),
-- now with the code row locked (no over-redeeming), checkout discount codes
-- refused instead of "redeemed" with no effect, and a plan the member
-- already has (same or higher tier, lasting at least as long) refused rather
-- than wasted. The plan comes as a plan_grant: a paid plan is never
-- overwritten or shortened.
CREATE OR REPLACE FUNCTION isexy.redeem_coupon_unchecked(p_code text, p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_coupon coupon_codes%ROWTYPE;
  v_p profiles%ROWTYPE;
  v_tier text;
  v_expires timestamptz;
  v_redemption uuid;
  v_plan jsonb;
BEGIN
  SELECT * INTO v_coupon FROM coupon_codes
   WHERE code = upper(btrim(coalesce(p_code, '')))
     AND is_active = true
     AND (starts_at IS NULL OR starts_at <= now())
     AND (expires_at IS NULL OR expires_at > now())
   FOR UPDATE;
  IF v_coupon.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired code');
  END IF;
  IF v_coupon.code_type = 'discount' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This is a checkout discount code, it cannot be redeemed here');
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND coalesce(v_coupon.current_uses, 0) >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This code has reached its maximum uses');
  END IF;
  IF EXISTS (SELECT 1 FROM coupon_redemptions WHERE coupon_id = v_coupon.id AND profile_id = p_profile_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this code');
  END IF;

  v_tier := coalesce(v_coupon.subscription_tier, 'platinum');
  IF tier_rank(v_tier) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired code');
  END IF;
  v_expires := CASE WHEN v_coupon.duration_days IS NOT NULL
                    THEN now() + make_interval(days => v_coupon.duration_days) END;

  SELECT * INTO v_p FROM profiles WHERE id = p_profile_id FOR UPDATE;
  IF coalesce(v_p.is_premium, false) AND tier_rank(v_p.subscription_tier) >= tier_rank(v_tier)
     AND (v_p.subscription_expires_at IS NULL OR (v_expires IS NOT NULL AND v_p.subscription_expires_at >= v_expires)) THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Your %s plan already includes everything this code gives', initcap(v_p.subscription_tier)));
  END IF;

  INSERT INTO coupon_redemptions (coupon_id, profile_id, applied_benefit, expires_at)
  VALUES (v_coupon.id, p_profile_id, v_coupon.code_type || ':' || v_tier, v_expires)
  RETURNING id INTO v_redemption;
  INSERT INTO plan_grants (profile_id, tier, source, source_ref, expires_at)
  VALUES (p_profile_id, v_tier, 'coupon', v_redemption::text, v_expires);
  UPDATE coupon_codes SET current_uses = coalesce(current_uses, 0) + 1, updated_at = now() WHERE id = v_coupon.id;

  v_plan := refresh_member_plan(p_profile_id);
  RETURN jsonb_build_object(
    'success', true,
    'code_type', v_coupon.code_type,
    'subscription_tier', v_tier,
    'expires_at', v_expires,
    'description', v_coupon.description,
    'plan', v_plan
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.redeem_coupon_unchecked(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.redeem_coupon_unchecked(text, uuid) TO service_role;

-- ===========================================================================
-- R8. Scheduler (isexy-reset-allowances, isexy-subscription-resets)
-- ===========================================================================
-- Monthly Boost every 30 days for Gold/Platinum (before: on every run, and
-- never for plans without an end date).
CREATE OR REPLACE FUNCTION isexy.reset_monthly_allowances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE allowances SET
    monthly_boosts = monthly_boosts_max,
    monthly_reset_at = now() + interval '30 days',
    updated_at = now()
  WHERE monthly_reset_at <= now();

  INSERT INTO boost_wallets (profile_id)
  SELECT p.id FROM profiles p
   WHERE p.is_premium AND p.subscription_tier IN ('gold', 'platinum')
     AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
  ON CONFLICT (profile_id) DO NOTHING;

  UPDATE boost_wallets w SET
    monthly_boost_available = true,
    monthly_boost_reset_at = now() + interval '30 days',
    updated_at = now()
  FROM profiles p
  WHERE p.id = w.profile_id
    AND p.is_premium AND p.subscription_tier IN ('gold', 'platinum')
    AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
    AND (w.monthly_boost_reset_at IS NULL OR w.monthly_boost_reset_at <= now());
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION isexy.reset_monthly_allowances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.reset_monthly_allowances() TO service_role;
REVOKE ALL ON FUNCTION isexy.reset_weekly_allowances() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.reset_weekly_allowances() TO service_role;

-- Plans whose end date passed: recompute (another source may still be
-- active) so the plan, entitlements and allowances follow.
CREATE OR REPLACE FUNCTION isexy.expire_member_plans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM profiles
     WHERE is_premium = true AND subscription_expires_at IS NOT NULL AND subscription_expires_at < now()
  LOOP
    PERFORM refresh_member_plan(r.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION isexy.expire_member_plans() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.expire_member_plans() TO service_role;

-- 100 Likes a day for members without a paid plan (run once a day).
CREATE OR REPLACE FUNCTION isexy.reset_daily_likes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE profiles SET likes_remaining = 100
   WHERE is_active = true
     AND NOT (coalesce(is_premium, false) AND tier_rank(subscription_tier) > 0)
     AND coalesce(likes_remaining, 0) < 100;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION isexy.reset_daily_likes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.reset_daily_likes() TO service_role;

-- ===========================================================================
-- R9. Loyalty points and streaks
-- ===========================================================================
-- Points are earned for real actions, checked on the server when the member
-- opens the app or the Rewards page (no trigger on busy tables):
--   daily visit +5 (once per day, Toronto time), profile with 3+ photos,
--   a bio and 3+ interests +50 (once), verified profile +100 (once),
--   first message sent +10 (once), each new mutual match +25 (4 a day at
--   most), each friend who joined with your code +200 (5 a month at most).
-- Streak: consecutive days with a visit; badges at 3/7/14/30/100 days with
-- the rewards the Consistency Challenge shows.
CREATE TABLE IF NOT EXISTS isexy.loyalty_accounts (
  profile_id UUID PRIMARY KEY REFERENCES isexy.profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_visit_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS isexy.loyalty_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES isexy.profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, reason, ref)
);
CREATE INDEX IF NOT EXISTS loyalty_events_profile_idx ON isexy.loyalty_events (profile_id, created_at DESC);
ALTER TABLE isexy.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE isexy.loyalty_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view own loyalty account" ON isexy.loyalty_accounts;
CREATE POLICY "Members view own loyalty account" ON isexy.loyalty_accounts
  FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Members view own loyalty events" ON isexy.loyalty_events;
CREATE POLICY "Members view own loyalty events" ON isexy.loyalty_events
  FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));
REVOKE ALL ON isexy.loyalty_accounts, isexy.loyalty_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON isexy.loyalty_accounts, isexy.loyalty_events FROM authenticated;
GRANT SELECT ON isexy.loyalty_accounts, isexy.loyalty_events TO authenticated;

-- Add points once per (reason, ref). Returns the points added (0 if already counted).
CREATE OR REPLACE FUNCTION isexy.loyalty_earn(p_profile_id uuid, p_reason text, p_ref text, p_points integer, p_detail text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF coalesce(p_points, 0) <= 0 THEN RETURN 0; END IF;
  INSERT INTO loyalty_events (profile_id, points, reason, ref, detail)
  VALUES (p_profile_id, p_points, p_reason, coalesce(p_ref, ''), p_detail)
  ON CONFLICT (profile_id, reason, ref) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN 0; END IF;
  INSERT INTO loyalty_accounts (profile_id, points, lifetime_points)
  VALUES (p_profile_id, p_points, p_points)
  ON CONFLICT (profile_id) DO UPDATE SET
    points = loyalty_accounts.points + p_points,
    lifetime_points = loyalty_accounts.lifetime_points + p_points,
    updated_at = now();
  RETURN p_points;
END;
$$;
REVOKE ALL ON FUNCTION isexy.loyalty_earn(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.loyalty_earn(uuid, text, text, integer, text) TO service_role;

-- Check the one-time achievements, matches and referrals; returns points added.
CREATE OR REPLACE FUNCTION isexy.loyalty_sync(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_added integer := 0;
  r record;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE id = p_profile_id;
  IF v_p.id IS NULL THEN RETURN 0; END IF;

  IF char_length(btrim(coalesce(v_p.bio, ''))) >= 10
     AND coalesce(array_length(v_p.interests, 1), 0) >= 3
     AND (SELECT count(*) FROM profile_photos WHERE profile_id = v_p.id) >= 3 THEN
    v_added := v_added + loyalty_earn(v_p.id, 'profile_complete', '', 50, 'Complete profile');
  END IF;
  IF coalesce(v_p.is_verified, false) THEN
    v_added := v_added + loyalty_earn(v_p.id, 'verified', '', 100, 'Verified profile');
  END IF;
  IF EXISTS (SELECT 1 FROM messages WHERE sender_id = v_p.id) THEN
    v_added := v_added + loyalty_earn(v_p.id, 'first_message', '', 10, 'First message sent');
  END IF;

  -- Mutual matches of the last 30 days, at most 4 per day count.
  FOR r IN
    SELECT id FROM (
      SELECT m.id, row_number() OVER (PARTITION BY (m.matched_at AT TIME ZONE 'America/Toronto')::date
                                      ORDER BY m.matched_at, m.id) AS n
        FROM matches m
       WHERE (m.profile1_id = v_p.id OR m.profile2_id = v_p.id)
         AND m.matched_at > now() - interval '30 days'
         AND EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = m.profile1_id AND s.swiped_id = m.profile2_id AND s.action <> 'pass')
         AND EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = m.profile2_id AND s.swiped_id = m.profile1_id AND s.action <> 'pass')
    ) x WHERE x.n <= 4
  LOOP
    v_added := v_added + loyalty_earn(v_p.id, 'match', r.id::text, 25, 'New match');
  END LOOP;

  -- Friends who joined with this member's code, at most 5 per calendar month.
  FOR r IN
    SELECT referred_id FROM (
      SELECT f.referred_id, row_number() OVER (PARTITION BY date_trunc('month', f.completed_at)
                                               ORDER BY f.completed_at, f.id) AS n
        FROM referrals f
       WHERE f.referrer_id = v_p.id AND f.status = 'completed' AND f.referred_id IS NOT NULL
    ) x WHERE x.n <= 5
  LOOP
    v_added := v_added + loyalty_earn(v_p.id, 'referral', r.referred_id::text, 200, 'Friend joined');
  END LOOP;

  RETURN v_added;
END;
$$;
REVOKE ALL ON FUNCTION isexy.loyalty_sync(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.loyalty_sync(uuid) TO service_role;

-- Streak badges and their rewards (Consistency Challenge):
--   3 days: 25 points · 7: 1 Super Like · 14: 1 Boost · 30: 3 Super Likes · 100: 5 Boosts.
CREATE OR REPLACE FUNCTION isexy.loyalty_award_badges(p_profile_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_streak integer;
  v_new text[] := '{}';
  v_badge text;
  t record;
BEGIN
  SELECT current_streak INTO v_streak FROM loyalty_accounts WHERE profile_id = p_profile_id;
  FOR t IN SELECT * FROM (VALUES (3, '3_day'), (7, '7_day'), (14, '14_day'), (30, '30_day'), (100, '100_day')) AS b(days, badge)
  LOOP
    EXIT WHEN coalesce(v_streak, 0) < t.days;
    INSERT INTO streak_badges (profile_id, badge_type, streak_count)
    VALUES (p_profile_id, t.badge, t.days)
    ON CONFLICT (profile_id, badge_type) DO NOTHING
    RETURNING badge_type INTO v_badge;
    IF v_badge IS NOT NULL THEN
      v_new := v_new || v_badge;
      IF t.badge = '3_day' THEN
        PERFORM loyalty_earn(p_profile_id, 'streak_badge', t.badge, 25, '3-day streak');
      ELSIF t.badge IN ('7_day', '30_day') THEN
        UPDATE profiles SET super_likes_remaining = coalesce(super_likes_remaining, 0) + CASE t.badge WHEN '7_day' THEN 1 ELSE 3 END
         WHERE id = p_profile_id;
      ELSE
        INSERT INTO boost_wallets (profile_id, boosts) VALUES (p_profile_id, CASE t.badge WHEN '14_day' THEN 1 ELSE 5 END)
        ON CONFLICT (profile_id) DO UPDATE SET boosts = boost_wallets.boosts + EXCLUDED.boosts, updated_at = now();
      END IF;
      v_badge := NULL;
    END IF;
  END LOOP;
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION isexy.loyalty_award_badges(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.loyalty_award_badges(uuid) TO service_role;

-- Called once when the app opens: counts today's visit for the streak and
-- the daily points, checks achievements, awards streak badges.
CREATE OR REPLACE FUNCTION isexy.record_daily_visit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_acc loyalty_accounts%ROWTYPE;
  v_streak integer;
  v_first_today boolean := false;
  v_before integer;
  v_badges text[];
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO loyalty_accounts (profile_id) VALUES (v_me) ON CONFLICT (profile_id) DO NOTHING;
  SELECT * INTO v_acc FROM loyalty_accounts WHERE profile_id = v_me FOR UPDATE;
  v_before := v_acc.points;
  IF v_acc.last_visit_on IS DISTINCT FROM v_today THEN
    v_first_today := true;
    v_streak := CASE WHEN v_acc.last_visit_on = v_today - 1 THEN v_acc.current_streak + 1 ELSE 1 END;
    UPDATE loyalty_accounts SET
      current_streak = v_streak,
      longest_streak = greatest(longest_streak, v_streak),
      last_visit_on = v_today,
      updated_at = now()
    WHERE profile_id = v_me;
    UPDATE profiles SET last_active_at = now() WHERE id = v_me;
    PERFORM loyalty_earn(v_me, 'daily_visit', v_today::text, 5, 'Daily visit');
  END IF;

  PERFORM loyalty_sync(v_me);
  v_badges := loyalty_award_badges(v_me);
  SELECT * INTO v_acc FROM loyalty_accounts WHERE profile_id = v_me;

  RETURN jsonb_build_object(
    'streak', v_acc.current_streak,
    'longest_streak', v_acc.longest_streak,
    'first_visit_today', v_first_today,
    'points', v_acc.points,
    'points_earned', v_acc.points - v_before,
    'new_badges', to_jsonb(v_badges),
    'badges', (SELECT coalesce(jsonb_agg(badge_type ORDER BY streak_count), '[]'::jsonb)
                 FROM streak_badges WHERE profile_id = v_me)
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.record_daily_visit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.record_daily_visit() TO authenticated;

-- The Rewards page: balance, streak, recent activity (after a sync).
CREATE OR REPLACE FUNCTION isexy.get_my_loyalty()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_acc loyalty_accounts%ROWTYPE;
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  INSERT INTO loyalty_accounts (profile_id) VALUES (v_me) ON CONFLICT (profile_id) DO NOTHING;
  PERFORM loyalty_sync(v_me);
  SELECT * INTO v_acc FROM loyalty_accounts WHERE profile_id = v_me;
  RETURN jsonb_build_object(
    'points', v_acc.points,
    'lifetime_points', v_acc.lifetime_points,
    'streak', v_acc.current_streak,
    'longest_streak', v_acc.longest_streak,
    'history', (SELECT coalesce(jsonb_agg(jsonb_build_object('reason', e.reason, 'points', e.points,
                                                             'detail', e.detail, 'created_at', e.created_at)
                                          ORDER BY e.created_at DESC), '[]'::jsonb)
                  FROM (SELECT * FROM loyalty_events WHERE profile_id = v_me ORDER BY created_at DESC LIMIT 20) e),
    'earned', (SELECT coalesce(jsonb_agg(DISTINCT reason), '[]'::jsonb) FROM loyalty_events
                WHERE profile_id = v_me AND reason IN ('profile_complete', 'verified', 'first_message'))
  );
END;
$$;
REVOKE ALL ON FUNCTION isexy.get_my_loyalty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_loyalty() TO authenticated;

-- Spend points. The catalog lives here; plan rewards are plan_grants that
-- follow on from a reward plan of the same tier still running.
CREATE OR REPLACE FUNCTION isexy.redeem_loyalty_reward(p_reward text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_cost integer;
  v_kind text;
  v_qty integer;
  v_tier text;
  v_points integer;
  v_start timestamptz;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE user_id = auth.uid();
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT c.cost, c.kind, c.qty, c.tier INTO v_cost, v_kind, v_qty, v_tier FROM (VALUES
    ('super_like_1', 100, 'super_like', 1, NULL),
    ('boost_1', 250, 'boost', 1, NULL),
    ('super_like_5', 400, 'super_like', 5, NULL),
    ('boost_3', 600, 'boost', 3, NULL),
    ('gold_week', 1000, 'plan', 7, 'gold'),
    ('platinum_week', 2000, 'plan', 7, 'platinum'),
    ('gold_month', 3000, 'plan', 30, 'gold'),
    ('platinum_month', 5000, 'plan', 30, 'platinum')
  ) AS c(id, cost, kind, qty, tier)
  WHERE c.id = p_reward;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unknown_reward');
  END IF;

  INSERT INTO loyalty_accounts (profile_id) VALUES (v_p.id) ON CONFLICT (profile_id) DO NOTHING;
  SELECT points INTO v_points FROM loyalty_accounts WHERE profile_id = v_p.id FOR UPDATE;
  IF v_points < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_points', 'points', v_points, 'cost', v_cost);
  END IF;

  IF v_kind = 'plan' THEN
    SELECT max(expires_at) INTO v_start FROM plan_grants
     WHERE profile_id = v_p.id AND source = 'loyalty' AND tier = v_tier AND expires_at > now();
    v_start := greatest(now(), coalesce(v_start, now()));
    v_expires := v_start + make_interval(days => v_qty);
    IF coalesce(v_p.is_premium, false) AND tier_rank(v_p.subscription_tier) >= tier_rank(v_tier)
       AND (v_p.subscription_expires_at IS NULL OR v_p.subscription_expires_at >= v_expires) THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_covered');
    END IF;
  END IF;

  UPDATE loyalty_accounts SET points = points - v_cost, updated_at = now() WHERE profile_id = v_p.id;
  INSERT INTO loyalty_events (profile_id, points, reason, ref, detail)
  VALUES (v_p.id, -v_cost, 'redeem', gen_random_uuid()::text, p_reward);

  IF v_kind = 'super_like' THEN
    UPDATE profiles SET super_likes_remaining = coalesce(super_likes_remaining, 0) + v_qty WHERE id = v_p.id;
  ELSIF v_kind = 'boost' THEN
    INSERT INTO boost_wallets (profile_id, boosts) VALUES (v_p.id, v_qty)
    ON CONFLICT (profile_id) DO UPDATE SET boosts = boost_wallets.boosts + v_qty, updated_at = now();
  ELSE
    INSERT INTO plan_grants (profile_id, tier, source, source_ref, starts_at, expires_at)
    VALUES (v_p.id, v_tier, 'loyalty', p_reward, v_start, v_expires);
    PERFORM refresh_member_plan(v_p.id);
  END IF;

  RETURN jsonb_build_object('success', true, 'reward', p_reward, 'points', v_points - v_cost,
                            'expires_at', v_expires);
END;
$$;
REVOKE ALL ON FUNCTION isexy.redeem_loyalty_reward(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.redeem_loyalty_reward(text) TO authenticated;

-- Same signature as before; the streak now comes from the server, never from
-- the browser's count (p_streak_count is ignored).
CREATE OR REPLACE FUNCTION isexy.award_streak_badge(p_badge_type text, p_streak_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No profile');
  END IF;
  IF p_badge_type NOT IN ('3_day', '7_day', '14_day', '30_day', '100_day') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid badge');
  END IF;
  PERFORM loyalty_award_badges(v_me);
  RETURN jsonb_build_object('success',
    EXISTS (SELECT 1 FROM streak_badges WHERE profile_id = v_me AND badge_type = p_badge_type));
END;
$$;
REVOKE ALL ON FUNCTION isexy.award_streak_badge(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.award_streak_badge(text, integer) TO authenticated;

-- ===========================================================================
-- R10. Credits are spendable: 1 credit = 1 minute of video or phone calls
-- ===========================================================================
CREATE OR REPLACE FUNCTION isexy.convert_credits_to_minutes(p_credits integer, p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_me uuid;
  v_c user_credits%ROWTYPE;
BEGIN
  SELECT id INTO v_me FROM profiles WHERE user_id = auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('video', 'phone') OR p_credits IS NULL OR p_credits < 1 OR p_credits > 10000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_request');
  END IF;
  SELECT * INTO v_c FROM user_credits WHERE profile_id = v_me FOR UPDATE;
  IF coalesce(v_c.credits, 0) < p_credits THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_credits', 'credits', coalesce(v_c.credits, 0));
  END IF;
  UPDATE user_credits SET
    credits = credits - p_credits,
    video_minutes = video_minutes + CASE WHEN p_type = 'video' THEN p_credits ELSE 0 END,
    phone_minutes = phone_minutes + CASE WHEN p_type = 'phone' THEN p_credits ELSE 0 END,
    updated_at = now()
  WHERE profile_id = v_me
  RETURNING * INTO v_c;
  INSERT INTO credit_transactions (profile_id, amount, type, category, description) VALUES
    (v_me, -p_credits, 'spend', 'general', format('%s credits converted to %s minutes', p_credits, p_type)),
    (v_me, p_credits, 'bonus', p_type, format('%s %s minutes from credits', p_credits, p_type));
  RETURN jsonb_build_object('success', true, 'credits', v_c.credits,
                            'video_minutes', v_c.video_minutes, 'phone_minutes', v_c.phone_minutes);
END;
$$;
REVOKE ALL ON FUNCTION isexy.convert_credits_to_minutes(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.convert_credits_to_minutes(integer, text) TO authenticated;

-- ===========================================================================
-- R11. Protected writes moved to RPCs
-- ===========================================================================
-- Stars cash-out (Cuba, on hold: bug fix only). The amount in dollars is
-- computed here (1 star = $0.01), the request must fit in the balance minus
-- requests still open. MyStars used to INSERT the row with its own amount.
CREATE OR REPLACE FUNCTION isexy.request_star_cashout(p_stars integer, p_method text, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  v_p profiles%ROWTYPE;
  v_balance integer;
  v_open integer;
  v_id uuid;
BEGIN
  SELECT * INTO v_p FROM profiles WHERE user_id = auth.uid();
  IF v_p.id IS NULL OR NOT coalesce(v_p.is_cuban, false) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_method NOT IN ('mobile_topup', 'bank_transfer', 'western_union') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_method');
  END IF;
  SELECT stars_balance INTO v_balance FROM user_stars WHERE profile_id = v_p.id FOR UPDATE;
  SELECT coalesce(sum(stars_amount), 0) INTO v_open FROM star_cashout_requests
   WHERE profile_id = v_p.id AND status IN ('pending', 'processing');
  IF p_stars IS NULL OR p_stars < 1000 OR p_stars > coalesce(v_balance, 0) - v_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount',
                              'available', greatest(coalesce(v_balance, 0) - v_open, 0));
  END IF;
  INSERT INTO star_cashout_requests (profile_id, stars_amount, usd_amount, cashout_method, cashout_details)
  VALUES (v_p.id, p_stars, round(p_stars * 0.01, 2), p_method,
          jsonb_build_object('method', p_method, 'requestedAt', now())
            || CASE WHEN jsonb_typeof(p_details) = 'object' AND octet_length(p_details::text) <= 4096
                    THEN p_details - 'usd_amount' - 'stars_amount' ELSE '{}'::jsonb END)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'id', v_id, 'usd_amount', round(p_stars * 0.01, 2));
END;
$$;
REVOKE ALL ON FUNCTION isexy.request_star_cashout(integer, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.request_star_cashout(integer, text, jsonb) TO authenticated;

-- Cuban signup (on hold, unchanged behaviour): a member may still declare
-- themselves Cuban at signup (CubanSignup), or switch back when finishing the
-- tourist signup (TouristSignup); this only sets the caller's own is_cuban.
-- is_verified stays staff-only.
DROP FUNCTION IF EXISTS isexy.set_my_cuban_flag();
CREATE OR REPLACE FUNCTION isexy.set_my_cuban_flag(p_is_cuban boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  UPDATE profiles SET is_cuban = coalesce(p_is_cuban, true)
   WHERE user_id = auth.uid() AND is_cuban IS DISTINCT FROM coalesce(p_is_cuban, true);
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION isexy.set_my_cuban_flag(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.set_my_cuban_flag(boolean) TO authenticated;

-- Staff (admin or moderator) mark a member verified, e.g. after approving a
-- Cuban ID check in AdminVerifications (photo checks use
-- review_photo_verification).
CREATE OR REPLACE FUNCTION isexy.staff_set_profile_verified(p_profile_id uuid, p_verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (isexy.has_role(auth.uid(), 'admin') OR isexy.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE profiles SET is_verified = coalesce(p_verified, false), updated_at = now() WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown profile' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION isexy.staff_set_profile_verified(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.staff_set_profile_verified(uuid, boolean) TO authenticated;

-- check_promo_eligibility(p_profile_id, p_tier) had the default EXECUTE grant
-- (anon too) and no caller check: anyone could create or reset "50% off"
-- promotion rows for any member. No client calls it (the first-week offer is
-- a Stripe coupon applied by isexy-create-checkout), so it is service_role only.
REVOKE ALL ON FUNCTION isexy.check_promo_eligibility(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION isexy.check_promo_eligibility(uuid, text) TO service_role;
