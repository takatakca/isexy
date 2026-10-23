import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isMissingRpc } from "@/lib/payments";

/** Every balance of the signed-in member (isexy.get_my_wallet). */
export interface Wallet {
  tier: "free" | "plus" | "gold" | "platinum";
  is_premium: boolean;
  plan_expires_at: string | null;
  /** Where the plan comes from: Stripe, a redeemed code, a loyalty reward, staff. */
  plan_source: "stripe" | "coupon" | "loyalty" | "staff" | null;
  credits: number;
  phone_minutes: number;
  video_minutes: number;
  boosts: number;
  primetime_boosts: number;
  super_boost_hours: number;
  monthly_boost_available: boolean;
  boost_active_until: string | null;
  /** Bought / earned Super Likes (kept until used). */
  super_likes: number;
  /** This week's plan allowance (Gold: 5). */
  weekly_super_likes: number;
  weekly_super_likes_max: number;
  super_likes_unlimited: boolean;
  weekly_first_impressions: number;
  weekly_first_impressions_max: number;
  weekly_reset_at: string | null;
  likes_remaining: number;
  likes_unlimited: boolean;
  chat_subscription_until: string | null;
  stars: number;
}

const TIERS = ["plus", "gold", "platinum"];

/** Total Super Likes a member can send now (null = unlimited). */
export function superLikesAvailable(w: Wallet): number | null {
  return w.super_likes_unlimited ? null : w.super_likes + w.weekly_super_likes;
}

/**
 * The member's wallet. Before isexy.get_my_wallet is deployed it falls back
 * to reading the tables the member can already read (same numbers).
 */
export function useWallet() {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!profile?.id) return null;
    const { data, error: rpcError } = await supabase.rpc("get_my_wallet");
    let next: Wallet | null = null;
    if (!rpcError && data) {
      next = data as unknown as Wallet;
    } else if (isMissingRpc(rpcError)) {
      const [credits, boosts, allowances] = await Promise.all([
        supabase.from("user_credits").select("credits, phone_minutes, video_minutes").eq("profile_id", profile.id).maybeSingle(),
        supabase.from("boost_wallets").select("boosts, primetime_boosts, super_boost_hours, monthly_boost_available, monthly_boost_reset_at").eq("profile_id", profile.id).maybeSingle(),
        supabase.from("allowances").select("weekly_super_likes, weekly_super_likes_max, weekly_first_impressions, weekly_first_impressions_max, weekly_reset_at").eq("profile_id", profile.id).maybeSingle(),
      ]);
      if (credits.error || boosts.error || allowances.error) {
        if (alive.current) setError(true);
        return null;
      }
      const paid = !!profile.is_premium && TIERS.includes(profile.subscription_tier);
      const tier = (paid ? profile.subscription_tier : "free") as Wallet["tier"];
      next = {
        tier,
        is_premium: paid,
        plan_expires_at: paid ? (profile as { subscription_expires_at?: string | null }).subscription_expires_at ?? null : null,
        plan_source: null,
        credits: credits.data?.credits ?? 0,
        phone_minutes: credits.data?.phone_minutes ?? 0,
        video_minutes: credits.data?.video_minutes ?? 0,
        boosts: boosts.data?.boosts ?? 0,
        primetime_boosts: boosts.data?.primetime_boosts ?? 0,
        super_boost_hours: boosts.data?.super_boost_hours ?? 0,
        monthly_boost_available: !!boosts.data?.monthly_boost_available && (tier === "gold" || tier === "platinum"),
        boost_active_until: null,
        super_likes: profile.super_likes_remaining ?? 0,
        weekly_super_likes: allowances.data?.weekly_super_likes ?? 0,
        weekly_super_likes_max: allowances.data?.weekly_super_likes_max ?? 0,
        super_likes_unlimited: tier === "platinum",
        weekly_first_impressions: allowances.data?.weekly_first_impressions ?? 0,
        weekly_first_impressions_max: allowances.data?.weekly_first_impressions_max ?? 0,
        weekly_reset_at: allowances.data?.weekly_reset_at ?? null,
        likes_remaining: profile.likes_remaining ?? 0,
        likes_unlimited: paid,
        chat_subscription_until: null,
        stars: 0,
      };
    } else {
      if (alive.current) setError(true);
      return null;
    }
    if (alive.current) {
      setWallet(next);
      setError(false);
    }
    return next;
  }, [profile]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      return await load();
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    alive.current = true;
    if (profile?.id) refresh();
    else setLoading(false);
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  return { wallet, loading, error, refresh, setWallet };
}
