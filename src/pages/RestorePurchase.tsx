import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, Info } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { readInvokeError } from "@/lib/payments";
import { memberTicketContact } from "@/lib/supportTickets";

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
 * Restore purchases, two ways:
 * - Same account (Takatak sign-in): asks Stripe for this member's plan and
 *   paid purchases and adds anything a missed payment confirmation never
 *   credited. Nothing is typed in: the server finds the purchases itself, so
 *   nothing can be claimed that was not paid.
 * - Bought on another account (main ceeb511): opens a real support ticket
 *   with the receipt reference. Staff verify it with the payment provider;
 *   nothing is granted from an unverified confirmation number.
 */
const RestorePurchase = () => {
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

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
      if (answer.error) {
        setOutcome({ kind: "error", message: "Your purchases could not be checked right now. Please try again later." });
        return;
      }
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

  const handleReviewRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const confirmation = confirmationNumber.trim();
    const contactName = name.trim();
    const purchaseEmail = email.trim().toLowerCase();

    if (!confirmation || !contactName || !purchaseEmail) {
      toast.error("Please complete all the fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaseEmail)) {
      toast.error("Enter the email address used for that purchase.");
      return;
    }
    if (confirmation.length > 150) {
      toast.error("The confirmation reference is too long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Sign in to your new ISEXY account before requesting purchase restoration.");
      }

      const newTicket = `RP-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
      // The ticket goes under this account's sign-in e-mail (0015 K2 refuses another);
      // the other account's address only helps staff find the payment.
      const { error: insertError } = await supabase.from("support_tickets").insert({
        ticket_number: newTicket,
        user_id: user.id,
        name: contactName,
        email: memberTicketContact(user).contact,
        subject: "Purchase restoration review",
        category: "Payments",
        priority: "medium",
        message: `Please verify my earlier purchase and advise on transfer to my current account. Confirmation reference: ${confirmation}. Email used for that purchase: ${purchaseEmail}`,
        status: "open",
      });
      if (insertError) throw insertError;

      // A ticket was persisted, but the purchase still requires staff/provider
      // verification. Never claim that the subscription was restored.
      setTicketNumber(newTicket);
      toast.success("Your purchase review ticket was created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create a support ticket. Please retry.");
    } finally {
      setIsSubmitting(false);
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

          <Button onClick={handleRestore} disabled={loading} className="mt-6 w-full max-w-sm gradient-primary text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Restore my purchases"}
          </Button>

          <section className="mt-10 w-full max-w-sm space-y-3" aria-labelledby="other-account-title">
            <h2 id="other-account-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="w-4 h-4 shrink-0" aria-hidden /> Bought on another account?
            </h2>
            {ticketNumber ? (
              <div className="space-y-2 text-sm" role="status">
                <p className="font-semibold text-foreground">Review ticket created: {ticketNumber}</p>
                <p className="text-muted-foreground">
                  Your purchase has not been restored yet. Our support team will verify the
                  payment before making any changes to your subscription.
                </p>
                <Link className="text-primary underline" to="/ticket-tracking">
                  Track your support request
                </Link>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Purchases stay with the account that paid. Sign in to your current ISEXY account and
                  send your receipt reference: a support agent verifies it with the payment provider
                  before any transfer, and replies to this account's email.
                </p>
                <form onSubmit={handleReviewRequest} className="space-y-3">
                  <Input
                    placeholder="Purchase confirmation number"
                    aria-label="Purchase confirmation number"
                    value={confirmationNumber}
                    onChange={(event) => setConfirmationNumber(event.target.value)}
                    maxLength={150}
                    required
                  />
                  <Input
                    placeholder="Your name"
                    aria-label="Your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={100}
                    required
                  />
                  <Input
                    type="email"
                    placeholder="Email used for that purchase"
                    aria-label="Email used for that purchase"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={255}
                    required
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={isSubmitting || !confirmationNumber.trim() || !name.trim() || !email.trim()}
                  >
                    {isSubmitting ? "Submitting..." : "Request purchase review"}
                  </Button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </AuthLayout>
  );
};

export default RestorePurchase;
