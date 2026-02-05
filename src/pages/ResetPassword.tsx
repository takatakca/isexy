import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email address");

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }
    setEmailError("");
    setIsSubmitting(true);

    try {
      // First check if user exists
      const { data: profiles } = await supabase
        .from("profiles")
        .select("first_name, user_id")
        .eq("user_id", email)
        .limit(1);

      const firstName = profiles?.[0]?.first_name || email.split("@")[0];

      // Send OTP via edge function
      const { error } = await supabase.functions.invoke("send-email-otp", {
        body: { 
          email, 
          type: "password_reset",
          firstName
        },
      });

      if (error) {
        console.error("OTP error:", error);
        toast.error("Failed to send reset code. Please try again.");
        setIsSubmitting(false);
        return;
      }

      toast.success("Verification code sent to your email!");
      navigate("/verify", { 
        state: { 
          email, 
          type: "password_reset"
        } 
      });
    } catch (err: any) {
      console.error("Reset error:", err);
      toast.error("Failed to send reset code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col">
        <button
          onClick={() => navigate("/auth")}
          className="flex items-center gap-2 text-muted-foreground mb-6 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </button>

        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Mail className="w-8 h-8 text-primary" />
        </div>

        <h1 className="text-3xl font-extrabold text-foreground mb-2">
          Reset your password
        </h1>
        <p className="text-muted-foreground mb-8">
          Enter your email address and we'll send you a 6-digit code to reset your password.
        </p>

        <div className="space-y-4 mb-8">
          <AuthInput
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
        </div>

        <AuthButton
          variant="primary"
          onClick={handleSubmit}
          disabled={isSubmitting || !email}
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Send Reset Code"
          )}
        </AuthButton>
      </div>
    </AuthLayout>
  );
}
