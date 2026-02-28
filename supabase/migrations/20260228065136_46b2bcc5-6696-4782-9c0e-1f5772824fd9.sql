
-- 1. Promotions table (intro offers, time-limited discounts)
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  promo_type text NOT NULL DEFAULT 'intro_offer', -- intro_offer, seasonal, winback
  tier text NOT NULL, -- plus, gold, platinum
  offer_price numeric NOT NULL,
  renewal_price numeric NOT NULL,
  discount_percent integer NOT NULL DEFAULT 50,
  offer_start_at timestamptz NOT NULL DEFAULT now(),
  offer_expires_at timestamptz NOT NULL,
  eligible boolean NOT NULL DEFAULT true,
  redeemed_at timestamptz,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, promo_type, tier)
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own promotions" ON public.promotions
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can manage promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Boost wallet (tracks purchased boost inventory)
CREATE TABLE public.boost_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  boosts integer NOT NULL DEFAULT 0,
  primetime_boosts integer NOT NULL DEFAULT 0,
  super_boost_hours integer NOT NULL DEFAULT 0,
  monthly_boost_available boolean NOT NULL DEFAULT false,
  monthly_boost_reset_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boost_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own boost wallet" ON public.boost_wallets
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own boost wallet" ON public.boost_wallets
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own boost wallet" ON public.boost_wallets
  FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- 3. Boost transactions log
CREATE TABLE public.boost_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  boost_type text NOT NULL, -- boost, primetime, super_boost
  action text NOT NULL, -- purchase, use, expire, monthly_grant
  quantity integer NOT NULL DEFAULT 1,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boost_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own boost transactions" ON public.boost_transactions
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own boost transactions" ON public.boost_transactions
  FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- 4. Allowances table (super likes, first impressions, monthly boost - tracks weekly/monthly resets)
CREATE TABLE public.allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  weekly_super_likes integer NOT NULL DEFAULT 0,
  weekly_super_likes_max integer NOT NULL DEFAULT 0,
  weekly_first_impressions integer NOT NULL DEFAULT 0,
  weekly_first_impressions_max integer NOT NULL DEFAULT 0,
  weekly_reset_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  monthly_boosts integer NOT NULL DEFAULT 0,
  monthly_boosts_max integer NOT NULL DEFAULT 0,
  monthly_reset_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own allowances" ON public.allowances
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own allowances" ON public.allowances
  FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own allowances" ON public.allowances
  FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- 5. Entitlements cache (derived from subscription status, server-authoritative)
