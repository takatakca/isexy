import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Lock, CheckCircle } from "lucide-react";

const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function UpdatePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const otp = location.state?.otp || "";
  const verified = location.state?.verified || false;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if we arrived here through proper OTP verification
    if (!verified || !email) {
      toast.error("Please verify your email first");
      navigate("/reset-password");
    }
  }, [navigate]);

  const handleSubmit = async () => {
    let valid = true;

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      setPasswordError(passwordResult.error.errors[0].message);
      valid = false;
    } else {
      setPasswordError("");
    }

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      valid = false;
    } else {
      setConfirmError("");
    }

    if (!valid) return;

    setIsSubmitting(true);

    try {
      // Use admin API to update password for the user
      const { data, error } = await supabase.functions.invoke("update-user-password", {
        body: { email, password },
      });

      if (error) {
        console.error("Password update error:", error);
        toast.error("Failed to update password. Please try again.");
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        setSuccess(true);
        toast.success("Password updated successfully!");
      }
    } catch (err: any) {
      console.error("Update password error:", err);
      toast.error("Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthLayout showBack variant="white">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">Password Updated!</h1>
          <p className="text-muted-foreground mb-8">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          <AuthButton variant="primary" onClick={() => navigate("/auth")}>
            Sign In
          </AuthButton>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout variant="white">
      <div className="flex-1 flex flex-col">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-primary" />
        </div>

        <h1 className="text-3xl font-extrabold text-foreground mb-2">
          Create new password
        </h1>
        <p className="text-muted-foreground mb-8">
          Enter your new password below. Make sure it's at least 6 characters.
        </p>

        <div className="space-y-4 mb-8">
          <AuthInput
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
          />
          <AuthInput
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmError}
          />
        </div>

        <AuthButton
          variant="primary"
          onClick={handleSubmit}
          disabled={isSubmitting || !password || !confirmPassword}
        >
          {isSubmitting ? "Updating..." : "Update Password"}
        </AuthButton>
      </div>
    </AuthLayout>
  );
}
