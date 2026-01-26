import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  Video, VideoOff, Mic, MicOff, Phone, 
  RotateCcw, Maximize2, MessageCircle, X 
} from "lucide-react";
import { toast } from "sonner";

export default function VideoCall() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [callStatus, setCallStatus] = useState<"connecting" | "ringing" | "connected" | "ended">("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [otherProfile, setOtherProfile] = useState<{ first_name: string; photo_url?: string } | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!profile?.is_premium && profile?.subscription_tier !== "gold" && profile?.subscription_tier !== "platinum") {
      toast.error("Video calling requires a premium subscription");
      navigate(-1);
      return;
    }
    
    fetchOtherProfile();
    initializeCall();
    
    return () => {
      endCall();
    };
  }, [matchId, profile]);

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
        first_name: (other as any).first_name,
        photo_url: photos?.[0]?.photo_url,
      });
    }
  };

  const initializeCall = async () => {
    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Simulate connection (in real app, use WebRTC signaling)
      setTimeout(() => {
        setCallStatus("ringing");
        
        // Simulate answer after 3 seconds
        setTimeout(() => {
          setCallStatus("connected");
          startTimer();
        }, 3000);
      }, 1000);

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

  const endCall = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
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

        {/* Call duration */}
        {callStatus === "connected" && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full">
            <span className="text-white font-medium">{formatDuration(callDuration)}</span>
          </div>
        )}

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
