import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthButton } from "@/components/AuthButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function CodeVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useAuth();
  const email = location.state?.email || "";
  const type = location.state?.type || "verification";
  
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isComplete, setIsComplete] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    setIsComplete(code.every((digit) => digit !== ""));
  }, [code]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newCode = [...code];
    pastedData.split("").forEach((digit, i) => {
      if (i < 6) newCode[i] = digit;
    });
    setCode(newCode);
    inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
  };

  const handleResend = async () => {
    if (countdown > 0 || !email) return;
    setIsResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email-otp", {
        body: { email, type },
      });
      if (error) throw error;
      toast.success("New code sent!");
      setCountdown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      toast.error("Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async () => {
    if (!isComplete) return;
    const enteredCode = code.join("");
    setIsVerifying(true);

    try {
      // Verify OTP using database function
      const { data: verifyResult, error: verifyError } = await supabase.rpc("verify_otp", {
        p_email: email,
        p_code: enteredCode,
        p_type: type,
      });
      
      if (verifyError) {
        console.error("Verify error:", verifyError);
        throw new Error("Verification failed");
      }
      
      const result = verifyResult as { valid: boolean; error?: string };
      
      if (!result.valid) {
        toast.error(result.error || "Invalid code. Please try again.");
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setIsVerifying(false);
        return;
      }

      toast.success("Email verified successfully!");
      
      if (type === "password_reset") {
        navigate("/update-password", { state: { email, verified: true } });
      } else if (type === "verification") {
        // Complete signup
        const pending = sessionStorage.getItem("pending_signup");
        if (pending) {
          const { email: signupEmail, password } = JSON.parse(pending);
          await signUp(signupEmail, password);
          sessionStorage.removeItem("pending_signup");
        }
        navigate("/profile-setup");
      } else {
        navigate("/house-rules");
      }
    } catch {
      toast.error("Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const getTitle = () => {
    switch (type) {
      case "password_reset": return "Reset Password";
      case "login": return "Login Verification";
      default: return "Verify Your Email";
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col">
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-extrabold text-foreground">{getTitle()}</h1>
          <p className="text-muted-foreground font-medium">Enter the 6-digit code sent to</p>
          <p className="text-foreground font-semibold">{email || "your email"}</p>
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isVerifying}
              className={`w-12 h-16 text-center text-2xl font-bold border-b-2 bg-transparent outline-none transition-all ${
                digit ? "border-primary text-foreground" : "border-muted text-muted-foreground"
              } focus:border-primary disabled:opacity-50`}
            />
          ))}
        </div>

        <p className="text-muted-foreground text-sm mb-8">
          Didn't get the code?{" "}
          {countdown > 0 ? (
            <span>Resend in {countdown}s</span>
          ) : (
            <button onClick={handleResend} disabled={isResending} className="text-primary font-semibold hover:opacity-80 disabled:opacity-50">
              {isResending ? "Sending..." : "Resend"}
            </button>
          )}
        </p>

        <AuthButton variant={isComplete ? "primary" : "secondary"} onClick={handleSubmit} disabled={!isComplete || isVerifying}>
          {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify"}
        </AuthButton>
      </div>
    </AuthLayout>
  );
}
