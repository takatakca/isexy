import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GateStatus {
  liveEnabled: boolean;
  isTestKey: boolean;
  isLiveKey: boolean;
  blocked: boolean;
  mode: "test" | "live" | "unknown";
}

let cached: GateStatus | null = null;

export function usePaymentsGate() {
  const [status, setStatus] = useState<GateStatus | null>(cached);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("isexy-payments-gate-status");
        if (error || !data || typeof data.blocked !== "boolean" ||
            !["test", "live", "unknown"].includes(data.mode)) {
          throw new Error("Payment availability unavailable");
        }
        if (!cancelled) {
          cached = data as GateStatus;
          setStatus(cached);
        }
      } catch {
        // When the server's payment state is unknown, do not initiate sales.
        if (!cancelled) setStatus({
          liveEnabled: false,
          isTestKey: false,
          isLiveKey: false,
          blocked: true,
          mode: "unknown",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
