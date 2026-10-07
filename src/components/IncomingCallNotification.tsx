import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

interface IncomingCall {
  id: string;
  matchId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  callType: "video" | "phone";
}

const RING_MS = 35_000;

/**
 * Full-screen incoming call sheet. Listens for new video_call_sessions rows
 * addressed to me (Realtime), rings, and opens VideoCall in answer mode.
 * State that callbacks read lives in refs so stopping the ringtone and
 * dismissing always act on the current call.
 */
export function IncomingCallNotification() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [incomingCall, setIncomingCallState] = useState<IncomingCall | null>(null);
  const callRef = useRef<IncomingCall | null>(null);
  const stopRingRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setIncomingCall = useCallback((call: IncomingCall | null) => {
    callRef.current = call;
    setIncomingCallState(call);
  }, []);

  const stopRingtone = useCallback(() => {
    stopRingRef.current?.();
    stopRingRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    navigator.vibrate?.(0);
  }, []);

  const dismiss = useCallback(() => {
    stopRingtone();
    setIncomingCall(null);
  }, [stopRingtone, setIncomingCall]);

  const playRingtone = useCallback(() => {
    stopRingtone();
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.value = 0;
      osc.start();
      let on = false;
      const pulse = setInterval(() => {
        on = !on;
        gain.gain.value = on ? 0.25 : 0;
      }, 500);
      stopRingRef.current = () => {
        clearInterval(pulse);
        try { osc.stop(); } catch { /* already stopped */ }
        ctx.close().catch(() => undefined);
      };
    } catch {
      /* autoplay blocked: the visual sheet still shows */
    }
    navigator.vibrate?.([400, 200, 400, 200, 400]);
  }, [stopRingtone]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`incoming-calls-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "video_call_sessions", filter: `receiver_id=eq.${profile.id}` },
        async (payload) => {
          const call = payload.new as { id: string; match_id: string; caller_id: string; status: string; call_type?: string };
          if (call.status !== "connecting" && call.status !== "ringing") return;
          if (callRef.current) return; // already ringing for another call

          const [{ data: caller }, { data: photos }] = await Promise.all([
            supabase.from("profiles").select("first_name").eq("id", call.caller_id).maybeSingle(),
            supabase.from("profile_photos").select("photo_url").eq("profile_id", call.caller_id).order("position").limit(1),
          ]);

          setIncomingCall({
            id: call.id,
            matchId: call.match_id,
            callerId: call.caller_id,
            callerName: caller?.first_name || "Someone",
            callerPhoto: photos?.[0]?.photo_url,
            callType: call.call_type === "phone" ? "phone" : "video",
          });
          playRingtone();
          timeoutRef.current = setTimeout(() => {
            if (callRef.current?.id === call.id) dismiss();
          }, RING_MS);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "video_call_sessions", filter: `receiver_id=eq.${profile.id}` },
        (payload) => {
          const call = payload.new as { id: string; status: string };
          // Caller hung up or the ring timed out.
          if (callRef.current?.id === call.id && ["ended", "missed", "declined", "cancelled"].includes(call.status)) {
            dismiss();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopRingtone();
    };
  }, [profile?.id, playRingtone, dismiss, stopRingtone, setIncomingCall]);

  const acceptCall = () => {
    const call = callRef.current;
    if (!call) return;
    dismiss();
    navigate(`/video-call/${call.matchId}?type=${call.callType}&answer=${call.id}`);
  };

  const declineCall = async () => {
    const call = callRef.current;
    if (!call) return;
    dismiss();
    // The caller's screen watches this row and shows "can't take your call".
    await supabase
      .from("video_call_sessions")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", call.id);
  };

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          role="alertdialog"
          aria-label={`Incoming ${incomingCall.callType} call from ${incomingCall.callerName}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            className="relative bg-card rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
          >
            <div className="relative mx-auto mb-6 w-32 h-32">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 rounded-full bg-primary/30" />
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} className="absolute inset-0 rounded-full bg-primary/20" />
              {incomingCall.callerPhoto ? (
                <img src={incomingCall.callerPhoto} alt="" className="relative w-32 h-32 rounded-full object-cover border-4 border-primary" />
              ) : (
                <div className="relative w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-primary">
                  <span className="text-4xl font-bold text-muted-foreground">{incomingCall.callerName[0]}</span>
                </div>
              )}
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">{incomingCall.callerName}</h2>
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-8">
              {incomingCall.callType === "phone" ? <Phone className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              <span>Incoming {incomingCall.callType === "phone" ? "voice" : "video"} call…</span>
            </div>

            <div className="flex items-center justify-center gap-6">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={declineCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg" aria-label="Decline">
                <PhoneOff className="w-7 h-7 text-white" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg" aria-label="Answer">
                <Phone className="w-7 h-7 text-white" />
              </motion.button>
            </div>

            <button onClick={dismiss} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
