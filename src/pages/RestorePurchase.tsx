import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const RestorePurchase = () => {
  const [confirmationNumber, setConfirmationNumber] = useState("");

  const handleSubmit = () => {
    if (!confirmationNumber.trim()) {
      toast.error("Please enter a confirmation number");
      return;
    }
    toast.success("Purchase restoration request submitted");
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="p-6 flex flex-col min-h-[calc(100vh-60px)]">
        <div className="flex-1 flex flex-col items-center justify-start pt-8">
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">
            Restore Your Purchase
          </h1>

          <p className="text-center text-muted-foreground mb-8 max-w-sm">
            If you've created a new account and are looking to transfer your subscription from your old account, check your email receipt and enter your purchase confirmation below:
          </p>

          <Input
            placeholder="Enter Confirmation Number"
            value={confirmationNumber}
            onChange={(e) => setConfirmationNumber(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Button
          onClick={handleSubmit}
          className="w-full bg-muted text-muted-foreground hover:bg-muted/80"
          disabled={!confirmationNumber.trim()}
        >
          Submit
        </Button>
      </div>
    </AuthLayout>
  );
};

export default RestorePurchase;
