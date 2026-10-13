import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, X, BadgeCheck, ChevronLeft, AlertCircle, Loader2, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { goBack } from "@/lib/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type Step = "loading" | "intro" | "camera" | "review" | "submitting" | "pending" | "verified" | "rejected";

const BUCKET = "isexy-photo-verifications";

/**
 * Photo verification: the member takes a selfie, it is stored privately
 * (isexy-photo-verifications/{userId}/...) with a pending request in
 * isexy.photo_verifications, and a moderator compares it with the profile
 * photos. The badge (profiles.is_verified) only appears once approved.
 */
// Members only, with a complete profile (the selfie is compared with profile photos).
// Guarded here rather than in App.tsx so the route table stays untouched.
export default function PhotoVerificationPage() {
  return (
    <ProtectedRoute>
      <PhotoVerification />
    </ProtectedRoute>
  );
}

function PhotoVerification() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState<Step>("loading");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Where the member stands: already verified, waiting for review, or rejected.
  useEffect(() => {
    if (!profile?.id) return;
    if (profile.is_verified) {
      setStep("verified");
      return;
    }
    let cancelled = false;
    supabase
      .from("photo_verifications")
      .select("status, rejection_reason")
      .eq("profile_id", profile.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("Photo verification status not loaded:", error.message);
        if (data?.status === "pending") setStep("pending");
        else if (data?.status === "rejected") {
          setRejectionReason(data.rejection_reason);
          setStep("rejected");
        } else setStep("intro");
      });
    return () => { cancelled = true; };
  }, [profile?.id, profile?.is_verified]);

  // The <video> only exists on the camera step: attach the stream once it is rendered.
  useEffect(() => {
    if (step === "camera" && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [step, stream]);

  // Never leave the camera on when the page closes.
  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  // Revoke the preview URL when it is replaced or the page closes.
  useEffect(() => () => { if (capturedImage) URL.revokeObjectURL(capturedImage); }, [capturedImage]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser can't open the camera. Try another browser or your phone.");
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);
      setStep("camera");
    } catch (error) {
      toast.error("Unable to access camera. Please grant permission.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Couldn't take the photo. Please try again.");
        return;
      }
      setCapturedBlob(blob);
      setCapturedImage(URL.createObjectURL(blob));
      stopCamera();
      setStep("review");
    }, "image/jpeg", 0.9);
  };

  const submitSelfie = async () => {
    if (!user || !profile || !capturedBlob) return;
    setStep("submitting");
    const path = `${user.id}/selfie-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, capturedBlob, { contentType: "image/jpeg" });
    if (uploadError) {
      console.error("Selfie upload failed:", uploadError);
      toast.error("Couldn't send your selfie. Please try again in a moment.");
      setStep("review");
      return;
    }
    const { error } = await supabase
      .from("photo_verifications")
      .insert({ profile_id: profile.id, selfie_path: path });
    if (error) {
      console.error("Verification request failed:", error);
      toast.error("Couldn't send your verification request. Please try again in a moment.");
      setStep("review");
      return;
    }
    toast.success("Selfie sent for review");
    setStep("pending");
  };

  const handleClose = () => {
    stopCamera();
    goBack(navigate, "/profile");
  };

  const retake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    startCamera();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={handleClose} className="p-2" aria-label={step === "intro" ? "Close" : "Go back"}>
          {step === "intro" ? <X className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
        </button>
        <h1 className="font-bold text-lg text-foreground">Photo Verification</h1>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto">
        {step === "loading" && <Loader2 className="w-10 h-10 text-primary animate-spin" />}

        {step === "intro" && (
          <>
            <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center mb-6">
              <BadgeCheck className="w-14 h-14 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              Get Photo Verified
            </h2>
            <p className="text-muted-foreground text-center mb-2">
              Show others you really look like your photos!
            </p>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Take a selfie facing the camera. Our team compares it with your profile photos, then adds the badge. Your selfie stays private.
            </p>

            {/* Pose example */}
            <div className="w-48 h-48 rounded-full border-4 border-dashed border-primary/30 flex items-center justify-center mb-8">
              <div className="text-center">
                <Camera className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Face the camera</p>
              </div>
            </div>

            <Button
              onClick={startCamera}
              className="w-full py-6 text-lg font-bold gradient-primary"
            >
              Continue
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full mt-3 py-6 text-lg font-bold"
            >
              Maybe Later
            </Button>
          </>
        )}

        {step === "camera" && (
          <>
            <div className="relative w-full max-w-sm aspect-square rounded-full overflow-hidden border-4 border-primary mb-6">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
              {/* Face guide overlay */}
              <div className="absolute inset-0 border-4 border-dashed border-white/50 rounded-full" />
            </div>
            <p className="text-center text-muted-foreground mb-6">
              Position your face in the circle and look at the camera
            </p>
            <Button
              onClick={capturePhoto}
              className="w-full py-6 text-lg font-bold gradient-primary"
            >
              Take Photo
            </Button>
          </>
        )}

        {(step === "review" || step === "submitting") && capturedImage && (
          <>
            <div className="w-full max-w-sm aspect-square rounded-full overflow-hidden border-4 border-primary mb-6">
              <img src={capturedImage} alt="Your selfie" className="w-full h-full object-cover -scale-x-100" />
            </div>
            <p className="text-center text-muted-foreground mb-6">
              Is your face clear and well lit?
            </p>
            <Button
              onClick={submitSelfie}
              disabled={step === "submitting"}
              className="w-full py-6 text-lg font-bold gradient-primary"
            >
              {step === "submitting" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send for review"}
            </Button>
            <Button
              variant="outline"
              onClick={retake}
              disabled={step === "submitting"}
              className="w-full mt-3 py-6 text-lg font-bold"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Retake
            </Button>
          </>
        )}

        {step === "pending" && (
          <>
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Clock className="w-14 h-14 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              Your selfie is being reviewed
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              We'll add the verified badge to your profile once our team has compared your selfie with your photos.
            </p>
            <Button
              onClick={() => navigate("/discover")}
              className="w-full py-6 text-lg font-bold gradient-primary"
            >
              Back to Discover
            </Button>
          </>
        )}

        {step === "verified" && (
          <>
            <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center mb-6">
              <BadgeCheck className="w-14 h-14 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              You're Verified! 🎉
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              Your profile has the verification badge that shows others you're the real deal.
            </p>
            <Button
              onClick={() => navigate("/discover")}
              className="w-full py-6 text-lg font-bold gradient-primary"
            >
              Start Swiping
            </Button>
          </>
        )}

        {step === "rejected" && (
          <>
            <div className="w-24 h-24 rounded-full bg-destructive flex items-center justify-center mb-6">
              <AlertCircle className="w-14 h-14 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              We couldn't verify you
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              {rejectionReason || "Your selfie didn't match your profile photos."} Please try again with better lighting.
            </p>
            <Button
              onClick={startCamera}
              className="w-full py-6 text-lg font-bold gradient-primary"
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full mt-3 py-6 text-lg font-bold"
            >
              Maybe Later
            </Button>
          </>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
