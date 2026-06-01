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
        const { data } = await supabase.functions.invoke("payments-gate-status");
        if (!cancelled && data) {
          cached = data as GateStatus;
          setStatus(cached);
        }
      } catch {
        // Silently ignore — page still renders without microcopy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
