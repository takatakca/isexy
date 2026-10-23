import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AD_STATUS_QUERY_KEY } from "@/hooks/useAdFree";

/**
 * Coming back from Stripe (?checkout=success|cancelled, older links
 * ?success=true / ?canceled=true / ?purchase=...). Says what happened, then
 * refreshes the balances a few times: the webhook credits the account a few
 * seconds after the payment. The query is removed so a reload does not repeat it.
 * Ads go away too: the ad-free status is re-read with the balances.
 */
export function useCheckoutReturn(onPaid?: () => unknown, successMessage = "Payment received. Updating your account…") {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const done = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const timers = useRef<number[]>([]);

  // Refreshes keep running after the URL is cleaned, until the page closes.
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  useEffect(() => {
    if (done.current) return;
    const checkout = params.get("checkout") ?? params.get("purchase");
    const success = checkout === "success" || params.get("success") === "true";
    const cancelled = checkout === "cancelled" || checkout === "canceled" || params.get("canceled") === "true" || params.get("cancelled") === "true";
    if (!success && !cancelled) return;
    done.current = true;

    if (success) {
      toast.success(successMessage);
      for (const delay of [0, 2500, 6000, 12000]) {
        timers.current.push(window.setTimeout(() => {
          onPaidRef.current?.();
          void queryClient.invalidateQueries({ queryKey: AD_STATUS_QUERY_KEY });
        }, delay));
      }
    } else {
      toast("Payment cancelled. Nothing was charged.");
    }

    const next = new URLSearchParams(params);
    for (const key of ["checkout", "purchase", "success", "canceled", "cancelled", "package"]) next.delete(key);
    const query = next.toString();
    navigate({ pathname: location.pathname, search: query ? `?${query}` : "" }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
}
