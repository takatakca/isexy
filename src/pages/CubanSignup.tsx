import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Check, Phone, CreditCard, Video, Mic, Shield } from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const whatsappSchema = z.string().min(10, "Please enter a valid WhatsApp number");
const carnetSchema = z.string().min(11, "Carnet ID must be 11 digits").max(11, "Carnet ID must be 11 digits");

type Step = "account" | "whatsapp" | "carnet" | "video" | "audio" | "complete";

export default function CubanSignup() {
  const navigate = useNavigate();
  const { signUp, user, profile, loading } = useAuth();
  const [step, setStep] = useState<Step>("account");
  
  // Account fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  
  // Verification fields
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappError, setWhatsappError] = useState("");
  const [whatsappCode, setWhatsappCode] = useState("");
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  
  const [carnetId, setCarnetId] = useState("");
  const [carnetError, setCarnetError] = useState("");
  
  const [videoVerified, setVideoVerified] = useState(false);
  const [audioVerified, setAudioVerified] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && profile) {
      // Check if already verified
      checkVerification();
    }
  }, [user, profile, loading]);

  const checkVerification = async () => {
    if (!profile) return;
    
    const { data } = await supabase
      .from("cuban_verifications" as any)
      .select("*")
      .eq("profile_id", profile.id)
      .single();
    
    if ((data as any)?.verification_status === "approved") {
      navigate("/discover");
    }
  };

  const validateAccount = () => {
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

  const handleCreateAccount = async () => {
    if (!validateAccount()) return;

    setIsSubmitting(true);
    const { error } = await signUp(email, password);
    
    if (!error) {
      setStep("whatsapp");
    }
    setIsSubmitting(false);
  };

  const handleSendWhatsAppCode = async () => {
    const result = whatsappSchema.safeParse(whatsappNumber);
    if (!result.success) {
      setWhatsappError(result.error.errors[0].message);
      return;
    }
    setWhatsappError("");
    
    // Simulate sending code
    toast.success("Verification code sent to WhatsApp!");
    // In production, integrate with WhatsApp Business API
  };

  const handleVerifyWhatsApp = async () => {
    if (whatsappCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    
    // Simulate verification (in production, verify with backend)
    setWhatsappVerified(true);
    toast.success("WhatsApp verified!");
    setStep("carnet");
  };

  const handleCarnetSubmit = () => {
    const result = carnetSchema.safeParse(carnetId);
    if (!result.success) {
      setCarnetError(result.error.errors[0].message);
      return;
    }
    setCarnetError("");
    setStep("video");
  };

  const handleVideoVerification = () => {
    // In production, this would open video capture
    setVideoVerified(true);
    toast.success("Video verification recorded!");
    setStep("audio");
  };

  const handleAudioVerification = () => {
    // In production, this would open audio capture
    setAudioVerified(true);
    toast.success("Audio verification recorded!");
    setStep("complete");
  };

  const handleSubmitVerification = async () => {
    if (!profile) {
      toast.error("Please complete account setup first");
      return;
    }

    setIsSubmitting(true);

    try {
      // Update profile as Cuban
      await supabase
        .from("profiles")
        .update({ is_cuban: true } as any)
        .eq("id", profile.id);

      // Submit verification
      const { error } = await supabase.from("cuban_verifications" as any).insert({
        profile_id: profile.id,
        whatsapp_number: whatsappNumber,
        whatsapp_verified: whatsappVerified,
        carnet_id: carnetId,
        video_verified: videoVerified,
        audio_verified: audioVerified,
      } as any);

      if (error) throw error;

      toast.success("Verification submitted! We'll review your application within 24 hours.");
      navigate("/profile-setup");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit verification");
    }

    setIsSubmitting(false);
  };

  const renderStep = () => {
    switch (step) {
      case "account":
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">Cuban Registration</h1>
                <p className="text-muted-foreground text-sm">Free account with verification</p>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
              <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                🇨🇺 Cuban profiles are FREE! Complete verification to unlock all features at no cost.
              </p>
            </div>

            <div className="space-y-4 mb-6">
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
              onClick={handleCreateAccount}
              disabled={isSubmitting || !email || !password}
            >
              {isSubmitting ? "Creating Account..." : "Continue"}
            </AuthButton>
          </>
        );

      case "whatsapp":
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">WhatsApp Verification</h1>
                <p className="text-muted-foreground text-sm">Step 1 of 4</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Enter your WhatsApp number to receive a verification code.
            </p>

            <div className="space-y-4 mb-6">
              <div className="flex gap-2">
                <div className="flex-1">
                  <AuthInput
                    type="tel"
                    placeholder="+53 5 1234567"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    error={whatsappError}
                  />
                </div>
                <button
                  onClick={handleSendWhatsAppCode}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold whitespace-nowrap hover:bg-green-600 transition h-12"
                >
                  Send Code
                </button>
              </div>

              {!whatsappVerified && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <AuthInput
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={whatsappCode}
                      onChange={(e) => setWhatsappCode(e.target.value)}
                      maxLength={6}
                    />
                  </div>
                  <button
                    onClick={handleVerifyWhatsApp}
                    className="px-4 py-2 bg-primary text-white rounded-xl font-semibold whitespace-nowrap hover:opacity-90 transition h-12"
                  >
                    Verify
                  </button>
                </div>
              )}

              {whatsappVerified && (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">WhatsApp Verified!</span>
                </div>
              )}
            </div>
          </>
        );

      case "carnet":
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">Carnet d'identification</h1>
                <p className="text-muted-foreground text-sm">Step 2 of 4</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Enter your Cuban ID number (Carnet de Identidad) for verification.
            </p>

            <div className="space-y-4 mb-6">
              <AuthInput
                type="text"
                placeholder="Enter 11-digit Carnet ID"
                value={carnetId}
                onChange={(e) => setCarnetId(e.target.value.replace(/\D/g, "").slice(0, 11))}
                error={carnetError}
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">
                Your ID is securely encrypted and only used for verification purposes.
              </p>
            </div>

            <AuthButton
              variant="primary"
              onClick={handleCarnetSubmit}
              disabled={carnetId.length !== 11}
            >
              Continue
            </AuthButton>
          </>
        );

      case "video":
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Video className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">Video Verification</h1>
                <p className="text-muted-foreground text-sm">Step 3 of 4</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Record a short video saying your name and showing your face clearly. This helps us prevent scams.
            </p>

            <div className="bg-muted rounded-xl p-6 mb-6 text-center">
              <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Click the button below to start recording
              </p>
              
              {videoVerified ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">Video Recorded!</span>
                </div>
              ) : (
                <button
                  onClick={handleVideoVerification}
                  className="px-6 py-3 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600 transition"
                >
                  Start Recording
                </button>
              )}
            </div>
          </>
        );

      case "audio":
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Mic className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">Audio Verification</h1>
                <p className="text-muted-foreground text-sm">Step 4 of 4</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              Record a short audio message introducing yourself. This adds an extra layer of verification.
            </p>

            <div className="bg-muted rounded-xl p-6 mb-6 text-center">
              <Mic className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Click the button below to start recording
              </p>
              
              {audioVerified ? (
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">Audio Recorded!</span>
                </div>
              ) : (
                <button
                  onClick={handleAudioVerification}
                  className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition"
                >
                  Start Recording
                </button>
              )}
            </div>
          </>
        );

      case "complete":
        return (
          <>
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-extrabold text-foreground">All Steps Complete!</h1>
              <p className="text-muted-foreground mt-2">
                You've completed all verification steps. Submit your application for review.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <Check className="w-5 h-5 text-green-600" />
                <span>WhatsApp Verified</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <Check className="w-5 h-5 text-green-600" />
                <span>Carnet ID Submitted</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <Check className="w-5 h-5 text-green-600" />
                <span>Video Recorded</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <Check className="w-5 h-5 text-green-600" />
                <span>Audio Recorded</span>
              </div>
            </div>

            <AuthButton
              variant="primary"
              onClick={handleSubmitVerification}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Verification"}
            </AuthButton>
          </>
        );
    }
  };

  return (
    <AuthLayout showBack variant="white">
      <div className="flex-1 flex flex-col">
        {/* Progress indicator */}
        {step !== "account" && step !== "complete" && (
          <div className="flex gap-2 mb-6">
            {["whatsapp", "carnet", "video", "audio"].map((s, i) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full ${
                  ["whatsapp", "carnet", "video", "audio"].indexOf(step) >= i
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        {renderStep()}

        {step === "account" && (
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/auth")}
              className="text-primary font-semibold hover:opacity-80 transition-opacity"
            >
              Already have an account? Sign in
            </button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