CREATE TABLE public.entitlements_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  tier text NOT NULL DEFAULT 'free',
  unlimited_likes boolean NOT NULL DEFAULT false,
  unlimited_rewinds boolean NOT NULL DEFAULT false,
  passport_enabled boolean NOT NULL DEFAULT false,
  visibility_controls boolean NOT NULL DEFAULT false,
  ads_disabled boolean NOT NULL DEFAULT false,
  see_who_liked boolean NOT NULL DEFAULT false,
  priority_likes boolean NOT NULL DEFAULT false,
  top_picks_enabled boolean NOT NULL DEFAULT false,
  pre_match_message boolean NOT NULL DEFAULT false,
  priority_score_multiplier numeric NOT NULL DEFAULT 1.0,
  weekly_super_likes integer NOT NULL DEFAULT 0,
  weekly_first_impressions integer NOT NULL DEFAULT 0,
  monthly_boosts integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entitlements_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entitlements" ON public.entitlements_cache
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- 6. RPC: Sync entitlements from subscription tier
CREATE OR REPLACE FUNCTION public.sync_entitlements(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_tier text;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  v_tier := COALESCE(v_profile.subscription_tier, 'free');

  INSERT INTO entitlements_cache (profile_id, tier, unlimited_likes, unlimited_rewinds, passport_enabled,
    visibility_controls, ads_disabled, see_who_liked, priority_likes, top_picks_enabled,
    pre_match_message, priority_score_multiplier, weekly_super_likes, weekly_first_impressions, monthly_boosts)
  VALUES (
    p_profile_id, v_tier,
    v_tier IN ('plus','gold','platinum'),  -- unlimited_likes
    v_tier IN ('plus','gold','platinum'),  -- unlimited_rewinds
    v_tier IN ('plus','gold','platinum'),  -- passport_enabled
    v_tier IN ('plus','gold','platinum'),  -- visibility_controls
    v_tier IN ('plus','gold','platinum'),  -- ads_disabled
    v_tier IN ('gold','platinum'),         -- see_who_liked
    v_tier IN ('gold','platinum'),         -- priority_likes
    v_tier IN ('gold','platinum'),         -- top_picks_enabled
    v_tier = 'platinum',                   -- pre_match_message
    CASE v_tier WHEN 'platinum' THEN 2.0 WHEN 'gold' THEN 1.5 WHEN 'plus' THEN 1.2 ELSE 1.0 END,
    CASE v_tier WHEN 'platinum' THEN 3 WHEN 'gold' THEN 2 ELSE 0 END,
    CASE WHEN v_tier = 'platinum' THEN 3 ELSE 0 END,
    CASE WHEN v_tier IN ('gold','platinum') THEN 1 ELSE 0 END
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

  -- Also sync allowances
  INSERT INTO allowances (profile_id, weekly_super_likes, weekly_super_likes_max,
    weekly_first_impressions, weekly_first_impressions_max, monthly_boosts, monthly_boosts_max)
  VALUES (
    p_profile_id,
    CASE v_tier WHEN 'platinum' THEN 3 WHEN 'gold' THEN 2 ELSE 0 END,
    CASE v_tier WHEN 'platinum' THEN 3 WHEN 'gold' THEN 2 ELSE 0 END,
    CASE WHEN v_tier = 'platinum' THEN 3 ELSE 0 END,
    CASE WHEN v_tier = 'platinum' THEN 3 ELSE 0 END,
    CASE WHEN v_tier IN ('gold','platinum') THEN 1 ELSE 0 END,
    CASE WHEN v_tier IN ('gold','platinum') THEN 1 ELSE 0 END
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    weekly_super_likes_max = EXCLUDED.weekly_super_likes_max,
    weekly_first_impressions_max = EXCLUDED.weekly_first_impressions_max,
    monthly_boosts_max = EXCLUDED.monthly_boosts_max,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'tier', v_tier);
END;
$$;

-- 7. RPC: Use a boost from wallet
CREATE OR REPLACE FUNCTION public.use_boost(p_profile_id uuid, p_boost_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet boost_wallets%ROWTYPE;
  v_duration interval;
BEGIN
  SELECT * INTO v_wallet FROM boost_wallets WHERE profile_id = p_profile_id FOR UPDATE;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No boost wallet found');
  END IF;

  IF p_boost_type = 'boost' THEN
    IF v_wallet.boosts <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_boosts', 'remaining', 0);
    END IF;
    UPDATE boost_wallets SET boosts = boosts - 1, updated_at = now() WHERE profile_id = p_profile_id;
    UPDATE profiles SET last_boost_at = now() WHERE id = p_profile_id;
    v_duration := interval '30 minutes';
    
  ELSIF p_boost_type = 'primetime' THEN
    IF v_wallet.primetime_boosts <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_primetime_boosts', 'remaining', 0);
    END IF;
    UPDATE boost_wallets SET primetime_boosts = primetime_boosts - 1, updated_at = now() WHERE profile_id = p_profile_id;
    UPDATE profiles SET last_boost_at = now() WHERE id = p_profile_id;
    v_duration := interval '30 minutes';
    
  ELSIF p_boost_type = 'monthly' THEN
    -- Use monthly free boost
    IF v_wallet.monthly_boost_available = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_monthly_boost');
    END IF;
    UPDATE boost_wallets SET monthly_boost_available = false, updated_at = now() WHERE profile_id = p_profile_id;
    UPDATE profiles SET last_boost_at = now() WHERE id = p_profile_id;
    v_duration := interval '30 minutes';
    
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_boost_type');
  END IF;

  -- Log the transaction
  INSERT INTO boost_transactions (profile_id, boost_type, action, quantity)
  VALUES (p_profile_id, p_boost_type, 'use', 1);

  RETURN jsonb_build_object('success', true, 'boost_type', p_boost_type, 'duration', extract(epoch from v_duration));
END;
$$;

-- 8. RPC: Check and assign promo offer for first-time users
CREATE OR REPLACE FUNCTION public.check_promo_eligibility(p_profile_id uuid, p_tier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing promotions%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_base_price numeric;
  v_offer_price numeric;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'error', 'Profile not found');
  END IF;

  -- Check if user ever had any subscription
  IF COALESCE(v_profile.first_purchase_promo_used, false) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'already_purchased');
  END IF;

  -- Check existing active promo
  SELECT * INTO v_existing FROM promotions
  WHERE profile_id = p_profile_id AND tier = p_tier AND eligible = true AND redeemed_at IS NULL
  AND offer_expires_at > now();

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'eligible', true,
      'promo_id', v_existing.id,
      'offer_price', v_existing.offer_price,
      'renewal_price', v_existing.renewal_price,
      'discount_percent', v_existing.discount_percent,
      'expires_at', v_existing.offer_expires_at
    );
  END IF;

  -- Create new promo (50% off first week)
  v_base_price := CASE p_tier
    WHEN 'plus' THEN 9.99
    WHEN 'gold' THEN 14.99
    WHEN 'platinum' THEN 19.99
    ELSE 9.99
  END;
  v_offer_price := ROUND(v_base_price * 0.5, 2);

  INSERT INTO promotions (profile_id, promo_type, tier, offer_price, renewal_price, discount_percent, offer_expires_at)
  VALUES (p_profile_id, 'intro_offer', p_tier, v_offer_price, v_base_price, 50, now() + interval '30 minutes')
  ON CONFLICT (profile_id, promo_type, tier) DO UPDATE SET
    offer_price = v_offer_price,
    renewal_price = v_base_price,
    offer_start_at = now(),
    offer_expires_at = now() + interval '30 minutes',
    eligible = true,
    redeemed_at = NULL
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'eligible', true,
    'promo_id', v_existing.id,
    'offer_price', v_offer_price,
    'renewal_price', v_base_price,
    'discount_percent', 50,
    'expires_at', v_existing.offer_expires_at
  );
END;
$$;

-- 9. RPC: Reset weekly allowances (called by cron)
CREATE OR REPLACE FUNCTION public.reset_weekly_allowances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE allowances SET
    weekly_super_likes = weekly_super_likes_max,
    weekly_first_impressions = weekly_first_impressions_max,
    weekly_reset_at = now() + interval '7 days',
    updated_at = now()
  WHERE weekly_reset_at <= now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 10. RPC: Reset monthly allowances (called by cron)
CREATE OR REPLACE FUNCTION public.reset_monthly_allowances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Reset monthly boosts
  UPDATE allowances SET
    monthly_boosts = monthly_boosts_max,
    monthly_reset_at = now() + interval '30 days',
    updated_at = now()
  WHERE monthly_reset_at <= now();
  
  -- Also grant monthly boost in wallet for Gold/Platinum
  UPDATE boost_wallets SET
    monthly_boost_available = true,
    monthly_boost_reset_at = now() + interval '30 days',
    updated_at = now()
  WHERE profile_id IN (
    SELECT id FROM profiles WHERE subscription_tier IN ('gold', 'platinum')
    AND subscription_expires_at > now()
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
