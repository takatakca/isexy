import { supabase } from "@/integrations/supabase/client";

export type SwipeAction = "like" | "pass" | "super_like";

export type SwipeOutcome =
  | { status: "ok"; matchId?: string; likesRemaining?: number }
  | { status: "rate_limited"; cooldownHours: number }
  | { status: "no_likes" | "no_super_likes" | "error" };

export interface Swiper {
  id: string;
  is_premium?: boolean | null;
}

/** Tiers that unlock "See who likes you" (entitlements_cache.see_who_liked). */
export function canSeeWhoLiked(tier?: string | null): boolean {
  return tier === "gold" || tier === "platinum";
}

/** The match row for this pair, if the DB trigger created one. */
export async function findMatchId(meId: string, otherId: string): Promise<string | null> {
  // matches stores the pair ordered: profile1_id = LEAST(a, b).
  const [a, b] = meId < otherId ? [meId, otherId] : [otherId, meId];
  const { data } = await supabase.from("matches").select("id").eq("profile1_id", a).eq("profile2_id", b).maybeSingle();
  return data?.id ?? null;
}

/**
 * Record a like / pass / super like through the server (rate limit, like
 * counters, idempotent insert; the mutual-like trigger creates the match).
 * Resolves with the match id when this swipe made a match.
 */
export async function performSwipe(me: Swiper, profileId: string, action: SwipeAction): Promise<SwipeOutcome> {
  try {
    if (!me.is_premium) {
      const { data: rate } = await supabase.rpc("check_swipe_rate_limit", { p_profile_id: me.id });
      const r = rate as { allowed?: boolean; error?: string; cooldown_until?: string } | null;
      if (r && r.allowed === false) {
        const hours = r.cooldown_until ? Math.max(1, Math.ceil((new Date(r.cooldown_until).getTime() - Date.now()) / 3_600_000)) : 12;
        return { status: "rate_limited", cooldownHours: hours };
      }
    }

    const { data, error } = await supabase.rpc("perform_like", {
      p_swiper_id: me.id,
      p_swiped_id: profileId,
      p_action: action,
    });
    if (error) throw error;
    const result = data as { success?: boolean; error?: string; likes_remaining?: number; already_swiped?: boolean } | null;
    if (result?.success === false) {
      if (result.error === "no_likes_remaining") return { status: "no_likes" };
      if (result.error === "no_super_likes_remaining") return { status: "no_super_likes" };
      return { status: "error" };
    }
    const likesRemaining = typeof result?.likes_remaining === "number" ? result.likes_remaining : undefined;

    if (action !== "pass" && !result?.already_swiped) {
      const matchId = await findMatchId(me.id, profileId);
      if (matchId) return { status: "ok", matchId, likesRemaining };
    }
    return { status: "ok", likesRemaining };
  } catch (e) {
    console.error("Swipe failed:", e);
    return { status: "error" };
  }
}

export interface ReceivedLike {
  /** null while the viewer's plan does not include "See who likes you". */
  liker_id: string | null;
  first_name: string | null;
  birth_date: string | null;
  city: string | null;
  is_verified: boolean | null;
  photo_url: string | null;
  action: "like" | "super_like";
  /** Platinum First Impression sent with the Super Like. */
  message: string | null;
  liked_at: string;
  locked: boolean;
}

/** True when the error means "this RPC is not deployed yet". */
function isMissingRpc(error: { code?: string; message?: string }, name: string): boolean {
  return error.code === "PGRST202" || new RegExp(name).test(error.message ?? "");
}

export class LikesUnavailableError extends Error {}

/**
 * People who liked the signed-in member and are still waiting for an answer,
 * newest first. Pass the last row's liked_at as `before` for the next page.
 * swipes RLS only exposes the swipes a member made, so this goes through the
 * get_likes_received RPC, which also hides identities from plans without
 * "See who likes you".
 */
export async function fetchLikesReceived({ limit = 30, before }: { limit?: number; before?: string } = {}): Promise<ReceivedLike[]> {
  const { data, error } = await supabase.rpc("get_likes_received", {
    p_limit: limit,
    p_before: before,
  });
  if (error) {
    if (isMissingRpc(error, "get_likes_received")) throw new LikesUnavailableError("get_likes_received is not deployed");
    throw error;
  }
  return (data ?? []) as ReceivedLike[];
}

export type FirstImpressionResult =
  | { status: "ok"; remaining: number | null }
  | { status: "not_platinum" | "no_first_impressions" | "no_super_like" | "invalid_message" | "unavailable" | "error" };

/** Attach a Platinum First Impression to the Super Like just sent. */
export async function sendFirstImpression(swipedId: string, message: string): Promise<FirstImpressionResult> {
  const { data, error } = await supabase.rpc("set_first_impression", { p_swiped_id: swipedId, p_message: message });
  if (error) {
    if (isMissingRpc(error, "set_first_impression")) return { status: "unavailable" };
    console.error("First Impression failed:", error);
    return { status: "error" };
  }
  const r = data as { success?: boolean; error?: string; remaining?: number | null } | null;
  if (r?.success) return { status: "ok", remaining: r.remaining ?? null };
  const known = ["not_platinum", "no_first_impressions", "no_super_like", "invalid_message"] as const;
  const code = known.find((k) => k === r?.error);
  return { status: code ?? "error" };
}
