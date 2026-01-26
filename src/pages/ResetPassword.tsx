import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email address");

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async () => {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }
    setEmailError("");
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setEmailSent(true);
        toast.success("Password reset email sent!");
      }
    } catch (err: any) {
      toast.error("Failed to send reset email");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (emailSent) {
    return (
      <AuthLayout showBack variant="white">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">Check your email</h1>
          <p className="text-muted-foreground mb-8">
            We've sent a password reset link to <span className="font-semibold text-foreground">{email}</span>. 
            Click the link in the email to reset your password.
          </p>
          <AuthButton variant="primary" onClick={() => navigate("/auth")}>
            Back to Sign In
          </AuthButton>
          <button
            onClick={() => setEmailSent(false)}
            className="mt-4 text-sm text-primary font-semibold hover:opacity-80"
          >
            Didn't receive the email? Try again
          </button>
        </div>
      </AuthLayout>
    );
  }

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
          Enter your email address and we'll send you a link to reset your password.
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
          {isSubmitting ? "Sending..." : "Send Reset Link"}
        </AuthButton>
      </div>
    </AuthLayout>
  );
}
