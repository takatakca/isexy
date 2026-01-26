import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, X, BadgeCheck, ChevronLeft, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Step = "intro" | "camera" | "comparing" | "success" | "failed";

export default function PhotoVerification() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("intro");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStep("camera");
    } catch (error) {
      toast.error("Unable to access camera. Please grant permission.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg");
        setCapturedImage(imageData);
        stopCamera();
        setStep("comparing");
        
        // Simulate verification process
        setTimeout(() => {
          // In a real app, this would call an AI API to compare faces
          const isMatch = Math.random() > 0.3; // 70% success for demo
          setStep(isMatch ? "success" : "failed");
        }, 3000);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleClose = () => {
    stopCamera();
    navigate(-1);
  };

  const retryVerification = () => {
    setCapturedImage(null);
    setStep("intro");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={handleClose} className="p-2">
          {step === "intro" ? <X className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
        </button>
        <h1 className="font-bold text-lg text-foreground">Photo Verification</h1>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {step === "intro" && (
          <>
            <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center mb-6">
              <BadgeCheck className="w-14 h-14 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              Get Photo Verified
            </h2>
            <p className="text-muted-foreground text-center mb-2">
              Show others you really look like your photos!
            </p>
            <p className="text-sm text-muted-foreground text-center mb-8">
              Take a selfie matching the pose shown. We'll compare it to your profile photos using AI.
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
                className="w-full h-full object-cover"
              />
              {/* Face guide overlay */}
              <div className="absolute inset-0 border-4 border-dashed border-white/50 rounded-full" />
            </div>
            <canvas ref={canvasRef} className="hidden" />
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

        {step === "comparing" && (
          <>
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
            <h2 className="text-xl font-bold text-foreground mb-2">
              Comparing your photos...
            </h2>
            <p className="text-muted-foreground text-center">
              This will only take a moment
            </p>
          </>
        )}

        {step === "success" && (
          <>
            <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mb-6">
              <BadgeCheck className="w-14 h-14 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              You're Verified! 🎉
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              Your profile now has a blue verification badge that shows others you're the real deal.
            </p>
            <Button
              onClick={() => navigate("/discover")}
              className="w-full py-6 text-lg font-bold gradient-primary"
            >
              Start Swiping
            </Button>
          </>
        )}

        {step === "failed" && (
          <>
            <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center mb-6">
              <AlertCircle className="w-14 h-14 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              We couldn't verify you
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              The photo didn't match your profile photos. Please try again with better lighting.
            </p>
            <Button
              onClick={retryVerification}
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
      </div>
    </div>
  );
}
