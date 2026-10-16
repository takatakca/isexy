import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, Info } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { readInvokeError } from "@/lib/payments";

/** Answer of isexy-check-subscription with { restore: true }. */
interface RestoreAnswer {
  subscribed?: boolean;
  tier?: string | null;
  subscription_end?: string | null;
  purchases_restored?: number;
  error?: string;
}

type Outcome =
  | { kind: "done"; tier: string | null; end: string | null; purchases: number }
  | { kind: "error"; message: string };

const tierName = (tier: string) => tier.charAt(0).toUpperCase() + tier.slice(1);

/**
 * Restore purchases: asks Stripe for this member's plan and paid purchases
 * (same account: Takatak sign-in) and adds anything a missed payment
 * confirmation never credited. Nothing is typed in: the server finds the
 * purchases itself, so nothing can be claimed that was not paid.
 */
const RestorePurchase = () => {
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const handleRestore = async () => {
    setLoading(true);
    setOutcome(null);
    try {
      const { data, error } = await supabase.functions.invoke("isexy-check-subscription", { body: { restore: true } });
      if (error) {
        const failure = await readInvokeError(error);
        setOutcome({
          kind: "error",
          message:
            failure.status === 401
              ? "Please sign in again, then retry."
              : failure.status === undefined
                ? "Could not reach the payment service. Check your connection and try again."
                : "Your purchases could not be checked right now. Please try again later.",
        });
        return;
      }
      const answer = (data ?? {}) as RestoreAnswer;
      setOutcome({
        kind: "done",
        tier: answer.subscribed && answer.tier ? answer.tier : null,
        end: answer.subscription_end ?? null,
        purchases: answer.purchases_restored ?? 0,
      });
    } catch {
      setOutcome({ kind: "error", message: "Could not reach the payment service. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="p-6 flex flex-col min-h-[calc(100vh-60px)]">
        <div className="flex-1 flex flex-col items-center justify-start pt-8">
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">Restore Your Purchase</h1>

          <p className="text-center text-muted-foreground mb-6 max-w-sm">
            Paid but don't see your plan, Boosts, Super Likes, credits or minutes? We'll check your payments with Stripe
            and add anything that is missing to this account.
          </p>

          {outcome?.kind === "done" && (
            <div role="status" className="w-full max-w-sm rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground space-y-1">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden /> Check complete
              </p>
              <p>
                {outcome.tier
                  ? `Your ISEXY ${tierName(outcome.tier)} plan is active${outcome.end ? ` until ${new Date(outcome.end).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}` : ""}.`
                  : "No active plan was found on this account."}
              </p>
              <p>
                {outcome.purchases > 0
                  ? `${outcome.purchases} missing purchase${outcome.purchases === 1 ? " was" : "s were"} added to your account.`
                  : "All your purchases of the last 90 days are already on your account."}
              </p>
            </div>
          )}

          {outcome?.kind === "error" && (
            <p role="alert" className="w-full max-w-sm rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
              {outcome.message}
            </p>
          )}

          <div className="mt-6 w-full max-w-sm flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <p>
              Bought on another account? Purchases stay with the account that paid. Write to us from{" "}
              <Link to="/help-support" className="text-primary underline">Help &amp; Support</Link> with your Stripe receipt and we'll help.
            </p>
          </div>
        </div>

        <Button onClick={handleRestore} disabled={loading} className="w-full gradient-primary text-white">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Restore my purchases"}
        </Button>
      </div>
    </AuthLayout>
  );
};

export default RestorePurchase;
