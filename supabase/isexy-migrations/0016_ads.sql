-- ISEXY ads: who sees ads. Free members see small banners (TAKATAK ads first,
-- Google AdSense as the fallback; src/components/AdSlot.tsx); as soon as a
-- member pays for anything, ads go away. The browser never decides this: it
-- asks isexy.get_my_ad_status() and shows nothing until the answer arrives
-- (src/hooks/useAdFree.ts). NOT applied anywhere yet.
--
-- Runs after 0013_app_completion (plan_grants, tier_rank, the Stripe
-- fulfilment ledgers) and 0014_security_and_performance (members can no
-- longer write any of the tables read here). 0015 (trust area) is
-- independent of this file. isexy schema only, no table, no policy, no data
-- change: one read-only SECURITY DEFINER function.
--
-- get_my_ad_status() -> jsonb {ad_free boolean, reason text, until timestamptz}
--   ad_free = true when the caller (auth.uid()) is, in this order:
--   1. staff: isexy.user_roles admin or moderator                reason 'staff'
--   2. on any active plan (Plus, Gold, Platinum: "No ads" is a plan benefit),
--      from the same sources as refresh_member_plan (0013 R3): an active or
--      trialing Stripe subscription (1 day of grace after the period end), a
--      plan grant (redeemed code, loyalty reward, staff), a code redeemed
--      before plan_grants existed, or the server-maintained profile plan
--      (is_premium + subscription_tier + subscription_expires_at, which
--      members cannot write: 0014 A)                             reason 'plan'
--   3. holding an active chat subscription (paid on Stripe)
--                                                    reason 'chat_subscription'
--   4. a successful payment in the last AD_FREE_AFTER_PAYMENT (30 days):
--      the Stripe ledgers written by fulfill_stripe_payment and
--      apply_chat_subscription (credit_transactions 'purchase', which also
--      records chat subscriptions; boost_transactions 'purchase'; completed
--      gift_transactions sent and donations made, Cuba on hold but recorded),
--      or a Stripe plan period that started in that window (a plan cancelled
--      at the end of a paid week keeps ads away for the rest of the 30 days)
--                                                       reason 'recent_payment'
--   otherwise ad_free = false, reason 'free' ('no_profile' when the caller has
--   no ISEXY profile yet). `until` = when the reason ends (NULL: open-ended or
--   not ad-free), so the client can cache the answer.
--   stripe_webhook_events is not read: it has no member column, and every
--   delivered payment lands in one of the ledgers above.
-- Every row read is the caller's own; anon cannot execute it (signed-out
-- visitors never ask: they only see ads on public content pages).

SET LOCAL search_path = isexy, extensions;

