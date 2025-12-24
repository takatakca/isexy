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

const deleteReasons = [
  { id: "found_someone", label: "I found someone" },
  { id: "taking_break", label: "I need a break from dating" },
  { id: "not_useful", label: "The app isn't useful" },
  { id: "too_many_ads", label: "Too many ads" },
  { id: "privacy", label: "Privacy concerns" },
  { id: "other", label: "Other reason" },
];

const DeleteAccount = () => {
  const navigate = useNavigate();
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    // Simulate deletion process
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsDeleting(false);
    setShowConfirmDialog(false);
    toast.success("Account deleted successfully");
    navigate("/welcome");
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
            </p>
          </div>
        </div>

        {/* Reason Selection */}
        <div className="bg-card rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-foreground">Why are you leaving?</h3>
          <p className="text-sm text-muted-foreground">
            We'd love to know why you're leaving so we can improve.
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
              Pause your account temporarily
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate("/settings")}
            >
              Hide your profile from discovery
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
              This action cannot be undone. This will permanently delete your account
              and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
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
