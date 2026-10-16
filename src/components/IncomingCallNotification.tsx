import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { declineCall } from "@/lib/callSessions";
import { motion, AnimatePresence } from "framer-motion";

interface IncomingCall {
  id: string;
  matchId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  callType: "video" | "phone";
}

interface SessionRow {
  id: string;
  match_id: string;
  caller_id: string;
  status: string;
  call_type?: string | null;
  created_at?: string;
}

const RING_MS = 35_000;
/** Routes where I'm already in a call: a second call rings out (missed call). */
const IN_CALL = /^\/(video-call|phone-line\/call)\//;

/**
 * Full-screen incoming call sheet. Listens for new video_call_sessions rows
 * addressed to me (Realtime) and, when the app opens or comes back to the
 * foreground (e.g. from the incoming-call push), looks for a call that is
 * already ringing. Answer opens VideoCall in answer mode; Decline goes through
 * the decline_call RPC. State that callbacks read lives in refs so stopping
 * the ringtone and dismissing always act on the current call.
 */
export function IncomingCallNotification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [incomingCall, setIncomingCallState] = useState<IncomingCall | null>(null);
  const callRef = useRef<IncomingCall | null>(null);
  const stopRingRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const handledRef = useRef(new Set<string>());

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

  /** `catchUp`: found by query, maybe rung for a while (device clocks may differ: clamp). */
  const ring = useCallback(async (row: SessionRow, catchUp = false) => {
    if (row.status !== "ringing" && row.status !== "connecting") return;
    if (callRef.current || handledRef.current.has(row.id)) return; // already ringing / handled
    if (IN_CALL.test(pathRef.current)) return; // busy: let it ring out
    const age = catchUp && row.created_at ? Date.now() - new Date(row.created_at).getTime() : 0;
    const left = Math.min(RING_MS, Math.max(8_000, RING_MS - age));
    handledRef.current.add(row.id);

    const [{ data: caller }, { data: photos }] = await Promise.all([
      supabase.from("profiles").select("first_name").eq("id", row.caller_id).maybeSingle(),
      supabase.from("profile_photos").select("photo_url").eq("profile_id", row.caller_id).order("position").limit(1),
    ]);
    if (callRef.current) return;

    setIncomingCall({
      id: row.id,
      matchId: row.match_id,
      callerId: row.caller_id,
      callerName: caller?.first_name || "Someone",
      callerPhoto: photos?.[0]?.photo_url,
      callType: row.call_type === "phone" ? "phone" : "video",
    });
    playRingtone();
    timeoutRef.current = setTimeout(() => {
      if (callRef.current?.id === row.id) dismiss();
    }, left);
  }, [playRingtone, dismiss, setIncomingCall]);

  useEffect(() => {
    if (!profile?.id) return;
    const me = profile.id;

    /** A call that started ringing before this page was open (push, background tab). */
    const catchUp = async () => {
      if (document.visibilityState === "hidden" || callRef.current) return;
      // Wider than the ring time: device clocks are not exact. Calls that rang
      // out are already 'missed' on the server.
      const since = new Date(Date.now() - 90_000).toISOString();
      const { data } = await supabase
        .from("video_call_sessions")
        .select("id, match_id, caller_id, status, call_type, created_at")
        .eq("receiver_id", me)
        .eq("status", "ringing")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = data?.[0] as SessionRow | undefined;
      if (row) void ring(row, true);
    };

    const channel = supabase
      .channel(`incoming-calls-${me}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "isexy", table: "video_call_sessions", filter: `receiver_id=eq.${me}` },
        (payload) => { void ring(payload.new as SessionRow); },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "isexy", table: "video_call_sessions", filter: `receiver_id=eq.${me}` },
        (payload) => {
          const call = payload.new as { id: string; status: string };
          // Caller hung up, the ring timed out, or I answered/declined on another device.
          if (callRef.current?.id === call.id && call.status !== "ringing") dismiss();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void catchUp();
      });

    const onVisible = () => { if (document.visibilityState === "visible") void catchUp(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
      stopRingtone();
    };
  }, [profile?.id, ring, dismiss, stopRingtone]);

  const acceptCall = () => {
    const call = callRef.current;
    if (!call) return;
    dismiss();
    navigate(`/video-call/${call.matchId}?type=${call.callType}&answer=${call.id}`);
  };

  const declineIncoming = async () => {
    const call = callRef.current;
    if (!call) return;
    dismiss();
    // The caller's screen watches this row and shows "can't take your call".
    await declineCall(call.id);
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

            <div className="flex items-center justify-center gap-10">
              <div className="flex flex-col items-center gap-2">
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={declineIncoming}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg" aria-label="Decline">
                  <PhoneOff className="w-7 h-7 text-destructive-foreground" />
                </motion.button>
                <span className="text-xs text-muted-foreground">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={acceptCall}
                  className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg" aria-label="Answer">
                  {incomingCall.callType === "phone" ? <Phone className="w-7 h-7 text-primary-foreground" /> : <Video className="w-7 h-7 text-primary-foreground" />}
                </motion.button>
                <span className="text-xs text-muted-foreground">Answer</span>
              </div>
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
