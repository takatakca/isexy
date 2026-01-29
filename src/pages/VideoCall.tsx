import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  Video, VideoOff, Mic, MicOff, Phone, 
  RotateCcw, Maximize2, MessageCircle, X, Coins, AlertCircle 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CREDIT_COST_PER_MINUTE = 1;

export default function VideoCall() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [callStatus, setCallStatus] = useState<"connecting" | "ringing" | "connected" | "ended">("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [userCredits, setUserCredits] = useState(0);
  const [lowCreditsWarning, setLowCreditsWarning] = useState(false);
  const [otherProfile, setOtherProfile] = useState<{ first_name: string; photo_url?: string; id: string } | null>(null);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const creditTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchUserCredits();
    fetchOtherProfile();
    
    return () => {
      endCall();
    };
  }, [matchId, profile]);

  const fetchUserCredits = async () => {
    if (!profile?.id) return;

    const { data } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (data) {
      setUserCredits(data.credits);
      if (data.credits < 5) {
        setLowCreditsWarning(true);
      }
    } else {
      // Create credits record if doesn't exist
      await supabase.from("user_credits").insert({
        profile_id: profile.id,
        credits: 0,
      });
      setLowCreditsWarning(true);
    }
  };

  const fetchOtherProfile = async () => {
    if (!profile || !matchId) return;

    const { data: match } = await supabase
      .from("matches")
      .select(`
        profile1:profiles!matches_profile1_id_fkey(id, first_name),
        profile2:profiles!matches_profile2_id_fkey(id, first_name)
      `)
      .eq("id", matchId)
      .single();

    if (match) {
      const other = (match.profile1 as any).id === profile.id 
        ? match.profile2 
        : match.profile1;

      const { data: photos } = await supabase
        .from("profile_photos")
        .select("photo_url")
        .eq("profile_id", (other as any).id)
        .order("position")
        .limit(1);

      setOtherProfile({
        id: (other as any).id,
        first_name: (other as any).first_name,
        photo_url: photos?.[0]?.photo_url,
      });

      if (userCredits >= 1) {
        initializeCall();
      }
    }
  };

  const createCallSession = async () => {
    if (!profile?.id || !matchId || !otherProfile?.id) return null;

    const { data, error } = await supabase
      .from("video_call_sessions")
      .insert({
        match_id: matchId,
        caller_id: profile.id,
        receiver_id: otherProfile.id,
        status: "connecting",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create call session:", error);
      return null;
    }

    setCallSessionId(data.id);
    return data.id;
  };

  const deductCredit = useCallback(async () => {
    if (!profile?.id) return false;

    // Get current credits
    const { data: creditData } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("profile_id", profile.id)
      .single();

    if (!creditData || creditData.credits < CREDIT_COST_PER_MINUTE) {
      toast.error("Insufficient credits! Call ending.");
      handleEndCall();
      return false;
    }

    // Deduct credit
    const { error: updateError } = await supabase
      .from("user_credits")
      .update({ credits: creditData.credits - CREDIT_COST_PER_MINUTE })
      .eq("profile_id", profile.id);

    if (updateError) {
      console.error("Failed to deduct credit:", updateError);
      return false;
    }

    // Record transaction
    await supabase.from("credit_transactions").insert({
      profile_id: profile.id,
      type: "video_call",
      amount: -CREDIT_COST_PER_MINUTE,
      description: `Video call minute`,
      video_call_id: callSessionId,
    });

    setCreditsUsed(prev => prev + CREDIT_COST_PER_MINUTE);
    setUserCredits(prev => prev - CREDIT_COST_PER_MINUTE);

    // Warn at 3 credits remaining
    if (creditData.credits - CREDIT_COST_PER_MINUTE <= 3) {
      toast.warning(`Only ${creditData.credits - CREDIT_COST_PER_MINUTE} credits remaining!`);
    }

    return true;
  }, [profile?.id, callSessionId]);

  const initializeCall = async () => {
    try {
      // Create call session first
      const sessionId = await createCallSession();

      // Send WhatsApp notification to receiver (for Cuban users)
      if (sessionId && otherProfile) {
        try {
          await supabase.functions.invoke("send-whatsapp-call-notification", {
            body: {
              receiverId: otherProfile.id,
              callerId: profile?.id,
              callerName: profile?.first_name || "Someone",
              matchId: matchId,
              callSessionId: sessionId,
            },
          });
          console.log("WhatsApp call notification sent");
        } catch (err) {
          console.error("Failed to send WhatsApp notification:", err);
          // Continue with call anyway
        }
      }

      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize WebRTC peer connection
      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      };

      peerConnectionRef.current = new RTCPeerConnection(configuration);

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnectionRef.current?.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnectionRef.current.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          // In production, send candidate to signaling server
          console.log("ICE candidate:", event.candidate);
        }
      };

      // Update status to ringing
      setCallStatus("ringing");
      
      if (sessionId) {
        await supabase
          .from("video_call_sessions")
          .update({ status: "ringing" })
          .eq("id", sessionId);
      }

      // Wait for answer (in production, use signaling)
      // Set a timeout for unanswered calls
      const answerTimeout = setTimeout(async () => {
        if (callStatus === "ringing") {
          // Call was not answered - trigger missed call notification
          if (sessionId && otherProfile) {
            try {
              await supabase.functions.invoke("send-missed-call-notification", {
                body: {
                  callerId: profile?.id,
                  receiverId: otherProfile.id,
                  matchId: matchId,
                  callerName: profile?.first_name || "Someone",
                },
              });
              console.log("Missed call notification sent");
            } catch (err) {
              console.error("Failed to send missed call notification:", err);
            }
          }
          
          toast.error("Call not answered");
          handleEndCall();
        }
      }, 30000); // 30 seconds timeout

      // Simulate answer for demo (in production, wait for actual answer)
      setTimeout(async () => {
        clearTimeout(answerTimeout);
        setCallStatus("connected");
        
        if (callSessionId) {
          await supabase
            .from("video_call_sessions")
            .update({ status: "connected" })
            .eq("id", callSessionId);
        }

        startTimer();
        startCreditDeduction();
      }, 10000); // Wait 10 seconds for answer

    } catch (error) {
      console.error("Failed to get media stream:", error);
      toast.error("Unable to access camera or microphone");
      navigate(-1);
    }
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const startCreditDeduction = () => {
    // Deduct immediately for first minute
    deductCredit();

    // Then deduct every minute
    creditTimerRef.current = setInterval(() => {
      deductCredit();
    }, 60000); // Every minute
  };

  const endCall = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (creditTimerRef.current) {
      clearInterval(creditTimerRef.current);
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Update call session
    if (callSessionId) {
      await supabase
        .from("video_call_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          duration_seconds: callDuration,
          credits_used: creditsUsed,
        })
        .eq("id", callSessionId);
    }
    
    setCallStatus("ended");
  };

  const handleEndCall = () => {
    endCall();
    navigate(`/chat/${matchId}`);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Low credits warning dialog
  if (lowCreditsWarning && userCredits < 1) {
    return (
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              Insufficient Credits
            </AlertDialogTitle>
            <AlertDialogDescription>
              Video calls cost {CREDIT_COST_PER_MINUTE} credit per minute. You need at least 1 credit to start a call.
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-foreground font-medium">Your balance: {userCredits} credits</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => navigate(-1)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/buy-credits")}>
              Buy Credits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative">
      {/* Remote video (full screen) */}
      <div className="flex-1 relative">
        {callStatus === "connected" ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {otherProfile?.photo_url ? (
              <img
                src={otherProfile.photo_url}
                alt={otherProfile.first_name}
                className="w-32 h-32 rounded-full object-cover mb-6"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-6">
                <span className="text-4xl font-bold text-muted-foreground">
                  {otherProfile?.first_name?.[0] || "?"}
                </span>
              </div>
            )}
            <h2 className="text-2xl font-bold text-white mb-2">
              {otherProfile?.first_name || "Connecting..."}
            </h2>
            <p className="text-muted-foreground">
              {callStatus === "connecting" ? "Connecting..." : 
               callStatus === "ringing" ? "Ringing..." : 
               "Call ended"}
            </p>
          </div>
        )}

        {/* Credits & Duration display */}
        {callStatus === "connected" && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <div className="px-4 py-2 bg-black/50 rounded-full flex items-center gap-2">
              <span className="text-white font-medium">{formatDuration(callDuration)}</span>
            </div>
            <div className="px-4 py-2 bg-amber-500/80 rounded-full flex items-center gap-2">
              <Coins className="w-4 h-4 text-white" />
              <span className="text-white font-medium">{userCredits} credits</span>
            </div>
          </div>
        )}

        {/* Cost indicator */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 text-white/60 text-xs">
          ${CREDIT_COST_PER_MINUTE}/min
        </div>

        {/* Close button */}
        <button
          onClick={handleEndCall}
          className="absolute top-6 right-6 p-2 bg-black/50 rounded-full"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Local video (picture-in-picture) */}
      <div className="absolute bottom-32 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white shadow-lg">
        {isVideoOff ? (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <VideoOff className="w-8 h-8 text-muted-foreground" />
          </div>
        ) : (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-8">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? "bg-white" : "bg-white/20"
          }`}
        >
          {isMuted ? (
            <MicOff className="w-6 h-6 text-black" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}
        </button>

        <button
          onClick={toggleVideo}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isVideoOff ? "bg-white" : "bg-white/20"
          }`}
        >
          {isVideoOff ? (
            <VideoOff className="w-6 h-6 text-black" />
          ) : (
            <Video className="w-6 h-6 text-white" />
          )}
        </button>

        <button
          onClick={() => navigate(`/chat/${matchId}`)}
          className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>

        <button
          onClick={handleEndCall}
          className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center"
        >
          <Phone className="w-6 h-6 text-white rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}
