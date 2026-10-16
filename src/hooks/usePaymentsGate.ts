import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GateStatus {
  liveEnabled: boolean;
  isTestKey: boolean;
  isLiveKey: boolean;
  /** Checkout cannot start: buy buttons are disabled and say why. */
  blocked: boolean;
  mode: "test" | "live" | "unknown";
  /** Why it is blocked (older gate versions do not send it: derived). */
  reason: "not_configured" | "live_disabled" | null;
  /** The first-week discount exists in Stripe (Premium shows the offer only then). */
  firstWeekPromo: boolean;
}

/** Label for a buy button when payments cannot start (null: the button works). */
export function blockedLabel(gate: GateStatus | null): string | null {
  if (!gate?.blocked) return null;
  return gate.reason === "live_disabled" ? "Purchases paused" : "Payments not open yet";
}

let cached: GateStatus | null = null;
let pending: Promise<GateStatus | null> | null = null;

function normalize(raw: Record<string, unknown>): GateStatus {
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
    cached = normalize(data as Record<string, unknown>);
    return cached;
  } catch {
    return null;
  }
}

/**
 * Can members pay right now? null while loading or when the status could not
 * be read (the buttons stay usable then; the checkout function refuses with
 * a clear message if payments are really off).
 */
export function usePaymentsGate() {
  const [status, setStatus] = useState<GateStatus | null>(cached);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    pending ??= fetchGate().finally(() => { pending = null; });
    pending.then((s) => { if (!cancelled && s) setStatus(s); });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
