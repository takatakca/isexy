import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

interface IncomingCall {
  id: string;
  matchId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
}

export function IncomingCallNotification() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [ringtoneAudio, setRingtoneAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!profile?.id) return;

    // Subscribe to incoming video calls
    const channel = supabase
      .channel(`incoming-calls-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "video_call_sessions",
          filter: `receiver_id=eq.${profile.id}`,
        },
        async (payload) => {
          const call = payload.new as any;
          
          if (call.status === "connecting" || call.status === "ringing") {
            // Fetch caller info
            const { data: callerData } = await supabase
              .from("profiles")
              .select("first_name")
              .eq("id", call.caller_id)
              .single();

            const { data: photos } = await supabase
              .from("profile_photos")
              .select("photo_url")
              .eq("profile_id", call.caller_id)
              .order("position")
              .limit(1);

            setIncomingCall({
              id: call.id,
              matchId: call.match_id,
              callerId: call.caller_id,
              callerName: callerData?.first_name || "Someone",
              callerPhoto: photos?.[0]?.photo_url,
            });

            // Play ringtone
            playRingtone();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "video_call_sessions",
          filter: `receiver_id=eq.${profile.id}`,
        },
        (payload) => {
          const call = payload.new as any;
          
          // If call ended or was cancelled, dismiss notification
          if (call.status === "ended" || call.status === "cancelled") {
            dismissCall();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopRingtone();
    };
  }, [profile?.id]);

  const playRingtone = useCallback(() => {
    // Create a simple oscillator-based ringtone
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = "sine";
      oscillator.frequency.value = 440;
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      
      // Create pulsing effect
      const pulseInterval = setInterval(() => {
        gainNode.gain.value = gainNode.gain.value === 0.3 ? 0 : 0.3;
      }, 500);

      // Store cleanup
      const cleanup = () => {
        clearInterval(pulseInterval);
        oscillator.stop();
        audioContext.close();
      };

      // Auto stop after 30 seconds
      setTimeout(cleanup, 30000);
      
      setRingtoneAudio({ pause: cleanup, currentTime: 0 } as any);
    } catch (error) {
      console.error("Failed to play ringtone:", error);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneAudio) {
      (ringtoneAudio as any).pause?.();
      setRingtoneAudio(null);
    }
  }, [ringtoneAudio]);

  const acceptCall = async () => {
    if (!incomingCall) return;

    stopRingtone();
    
    // Update call status
    await supabase
      .from("video_call_sessions")
      .update({ status: "connected" })
      .eq("id", incomingCall.id);

    // Navigate to video call
    navigate(`/video-call/${incomingCall.matchId}`);
    setIncomingCall(null);
  };

  const declineCall = async () => {
    if (!incomingCall) return;

    stopRingtone();
    
    // Update call status
    await supabase
      .from("video_call_sessions")
      .update({ 
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", incomingCall.id);

    setIncomingCall(null);
  };

  const dismissCall = () => {
    stopRingtone();
    setIncomingCall(null);
  };

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            className="bg-card rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
          >
            {/* Caller Photo with pulsing ring */}
            <div className="relative mx-auto mb-6 w-32 h-32">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-primary/30"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                className="absolute inset-0 rounded-full bg-primary/20"
              />
              {incomingCall.callerPhoto ? (
                <img
                  src={incomingCall.callerPhoto}
                  alt={incomingCall.callerName}
                  className="relative w-32 h-32 rounded-full object-cover border-4 border-primary"
                />
              ) : (
                <div className="relative w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-primary">
                  <span className="text-4xl font-bold text-muted-foreground">
                    {incomingCall.callerName[0]}
                  </span>
                </div>
              )}
            </div>

            {/* Caller Info */}
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {incomingCall.callerName}
            </h2>
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-8">
              <Video className="w-5 h-5" />
              <span>Incoming video call...</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-6">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={declineCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg"
              >
                <Phone className="w-7 h-7 text-white" />
              </motion.button>
            </div>

            {/* Dismiss button */}
            <button
              onClick={dismissCall}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
