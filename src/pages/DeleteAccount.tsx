import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { memberTicketContact } from "@/lib/supportTickets";
import { useAuth } from "@/hooks/useAuth";
import { useMemberSettings } from "@/hooks/useMemberSettings";

const deleteReasons = [
  { id: "found_someone", label: "I found the friends I was looking for" },
  { id: "taking_break", label: "I need a break from social apps" },
  { id: "not_useful", label: "The app isn't useful" },
  { id: "too_many_ads", label: "Too many ads" },
  { id: "privacy", label: "Privacy concerns" },
  { id: "other", label: "Other reason" },
];

const ticketNumber = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "DEL-";
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

/**
 * Deleting an account is a request handled by the ISEXY team (a support
 * ticket), never an instant client-side delete: the TAKATAK sign-in is shared
 * with other TAKATAK services and member data is only removed by staff.
 */
const DeleteAccount = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { save } = useMemberSettings();
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (selectedReason === "other" && !otherReason.trim()) {
      setShowConfirmDialog(false);
      toast.error("Please tell us a little more about why you're leaving");
      return;
    }
    setIsDeleting(true);
    const reason = deleteReasons.find((r) => r.id === selectedReason)?.label ?? selectedReason;
    const number = ticketNumber();
    // The sign-in e-mail, or the phone for a phone-only account (0015 K2 refuses any other).
    const { contact } = memberTicketContact(user);
    const { error } = await supabase.from("support_tickets").insert({
      ticket_number: number,
      user_id: user.id,
      name: (profile?.first_name || "ISEXY member").slice(0, 200),
      email: contact,
      subject: "Account deletion request",
      category: "Account Issues",
      priority: "high",
      status: "open",
      message: [
        "Please delete my ISEXY account and data.",
        `Reason: ${reason}${otherReason.trim() ? ` - ${otherReason.trim().slice(0, 2000)}` : ""}`,
        `Member id: ${user.id}`,
      ].join("\n"),
    });
    if (error) {
      console.error("Deletion request failed:", error);
      setIsDeleting(false);
      setShowConfirmDialog(false);
      toast.error("We couldn't send your request. Please try again, or write to us from Contact Us.");
      return;
    }
    await save({ deletionRequestedAt: new Date().toISOString() });
    if (user.email) {
      // Best effort: the member gets the ticket number by email.
      supabase.functions.invoke("isexy-send-ticket-confirmation", {
        body: { name: profile?.first_name || "ISEXY member", email: user.email, ticketNumber: number, subject: "Account deletion request", category: "Account Issues", priority: "high", message: `Reason: ${reason}` },
      }).catch(() => undefined);
    }
    setIsDeleting(false);
    setShowConfirmDialog(false);
    toast.success(`Request received (ticket ${number}). Our team will delete your ISEXY account and confirm by email.`, { duration: 10000 });
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <AuthLayout showBack variant="gray">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delete Account</h1>
          <p className="text-muted-foreground mt-1">We're sad to see you go</p>
        </div>

        {/* Warning Banner */}
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive">This action is permanent</h3>
            <p className="text-sm text-destructive/80 mt-1">
              Deleting your account will permanently remove all your data, matches, messages, and subscription.
              Your TAKATAK sign-in itself stays, so other TAKATAK services keep working.
            </p>
          </div>
        </div>

        {/* Reason Selection */}
        <div className="bg-card rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-foreground">Why are you leaving?</h3>
          <p className="text-sm text-muted-foreground">
            We'd like to know why you're leaving so we can improve.
          </p>

          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            {deleteReasons.map((reason) => (
              <div
                key={reason.id}
                className="flex items-center space-x-3 py-3 border-b border-border last:border-0"
              >
                <RadioGroupItem value={reason.id} id={reason.id} />
                <Label
                  htmlFor={reason.id}
                  className="flex-1 cursor-pointer font-normal"
                >
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {selectedReason === "other" && (
            <Textarea
              placeholder="Please tell us more..."
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              className="mt-3"
              rows={4}
            />
          )}
        </div>

        {/* What You'll Lose */}
        <div className="bg-card rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-foreground">What you'll lose</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              All your matches and messages
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              Your profile information and photos
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              Any remaining subscription time
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              Super Likes, Boosts, and other purchases
            </li>
          </ul>
        </div>

        {/* Alternative Options */}
        <div className="bg-card rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-foreground">Consider alternatives</h3>
          <p className="text-sm text-muted-foreground">
            Instead of deleting your account, you can:
          </p>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/settings")}
            >
              Hide your profile from Discover
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/email-settings")}
            >
              Get fewer emails
            </Button>
          </div>
        </div>

        {/* Delete Button */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setShowConfirmDialog(true)}
          disabled={!selectedReason}
        >
          Delete My Account
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By deleting your account, you agree to our Terms of Service regarding account deletion.
        </p>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. We'll sign you out and our team will permanently
              delete your ISEXY account and data, then confirm by email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog open (with "Deleting...") until the request is sent.
                e.preventDefault();
                handleDeleteAccount();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Yes, delete my account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthLayout>
  );
};

export default DeleteAccount;
