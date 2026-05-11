import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Video, VideoOff, Mic, MicOff, Phone,
  MessageCircle, X, Clock, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
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

type CallType = "video" | "phone";

export default function VideoCall() {
  const { matchId } = useParams<{ matchId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const callType: CallType = (searchParams.get("type") === "phone" ? "phone" : "video");
  const isPhone = callType === "phone";

  const [callStatus, setCallStatus] = useState<"connecting" | "ringing" | "connected" | "ended">("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [minutesUsed, setMinutesUsed] = useState(0);
  const [minutesRemaining, setMinutesRemaining] = useState(0);
  const [insufficientMinutes, setInsufficientMinutes] = useState(false);
  const [otherProfile, setOtherProfile] = useState<{ first_name: string; photo_url?: string; id: string } | null>(null);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [walletReady, setWalletReady] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minuteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchMinutes();
    fetchOtherProfile();
    return () => { endCall(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, profile?.id]);

  // Start call once we have both other profile + wallet check
  useEffect(() => {
    if (walletReady && otherProfile && callStatus === "connecting" && minutesRemaining > 0) {
      initializeCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletReady, otherProfile]);

  const fetchMinutes = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("user_credits")
      .select("phone_minutes, video_minutes")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!data) {
      await supabase.rpc("ensure_user_credits");
      setMinutesRemaining(0);
      setInsufficientMinutes(true);
    } else {
      const remaining = isPhone ? (data.phone_minutes ?? 0) : (data.video_minutes ?? 0);
      setMinutesRemaining(remaining);
      if (remaining <= 0) setInsufficientMinutes(true);
    }
    setWalletReady(true);
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
    if (!match) return;
    const other = (match.profile1 as any).id === profile.id ? match.profile2 : match.profile1;
    const { data: photos } = await supabase
      .from("profile_photos").select("photo_url")
      .eq("profile_id", (other as any).id).order("position").limit(1);
    setOtherProfile({
      id: (other as any).id,
      first_name: (other as any).first_name,
      photo_url: photos?.[0]?.photo_url,
    });
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
      .select().single();
    if (error) { console.error("session error", error); return null; }
    setCallSessionId(data.id);
    return data.id;
  };

  const deductMinute = useCallback(async () => {
    if (!profile?.id) return false;
    const { data, error } = await supabase.rpc("deduct_call_minute", {
      p_profile_id: profile.id,
      p_call_type: callType,
    });
    const res = data as { success?: boolean; remaining?: number; error?: string } | null;
    if (error || !res?.success) {
      toast.error("Out of minutes — call ending.");
      handleEndCall();
      return false;
    }
    setMinutesUsed(p => p + 1);
    setMinutesRemaining(res.remaining ?? 0);
    if ((res.remaining ?? 0) <= 2 && (res.remaining ?? 0) > 0) {
      toast.warning(`Only ${res.remaining} ${callType} minutes left!`);
    }
    return true;
  }, [profile?.id, callType]);

  const initializeCall = async () => {
    try {
      const sessionId = await createCallSession();

      if (sessionId && otherProfile) {
        try {
          await supabase.functions.invoke("send-whatsapp-call-notification", {
            body: {
              receiverId: otherProfile.id,
              callerId: profile?.id,
              callerName: profile?.first_name || "Someone",
              matchId,
              callSessionId: sessionId,
              callType,
            },
          });
        } catch (err) { console.error("WA notif", err); }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: !isPhone,
        audio: true,
      });
      localStreamRef.current = stream;
      if (!isPhone && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnectionRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      stream.getTracks().forEach(track => peerConnectionRef.current?.addTrack(track, stream));
      peerConnectionRef.current.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      setCallStatus("ringing");
      if (sessionId) {
        await supabase.from("video_call_sessions").update({ status: "ringing" }).eq("id", sessionId);
      }

      const answerTimeout = setTimeout(async () => {
        if (callStatus === "ringing") {
          if (sessionId && otherProfile) {
            try {
              await supabase.functions.invoke("send-missed-call-notification", {
                body: {
                  callerId: profile?.id,
                  receiverId: otherProfile.id,
                  matchId,
                  callerName: profile?.first_name || "Someone",
                  callType,
                },
              });
            } catch (err) { console.error("missed call", err); }
          }
          toast.error("Call not answered");
          handleEndCall();
        }
      }, 30000);

      setTimeout(async () => {
        clearTimeout(answerTimeout);
        setCallStatus("connected");
        if (sessionId) {
          await supabase.from("video_call_sessions").update({ status: "connected" }).eq("id", sessionId);
        }
        startTimer();
        startMinuteDeduction();
      }, 5000);
    } catch (error) {
      console.error("media error", error);
      toast.error(isPhone ? "Unable to access microphone" : "Unable to access camera/microphone");
      navigate(-1);
    }
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
  };

  const startMinuteDeduction = () => {
    deductMinute();
    minuteTimerRef.current = setInterval(() => { deductMinute(); }, 60000);
  };

  const endCall = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (minuteTimerRef.current) clearInterval(minuteTimerRef.current);
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    if (callSessionId) {
      await supabase.from("video_call_sessions").update({
        status: "ended",
        ended_at: new Date().toISOString(),
        duration_seconds: callDuration,
        credits_used: minutesUsed,
      }).eq("id", callSessionId);
    }
    setCallStatus("ended");
  };

  const handleEndCall = () => {
    endCall();
    navigate(`/chat/${matchId}`);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (isPhone || !localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    setIsVideoOff(!isVideoOff);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (insufficientMinutes) {
    return (
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              No {isPhone ? "Phone" : "Video"} Minutes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You need {isPhone ? "phone" : "video"} minutes to start this call.
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-foreground font-medium">
                  Your balance: {minutesRemaining} {isPhone ? "phone" : "video"} min
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => navigate(-1)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/buy-minutes")}>
              Buy Minutes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative">
      <div className="flex-1 relative">
        {!isPhone && callStatus === "connected" ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {otherProfile?.photo_url ? (
              <img src={otherProfile.photo_url} alt={otherProfile.first_name}
                className="w-32 h-32 rounded-full object-cover mb-6" />
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
            <p className="text-white/60">
              {callStatus === "connecting" ? "Connecting..." :
                callStatus === "ringing" ? "Ringing..." :
                callStatus === "connected" ? (isPhone ? "On call" : "Connected") :
                "Call ended"}
            </p>
            {isPhone && callStatus === "connected" && (
              <audio ref={remoteVideoRef as any} autoPlay playsInline className="hidden" />
            )}
          </div>
        )}

        {callStatus === "connected" && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="px-4 py-2 bg-black/50 rounded-full flex items-center gap-2">
              <Clock className="w-4 h-4 text-white" />
              <span className="text-white font-medium">{formatDuration(callDuration)}</span>
            </div>
            <div className="px-4 py-2 bg-amber-500/80 rounded-full flex items-center gap-2">
              <span className="text-white font-medium">{minutesRemaining} min</span>
            </div>
          </div>
        )}

        <button onClick={handleEndCall}
          className="absolute top-6 right-6 p-2 bg-black/50 rounded-full">
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {!isPhone && (
        <div className="absolute bottom-32 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white shadow-lg">
          {isVideoOff ? (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-muted-foreground" />
            </div>
          ) : (
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          )}
        </div>
      )}

      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-8">
        <button onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-white" : "bg-white/20"}`}>
          {isMuted ? <MicOff className="w-6 h-6 text-black" /> : <Mic className="w-6 h-6 text-white" />}
        </button>

        {!isPhone && (
          <button onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? "bg-white" : "bg-white/20"}`}>
            {isVideoOff ? <VideoOff className="w-6 h-6 text-black" /> : <Video className="w-6 h-6 text-white" />}
          </button>
        )}

        <button onClick={() => navigate(`/chat/${matchId}`)}
          className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-white" />
        </button>

        <button onClick={handleEndCall}
          className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
          <Phone className="w-6 h-6 text-white rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}
