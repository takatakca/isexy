import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GateStatus {
  liveEnabled: boolean;
  isTestKey: boolean;
  isLiveKey: boolean;
  /** Checkout cannot start: buy buttons are disabled and say why. */
  blocked: boolean;
  mode: "test" | "live" | "unknown";
  /** Why it is blocked (older gate versions do not send it: derived). "unavailable": the status could not be read. */
  reason: "not_configured" | "live_disabled" | "unavailable" | null;
  /** The first-week discount exists in Stripe (Premium shows the offer only then). */
  firstWeekPromo: boolean;
}

/** Label for a buy button when payments cannot start (null: the button works). */
export function blockedLabel(gate: GateStatus | null): string | null {
  // Fail closed (main 705cc26): no checkout until the server's answer is known.
  if (!gate) return "Checking payments…";
  if (!gate.blocked) return null;
  if (gate.reason === "unavailable") return "Payments unavailable";
  return gate.reason === "live_disabled" ? "Purchases paused" : "Payments not open yet";
}

/** The gate status could not be read: sales stay closed (never cached, the next page retries). */
const UNAVAILABLE: GateStatus = {
  liveEnabled: false,
  isTestKey: false,
  isLiveKey: false,
  blocked: true,
  mode: "unknown",
  reason: "unavailable",
  firstWeekPromo: false,
};

let cached: GateStatus | null = null;
let pending: Promise<GateStatus | null> | null = null;

function normalize(raw: Record<string, unknown>): GateStatus | null {
  // A malformed answer is an unknown state, not an open one.
  if (typeof raw.blocked !== "boolean" || !["test", "live", "unknown"].includes(String(raw.mode))) return null;
  const isTestKey = raw.isTestKey === true;
  const isLiveKey = raw.isLiveKey === true;
  const liveEnabled = raw.liveEnabled === true;
  // Gate versions before 2026-10 had no "configured": no key at all = not configured.
  const configured = typeof raw.configured === "boolean" ? raw.configured : isTestKey || isLiveKey;
  const reason =
    raw.reason === "not_configured" || raw.reason === "live_disabled"
      ? raw.reason
      : !configured
        ? "not_configured"
        : raw.blocked === true
          ? "live_disabled"
          : null;
  return {
    liveEnabled,
    isTestKey,
    isLiveKey,
    blocked: reason !== null,
    mode: isTestKey ? "test" : isLiveKey ? "live" : "unknown",
    reason,
    firstWeekPromo: raw.firstWeekPromo === true,
  };
}

async function fetchGate(): Promise<GateStatus | null> {
  try {
    const { data, error } = await supabase.functions.invoke("isexy-payments-gate-status");
    if (error || !data || typeof data !== "object") return null;
    const status = normalize(data as Record<string, unknown>);
    if (status) cached = status;
    return status;
  } catch {
    return null;
  }
}

/**
 * Can members pay right now? null while loading; when the status cannot be
 * read the answer is "blocked" (reason "unavailable"): sales never start on an
 * unknown state (the checkout functions refuse server-side as well).
 */
export function usePaymentsGate() {
  const [status, setStatus] = useState<GateStatus | null>(cached);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    pending ??= fetchGate().finally(() => { pending = null; });
    pending.then((s) => { if (!cancelled) setStatus(s ?? UNAVAILABLE); });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
