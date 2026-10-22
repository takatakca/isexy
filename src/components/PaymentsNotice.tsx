import { Lock, FlaskConical } from "lucide-react";
import type { GateStatus } from "@/hooks/usePaymentsGate";

/**
 * Says clearly, above a buy button, why it is disabled (payments not set up,
 * live payments paused, or the status could not be read) or that this is
 * Stripe test mode.
 */
export function PaymentsNotice({ gate }: { gate: GateStatus | null }) {
  if (!gate) return null;
  if (gate.blocked) {
    return (
      <div role="status" className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-3 py-2">
        <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
        <span>
          {gate.reason === "live_disabled"
            ? "Purchases are paused while we finish testing payments. Nothing can be charged right now."
            : gate.reason === "unavailable"
              ? "We could not check whether payments are open, so nothing can be bought right now. Please try again later."
              : "Payments are not open yet. Nothing can be charged right now; your balances and plan stay as they are."}
        </span>
      </div>
    );
  }
  if (gate.mode === "test") {
    return (
      <div role="status" className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/30 rounded-2xl px-3 py-2">
        <FlaskConical className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span>Test mode: use a Stripe test card, no real charge.</span>
      </div>
    );
  }
  return null;
}
