import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function ModeratorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateInputs = () => {
    let valid = true;

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setEmailError(emailResult.error.errors[0].message);
      valid = false;
    } else {
      setEmailError("");
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      setPasswordError(passwordResult.error.errors[0].message);
      valid = false;
    } else {
      setPasswordError("");
    }

    return valid;
  };

  const handleSubmit = async () => {
    if (!validateInputs()) return;

    setIsSubmitting(true);

    try {
      // Sign in
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast.error(signInError.message);
        setIsSubmitting(false);
        return;
      }

      if (!authData.user) {
        toast.error("Login failed");
        setIsSubmitting(false);
        return;
      }

      // Check if user has admin or moderator role
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id);

      if (rolesError) {
        console.error("Error checking roles:", rolesError);
        await supabase.auth.signOut();
        toast.error("Failed to verify permissions");
        setIsSubmitting(false);
        return;
      }

      const hasAccess = roles?.some(r => r.role === "admin" || r.role === "moderator");

      if (!hasAccess) {
        await supabase.auth.signOut();
        toast.error("Access denied. Moderator or admin role required.");
        setIsSubmitting(false);
        return;
      }

      toast.success("Welcome to the Admin Panel!");
      
      // Redirect based on role
      const isAdmin = roles.some(r => r.role === "admin");
      if (isAdmin) {
        navigate("/admin/dashboard");
      } else {
        navigate("/agent-dashboard");
      }

    } catch (err) {
      toast.error("An error occurred");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl font-extrabold text-foreground mb-2 text-center">
          Staff Portal
        </h1>
        <p className="text-muted-foreground mb-8 text-center">
          Sign in to access the admin panel
        </p>

        <div className="w-full space-y-4 mb-8">
          <AuthInput
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          <div className="relative">
            <AuthInput
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <AuthButton
          variant="primary"
          onClick={handleSubmit}
          disabled={isSubmitting || !email || !password}
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </AuthButton>

        <div className="mt-8 p-4 bg-muted/50 rounded-xl">
          <p className="text-sm text-muted-foreground text-center">
            🔒 This portal is for authorized staff only. Unauthorized access attempts are logged and monitored.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
