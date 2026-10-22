import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/** Invalidate after a purchase so ads go away at once (useCheckoutReturn). */
export const AD_STATUS_QUERY_KEY = ["isexy", "ad-status"] as const;

export type AdFreeReason =
  | "staff"
  | "plan"
  | "chat_subscription"
  | "recent_payment"
  | "free"
  | "no_profile"
  | "signed_out"
  | "unavailable";

export interface AdStatus {
  adFree: boolean;
  reason: AdFreeReason;
  /** When the reason ends (ISO), null when open-ended or not ad-free. */
  until: string | null;
}

const SERVER_REASONS: AdFreeReason[] = ["staff", "plan", "chat_subscription", "recent_payment", "free", "no_profile"];

/** isexy.get_my_ad_status() answer, checked. Anything else = null. */
export function parseAdStatus(data: unknown): AdStatus | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.ad_free !== "boolean") return null;
  const reason = SERVER_REASONS.includes(d.reason as AdFreeReason) ? (d.reason as AdFreeReason) : "unavailable";
  return { adFree: d.ad_free, reason, until: typeof d.until === "string" ? d.until : null };
}

export interface UseAdFree {
  /** undefined while unknown: show no ad yet, so paying members never see one flash. */
  adFree: boolean | undefined;
  reason: AdFreeReason | undefined;
  loading: boolean;
  signedIn: boolean;
}

/**
 * Does the current visitor see ads? The server decides (staff, any plan, a
 * chat subscription, or a payment in the last 30 days: 0016_ads.sql); the
 * answer is cached for 5 minutes per member. Signed-out visitors: ads, but
 * AdSlot only shows them on public content pages. Any error (offline, the
 * function not deployed yet) = no ads (fail closed).
 */
export function useAdFree(): UseAdFree {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: [...AD_STATUS_QUERY_KEY, userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<AdStatus> => {
      const { data, error } = await supabase.rpc("get_my_ad_status");
      if (error) throw error;
      const status = parseAdStatus(data);
      if (!status) throw new Error("unexpected ad status");
      return status;
    },
  });

  if (authLoading) return { adFree: undefined, reason: undefined, loading: true, signedIn: false };
  if (!userId) return { adFree: false, reason: "signed_out", loading: false, signedIn: false };
  if (query.isError) return { adFree: true, reason: "unavailable", loading: false, signedIn: true };
  if (!query.data) return { adFree: undefined, reason: undefined, loading: true, signedIn: true };
  return { adFree: query.data.adFree, reason: query.data.reason, loading: false, signedIn: true };
}
