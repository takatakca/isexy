import { supabase } from "@/integrations/supabase/client";

export type BoostKind = "boost" | "primetime" | "monthly" | "super";

export interface BoostResult {
  ok: boolean;
  activeUntil?: string | null;
  hours?: number;
  /** Why it did not start (ok = false). */
  reason?: "none_left" | "already_running" | "error";
  message?: string;
}

const time = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";

/** Start a Boost from the member's wallet (isexy.use_boost checks and spends it). */
export async function activateBoost(profileId: string, kind: BoostKind): Promise<BoostResult> {
  const { data, error } = await supabase.rpc("use_boost", { p_profile_id: profileId, p_boost_type: kind });
  const r = data as { success?: boolean; error?: string; active_until?: string | null; hours?: number } | null;
  if (!error && r?.success) return { ok: true, activeUntil: r.active_until ?? null, hours: r.hours };
  if (r?.error === "boost_active") {
    return { ok: false, reason: "already_running", activeUntil: r.active_until, message: `Your Boost is already running until ${time(r.active_until)}.` };
  }
  if (r?.error && /^no_/.test(r.error)) {
    return { ok: false, reason: "none_left", message: kind === "monthly" ? "Your free monthly Boost is already used." : "You have none left." };
  }
  return { ok: false, reason: "error", message: "Couldn't start your Boost. Please try again." };
}

export function boostEndsLabel(iso: string | null | undefined): string {
  return iso ? `Boost on until ${time(iso)}` : "";
}
