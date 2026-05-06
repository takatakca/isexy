import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { AuthInput } from "@/components/AuthInput";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Check, Phone, CreditCard, Video, Mic, Shield, Upload, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const whatsappSchema = z.string().min(10, "Please enter a valid WhatsApp number");
const carnetSchema = z.string().min(11, "Carnet ID must be 11 digits").max(11, "Carnet ID must be 11 digits");

type Step = "account" | "whatsapp" | "carnet" | "video" | "audio" | "complete";

export default function CubanSignup() {
  const navigate = useNavigate();
  const { signUp, user, profile, loading, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>("account");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappError, setWhatsappError] = useState("");
  const [whatsappCode, setWhatsappCode] = useState("");
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  
  const [carnetId, setCarnetId] = useState("");
  const [carnetError, setCarnetError] = useState("");
  const [carnetFront, setCarnetFront] = useState<File | null>(null);
  const [carnetBack, setCarnetBack] = useState<File | null>(null);
  const [carnetFrontPreview, setCarnetFrontPreview] = useState<string | null>(null);
  const [carnetBackPreview, setCarnetBackPreview] = useState<string | null>(null);
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // If user is already logged in, skip to whatsapp step
  useEffect(() => {
    if (!loading && user && step === "account") {
      setStep("whatsapp");
    }
  }, [user, loading]);

  const validateAccount = () => {
    let valid = true;
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setEmailError(emailResult.error.errors[0].message);
      valid = false;
    } else setEmailError("");

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      setPasswordError(passwordResult.error.errors[0].message);
      valid = false;
    } else setPasswordError("");

    return valid;
  };

  const handleCreateAccount = async () => {
    if (!validateAccount()) return;
    setIsSubmitting(true);
    
    const { error } = await signUp(email, password);
    if (!error) {
      // Auto-confirm is on, user is signed in immediately
      // Wait a moment for the auth state to update
      setTimeout(() => {
        setStep("whatsapp");
      }, 1000);
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
    setSendingCode(true);
    
    try {
      const response = await supabase.functions.invoke("send-whatsapp-otp", {
        body: { phoneNumber: whatsappNumber, action: "send" }
      });
      if (response.error) throw response.error;
      const data = response.data;
      if (data?.success) {
        toast.success("Verification code sent to WhatsApp!");
      } else {
        toast.error("Could not send verification code. Please try again.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send code. You can skip this step.");
    }
    setSendingCode(false);
  };

  const handleVerifyWhatsApp = async () => {
    if (whatsappCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    try {
      const response = await supabase.functions.invoke("send-whatsapp-otp", {
        body: { phoneNumber: whatsappNumber, action: "verify", code: whatsappCode }
      });
      if (response.error) throw response.error;
      if (response.data?.verified) {
        setWhatsappVerified(true);
        toast.success("WhatsApp verified!");
        setStep("carnet");
      } else {
        toast.error(response.data?.error || "Verification failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Verification failed");
    }
  };

  // Allow skipping WhatsApp if it fails (edge function may not be deployed)
  const handleSkipWhatsApp = () => {
    setWhatsappVerified(false);
    setStep("carnet");
  };

  const handleImageUpload = (type: 'front' | 'back') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const preview = URL.createObjectURL(file);
    if (type === 'front') {
      setCarnetFront(file);
      setCarnetFrontPreview(preview);
    } else {
      setCarnetBack(file);
      setCarnetBackPreview(preview);
    }
  };

  const handleCarnetSubmit = () => {
    const result = carnetSchema.safeParse(carnetId);
    if (!result.success) {
      setCarnetError(result.error.errors[0].message);
      return;
    }
    if (!carnetFront || !carnetBack) {
      toast.error("Please upload both front and back of your Carnet");
      return;
    }
    setCarnetError("");
    setStep("video");
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], 'verification-video.webm', { type: 'video/webm' });
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecordingVideo(true);
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecordingVideo(false);
        }
      }, 15000);
    } catch (error: any) {
      toast.error("Could not access camera: " + error.message);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
    }
  };

  const handleVideoNext = () => {
    if (!videoFile) {
      toast.error("Please record a video first");
      return;
    }
    setStep("audio");
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'verification-audio.webm', { type: 'audio/webm' });
        setAudioFile(file);
        setAudioPreview(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecordingAudio(true);
      setTimeout(() => {
        if (audioRecorderRef.current?.state === 'recording') {
          audioRecorderRef.current.stop();
          setIsRecordingAudio(false);
        }
      }, 30000);
    } catch (error: any) {
      toast.error("Could not access microphone: " + error.message);
    }
  };

  const stopAudioRecording = () => {
    if (audioRecorderRef.current?.state === 'recording') {
      audioRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  const handleAudioNext = () => {
    if (!audioFile) {
      toast.error("Please record an audio first");
      return;
    }
    setStep("complete");
  };

  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('cuban-verifications')
        .upload(path, file, { upsert: true });
      if (error) {
        console.error('Upload error:', error);
        toast.error(`Upload failed: ${error.message}`);
        return null;
      }
      // Return the storage path (bucket is private, so no public URL)
      return path;
    } catch (err: any) {
      console.error('Upload exception:', err);
      toast.error(`Upload failed: ${err.message}`);
      return null;
    }
  };

  const handleSubmitVerification = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    // Refresh profile if not available yet
    if (!profile) {
      await refreshProfile();
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const userId = user.id;

      // First ensure we have a profile - create one if needed
      let currentProfile = profile;
      if (!currentProfile) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {
          // Create a minimal profile
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              user_id: userId,
              first_name: email.split("@")[0],
              birth_date: "2000-01-01",
              gender: "other",
              country: "CU",
              is_cuban: true as any,
            } as any)
            .select()
            .single();
          
          if (createError) throw createError;
          currentProfile = newProfile as any;
          await refreshProfile();
        } else {
          currentProfile = profileData as any;
        }
      }

      if (!currentProfile) throw new Error("Could not create profile");

      const profileId = (currentProfile as any).id;
      let carnetFrontUrl = null;
      let carnetBackUrl = null;
      let videoUrl = null;
      let audioUrl = null;

      if (carnetFront) {
        setUploadProgress(10);
        carnetFrontUrl = await uploadFile(carnetFront, `${userId}/carnet-front.jpg`);
      }
      if (carnetBack) {
        setUploadProgress(30);
        carnetBackUrl = await uploadFile(carnetBack, `${userId}/carnet-back.jpg`);
      }
      if (videoFile) {
        setUploadProgress(50);
        videoUrl = await uploadFile(videoFile, `${userId}/verification-video.webm`);
      }
      if (audioFile) {
        setUploadProgress(70);
        audioUrl = await uploadFile(audioFile, `${userId}/verification-audio.webm`);
      }

      setUploadProgress(85);

      // Update profile as Cuban
      await supabase
        .from("profiles")
        .update({ is_cuban: true } as any)
        .eq("id", profileId);

      // Submit verification
      const { error } = await supabase.from("cuban_verifications" as any).insert({
        profile_id: profileId,
        whatsapp_number: whatsappNumber || "not-provided",
        whatsapp_verified: whatsappVerified,
        carnet_id: carnetId,
        carnet_front_url: carnetFrontUrl,
        carnet_back_url: carnetBackUrl,
        video_url: videoUrl,
        video_verified: !!videoFile,
        audio_url: audioUrl,
        audio_verified: !!audioFile,
      } as any);

      if (error) throw error;

      setUploadProgress(100);
      toast.success("Verification submitted! We'll review your application within 24 hours.");
      navigate("/profile-setup");
    } catch (error: any) {
      console.error("Submission error:", error);
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
                  disabled={sendingCode}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold whitespace-nowrap hover:bg-green-600 transition h-12 disabled:opacity-50"
                >
                  {sendingCode ? "Sending..." : "Send Code"}
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

            {!whatsappVerified && (
              <button
                onClick={handleSkipWhatsApp}
                className="w-full text-center text-muted-foreground text-sm hover:text-foreground transition-colors mb-4"
              >
                Skip for now →
              </button>
            )}

            {whatsappVerified && (
              <AuthButton variant="primary" onClick={() => setStep("carnet")}>
                Continue
              </AuthButton>
            )}
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
              Enter your Cuban ID number and upload photos of your Carnet (front and back).
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

              <div>
                <label className="block text-sm font-medium mb-2">Front of Carnet</label>
                <div className="relative">
                  {carnetFrontPreview ? (
                    <div className="relative rounded-xl overflow-hidden">
                      <img src={carnetFrontPreview} alt="Carnet front" className="w-full h-40 object-cover" />
                      <button
                        onClick={() => { setCarnetFront(null); setCarnetFrontPreview(null); }}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-xl cursor-pointer hover:bg-muted/50 transition">
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Upload front photo</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload('front')} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Back of Carnet</label>
                <div className="relative">
                  {carnetBackPreview ? (
                    <div className="relative rounded-xl overflow-hidden">
                      <img src={carnetBackPreview} alt="Carnet back" className="w-full h-40 object-cover" />
                      <button
                        onClick={() => { setCarnetBack(null); setCarnetBackPreview(null); }}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-xl cursor-pointer hover:bg-muted/50 transition">
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Upload back photo</span>
                      <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload('back')} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Your ID is securely encrypted and only used for verification purposes.
              </p>
            </div>

            <AuthButton
              variant="primary"
              onClick={handleCarnetSubmit}
              disabled={carnetId.length !== 11 || !carnetFront || !carnetBack}
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
              Record a short video (max 15 seconds) saying your name and showing your face clearly.
            </p>

            <div className="bg-muted rounded-xl p-4 mb-6">
              {videoPreview ? (
                <div className="relative">
                  <video src={videoPreview} controls className="w-full rounded-lg" />
                  <button
                    onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : isRecordingVideo ? (
                <div className="space-y-4">
                  <video ref={videoRef} muted className="w-full rounded-lg" />
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-500 font-medium">Recording...</span>
                  </div>
                  <Button onClick={stopVideoRecording} variant="destructive" className="w-full">
                    Stop Recording
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <Button onClick={startVideoRecording} className="bg-purple-500 hover:bg-purple-600">
                    <Video className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                </div>
              )}
            </div>

            <AuthButton variant="primary" onClick={handleVideoNext} disabled={!videoFile}>
              Continue
            </AuthButton>
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
              Record a short audio message (max 30 seconds) introducing yourself.
            </p>

            <div className="bg-muted rounded-xl p-4 mb-6">
              {audioPreview ? (
                <div className="relative">
                  <audio src={audioPreview} controls className="w-full" />
                  <button
                    onClick={() => { setAudioFile(null); setAudioPreview(null); }}
                    className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : isRecordingAudio ? (
                <div className="space-y-4 text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-500 font-medium">Recording...</span>
                  </div>
                  <Button onClick={stopAudioRecording} variant="destructive">
                    Stop Recording
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Mic className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <Button onClick={startAudioRecording} className="bg-orange-500 hover:bg-orange-600">
                    <Mic className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                </div>
              )}
            </div>

            <AuthButton variant="primary" onClick={handleAudioNext} disabled={!audioFile}>
              Continue
            </AuthButton>
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
                <span>{whatsappVerified ? "WhatsApp Verified" : "WhatsApp Skipped"}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <Check className="w-5 h-5 text-green-600" />
                <span>Carnet ID Uploaded (Front & Back)</span>
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

            {isSubmitting && (
              <div className="mb-4">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Uploading files... {uploadProgress}%
                </p>
              </div>
            )}

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