CREATE OR REPLACE FUNCTION isexy.get_my_ad_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = isexy, extensions
AS $$
DECLARE
  -- AD_FREE_AFTER_PAYMENT: how long one successful payment keeps ads away.
  -- The pages say "30 days" (src/lib/ads.ts AD_FREE_DAYS_AFTER_PAYMENT,
  -- Privacy and Cookie policies): change them together.
  c_ad_free_after_payment CONSTANT interval := interval '30 days';
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_found boolean := false;
  v_until timestamptz;
  v_paid_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  -- 1. Staff never see ads.
  IF has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'moderator'::app_role) THEN
    RETURN jsonb_build_object('ad_free', true, 'reason', 'staff', 'until', NULL);
  END IF;

  SELECT p.id INTO v_profile_id FROM profiles p WHERE p.user_id = v_uid;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ad_free', false, 'reason', 'no_profile', 'until', NULL);
  END IF;

  -- 2. Any active plan. Open-ended sources (NULL end) first, then the latest end.
  SELECT true, c.until INTO v_found, v_until
  FROM (
    SELECT s.current_period_end + interval '1 day' AS until
      FROM subscriptions s
     WHERE s.profile_id = v_profile_id
       AND s.status IN ('active', 'trialing')
       AND tier_rank(s.tier) > 0
       AND (s.current_period_end IS NULL OR s.current_period_end + interval '1 day' > now())
    UNION ALL
    SELECT g.expires_at
      FROM plan_grants g
     WHERE g.profile_id = v_profile_id
       AND g.starts_at <= now()
       AND (g.expires_at IS NULL OR g.expires_at > now())
    UNION ALL
    SELECT r.expires_at
      FROM coupon_redemptions r
     WHERE r.profile_id = v_profile_id
       AND split_part(r.applied_benefit, ':', 1) IN ('trial', 'permanent', 'vip')
       AND tier_rank(split_part(r.applied_benefit, ':', 2)) > 0
       AND (r.expires_at IS NULL OR r.expires_at > now())
    UNION ALL
    SELECT p.subscription_expires_at
      FROM profiles p
     WHERE p.id = v_profile_id
       AND coalesce(p.is_premium, false)
       AND tier_rank(p.subscription_tier) > 0
       AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
  ) c
  ORDER BY (c.until IS NULL) DESC, c.until DESC
  LIMIT 1;
  IF v_found THEN
    RETURN jsonb_build_object('ad_free', true, 'reason', 'plan', 'until', v_until);
  END IF;

  -- 3. An active chat subscription.
  SELECT max(cs.expires_at) INTO v_until
    FROM chat_subscriptions cs
   WHERE cs.profile_id = v_profile_id
     AND cs.status = 'active'
     AND cs.expires_at > now();
  IF v_until IS NOT NULL THEN
    RETURN jsonb_build_object('ad_free', true, 'reason', 'chat_subscription', 'until', v_until);
  END IF;

  -- 4. The latest successful payment, if it is recent enough.
  SELECT max(x.paid_at) INTO v_paid_at
  FROM (
    SELECT ct.created_at AS paid_at
      FROM credit_transactions ct
     WHERE ct.profile_id = v_profile_id
       AND ct.type = 'purchase'
       AND ct.stripe_session_id IS NOT NULL
       AND ct.created_at > now() - c_ad_free_after_payment
    UNION ALL
    SELECT bt.created_at
      FROM boost_transactions bt
     WHERE bt.profile_id = v_profile_id
       AND bt.action = 'purchase'
       AND bt.stripe_session_id IS NOT NULL
       AND bt.created_at > now() - c_ad_free_after_payment
    UNION ALL
    SELECT coalesce(gt.completed_at, gt.created_at)
      FROM gift_transactions gt
     WHERE gt.sender_profile_id = v_profile_id
       AND gt.status = 'completed'
       AND gt.stripe_session_id IS NOT NULL
       AND coalesce(gt.completed_at, gt.created_at) > now() - c_ad_free_after_payment
    UNION ALL
    SELECT coalesce(d.completed_at, d.created_at)
      FROM donations d
     WHERE d.donor_profile_id = v_profile_id
       AND d.status = 'completed'
       AND d.stripe_session_id IS NOT NULL
       AND coalesce(d.completed_at, d.created_at) > now() - c_ad_free_after_payment
    UNION ALL
    SELECT s.current_period_start
      FROM subscriptions s
     WHERE s.profile_id = v_profile_id
       AND s.stripe_subscription_id IS NOT NULL
       AND s.status IN ('active', 'canceled')
       AND tier_rank(s.tier) > 0
       AND s.current_period_start > now() - c_ad_free_after_payment
       AND s.current_period_start <= now()
  ) x;
  IF v_paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('ad_free', true, 'reason', 'recent_payment',
                              'until', v_paid_at + c_ad_free_after_payment);
  END IF;

  RETURN jsonb_build_object('ad_free', false, 'reason', 'free', 'until', NULL);
END;
$$;

COMMENT ON FUNCTION isexy.get_my_ad_status() IS
  'Whether the calling member sees ads: ad_free for staff, any active plan, an active chat subscription, or a payment in the last 30 days (0016_ads.sql).';

REVOKE ALL ON FUNCTION isexy.get_my_ad_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION isexy.get_my_ad_status() TO authenticated;
