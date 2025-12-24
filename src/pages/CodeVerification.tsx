import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthButton } from "@/components/AuthButton";

export default function CodeVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const phone = location.state?.phone || "+15144584587";
  
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isComplete, setIsComplete] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    setIsComplete(code.every((digit) => digit !== ""));
  }, [code]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-focus next input
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

  const handleSubmit = () => {
    if (isComplete) {
      navigate("/house-rules");
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-extrabold text-foreground">
            Enter your code
          </h1>
          <p className="text-muted-foreground font-medium">
            {phone}
          </p>
        </div>

        {/* Code inputs */}
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
              className={`w-12 h-16 text-center text-2xl font-bold border-b-2 bg-transparent outline-none transition-all ${
                digit
                  ? "border-primary text-foreground"
                  : "border-muted text-muted-foreground"
              } focus:border-primary`}
            />
          ))}
        </div>

        {/* Resend text */}
        <p className="text-muted-foreground text-sm mb-8">
          Didn't get anything? No worries, let's try again.{" "}
          <button className="text-primary font-semibold hover:opacity-80 transition-opacity">
            Resend
          </button>
        </p>

        {/* Submit button */}
        <AuthButton
          variant={isComplete ? "primary" : "secondary"}
          onClick={handleSubmit}
          disabled={!isComplete}
        >
          Next
        </AuthButton>
      </div>
    </AuthLayout>
  );
}
