import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Restoring a subscription requires proof from its payment provider.
// Opening a linked support ticket is a real action; it never grants access
// based on an unverified confirmation number.
const RestorePurchase = () => {
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const confirmation = confirmationNumber.trim();
    const contactName = name.trim();
    const contactEmail = email.trim().toLowerCase();

    if (!confirmation || !contactName || !contactEmail) {
      toast.error("Please complete all the fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast.error("Enter a valid contact email address.");
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
      const { error: insertError } = await supabase.from("support_tickets").insert({
        ticket_number: newTicket,
        user_id: user.id,
        name: contactName,
        email: contactEmail,
        subject: "Purchase restoration review",
        category: "Payments",
        priority: "medium",
        message: `Please verify my earlier purchase and advise on transfer to my current account. Confirmation reference: ${confirmation}`,
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
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
            Restore Your Purchase
          </h1>

          {ticketNumber ? (
            <div className="max-w-sm w-full space-y-4" role="status">
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
              <p className="text-center text-muted-foreground mb-8 max-w-sm">
                To review a subscription bought on another account, sign in to your
                current ISEXY account and submit your receipt reference. A support
                agent must verify it with the payment provider before any transfer.
              </p>
              <form id="restore-purchase-form" onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
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
                  placeholder="Contact email address"
                  aria-label="Contact email address"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={255}
                  required
                />
              </form>
            </>
          )}
        </div>

        {!ticketNumber && (
          <Button
            type="submit"
            form="restore-purchase-form"
            className="w-full bg-primary text-primary-foreground"
            disabled={isSubmitting || !confirmationNumber.trim() || !name.trim() || !email.trim()}
          >
            {isSubmitting ? "Submitting..." : "Request purchase review"}
          </Button>
        )}
      </div>
    </AuthLayout>
  );
};

export default RestorePurchase;
