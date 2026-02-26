import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user, profile, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (profile) {
        navigate("/discover");
      } else {
        navigate("/profile-setup");
      }
    }
  }, [user, profile, loading, navigate]);

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
    
    if (isLogin) {
      const { error } = await signIn(email, password);
      if (!error) {
        // Navigation handled by useEffect
      }
    } else {
      const { error } = await signUp(email, password);
      if (!error) {
        // Auto-confirm is enabled, user is signed in immediately
        // useEffect will handle navigation to profile-setup
      }
    }

    setIsSubmitting(false);
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col">
        <h1 className="text-3xl font-extrabold text-foreground mb-2">
          {isLogin ? "Welcome back!" : "Create account"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {isLogin
            ? "Sign in to continue finding connections"
            : "Join ISEXY and start meeting people"}
        </p>

        <div className="space-y-4 mb-8">
          <AuthInput
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          <AuthInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
          />
        </div>

        <AuthButton
          variant="primary"
          onClick={handleSubmit}
          disabled={isSubmitting || !email || !password}
        >
          {isSubmitting
            ? "Please wait..."
            : isLogin
            ? "Sign In"
            : "Create Account"}
        </AuthButton>

        <div className="mt-6 text-center space-y-3">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-semibold hover:opacity-80 transition-opacity block w-full"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
          {isLogin && (
            <button
              onClick={() => navigate("/reset-password")}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              Forgot your password?
            </button>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
