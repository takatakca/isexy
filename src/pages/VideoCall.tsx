import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Video, VideoOff, Mic, MicOff, Phone, MessageCircle, X, Clock, AlertCircle, WifiOff } from "lucide-react";
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
import { useCallConnection, type CallRole } from "@/hooks/useCallConnection";

type CallType = "video" | "phone";
type CallStatus = "preparing" | "ringing" | "connecting" | "connected" | "reconnecting" | "ended";

const RING_TIMEOUT_MS = 35_000;

/**
 * One screen for both sides of a call.
 *   Caller: /video-call/:matchId?type=video|phone
 *   Callee: /video-call/:matchId?type=…&answer=<sessionId>  (from IncomingCallNotification)
 * Only the caller pays, and only once the call is actually connected.
 */
export default function VideoCall() {
  const { matchId = "" } = useParams<{ matchId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const answerSessionId = searchParams.get("answer");
  const role: CallRole = answerSessionId ? "callee" : "caller";
  const callType: CallType = searchParams.get("type") === "phone" ? "phone" : "video";
  const isPhone = callType === "phone";

  const [status, setStatusState] = useState<CallStatus>("preparing");
  const statusRef = useRef<CallStatus>("preparing");
  const setStatus = useCallback((next: CallStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [minutesRemaining, setMinutesRemaining] = useState(0);
  const [insufficientMinutes, setInsufficientMinutes] = useState(false);
  const [walletReady, setWalletReady] = useState(role === "callee");
  const [otherProfile, setOtherProfile] = useState<{ first_name: string; photo_url?: string; id: string } | null>(null);

  const sessionIdRef = useRef<string | null>(answerSessionId);
  const minutesUsedRef = useRef(0);
  const durationRef = useRef(0);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minuteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach the remote stream whenever its element (video or audio) mounts.
  const attachRemote = useCallback((el: HTMLMediaElement | null) => {
    if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
      el.play?.().catch(() => undefined);
    }
  }, []);

  // ---- Finish (any reason) ------------------------------------------------------
  const finish = useCallback(async (reason: "hangup" | "peer" | "missed" | "declined" | "failed" | "no-minutes") => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (minuteTimerRef.current) clearInterval(minuteTimerRef.current);
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    const wasConnected = statusRef.current === "connected" || statusRef.current === "reconnecting";
    setStatus("ended");

    const id = sessionIdRef.current;
    if (id) {
      const final = reason === "missed" ? "missed" : reason === "declined" ? "declined" : "ended";
      const update: Record<string, unknown> = { status: final, ended_at: new Date().toISOString() };
      if (role === "caller") {
        update.duration_seconds = durationRef.current;
        update.credits_used = minutesUsedRef.current;
      }
      await supabase.from("video_call_sessions").update(update).eq("id", id);
    }

    const name = otherProfile?.first_name ?? "They";
    if (reason === "peer") toast(`${name} ended the call`);
    else if (reason === "declined") toast(`${name} can't take your call right now`);
    else if (reason === "missed") toast(`${name} didn't answer — we let them know you called`);
    else if (reason === "failed") toast.error("The connection was lost.");
    else if (reason === "no-minutes") toast.error("Out of minutes — call ended.");
    else if (wasConnected) toast(`Call ended · ${formatDuration(durationRef.current)}`);

    setTimeout(() => navigate(`/chat/${matchId}`, { replace: true }), 900);
  }, [matchId, navigate, otherProfile?.first_name, role, setStatus]);

  // ---- Billing (caller only, while connected) -------------------------------
  const deductMinute = useCallback(async () => {
    if (!profile?.id) return false;
    const { data, error } = await supabase.rpc("deduct_call_minute", { p_profile_id: profile.id, p_call_type: callType });
    const res = data as { success?: boolean; remaining?: number } | null;
    if (error || !res?.success) {
      finish("no-minutes");
      return false;
    }
    minutesUsedRef.current += 1;
    setMinutesRemaining(res.remaining ?? 0);
    if ((res.remaining ?? 0) <= 2 && (res.remaining ?? 0) > 0) {
      toast.warning(`Only ${res.remaining} ${callType} minute${res.remaining === 1 ? "" : "s"} left`);
    }
    return true;
  }, [profile?.id, callType, finish]);

  const onConnected = useCallback(() => {
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    const first = statusRef.current !== "connected" && statusRef.current !== "reconnecting";
    setStatus("connected");
    if (!first) return;
    if (role === "caller" && sessionIdRef.current) {
      supabase.from("video_call_sessions")
        .update({ status: "connected", started_at: new Date().toISOString() })
        .eq("id", sessionIdRef.current)
        .then(() => undefined);
    }
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setCallDuration(durationRef.current);
    }, 1000);
    if (role === "caller") {
      deductMinute();
      minuteTimerRef.current = setInterval(() => { deductMinute(); }, 60_000);
    }
  }, [role, deductMinute, setStatus]);

  const call = useCallConnection({
    matchId,
    myId: profile?.id ?? "",
    role,
    audioOnly: isPhone,
    onRemoteStream: (stream) => {
      remoteStreamRef.current = stream;
      document.querySelectorAll<HTMLMediaElement>("[data-remote-media]").forEach((el) => attachRemote(el));
    },
    onConnected,
    onPeerHangup: () => finish("peer"),
    onFailed: () => finish("failed"),
  });

  useEffect(() => {
    if (call.phase === "reconnecting" && statusRef.current === "connected") setStatus("reconnecting");
    if (call.phase === "connecting" && statusRef.current === "ringing" && role === "caller") setStatus("connecting");
  }, [call.phase, role, setStatus]);

  // ---- Load the other person + (caller) wallet ---------------------------------
  useEffect(() => {
    if (!profile?.id || !matchId) return;
    (async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("profile1_id, profile2_id, is_active")
        .eq("id", matchId)
        .maybeSingle();
      if (!match || match.is_active === false || (match.profile1_id !== profile.id && match.profile2_id !== profile.id)) {
        toast.error("This conversation isn't available.");
        navigate("/matches", { replace: true });
        return;
      }
      const otherId = match.profile1_id === profile.id ? match.profile2_id : match.profile1_id;
      const [{ data: other }, { data: photos }] = await Promise.all([
        supabase.from("profiles").select("id, first_name").eq("id", otherId).maybeSingle(),
        supabase.from("profile_photos").select("photo_url").eq("profile_id", otherId).order("position").limit(1),
      ]);
      setOtherProfile({ id: otherId, first_name: other?.first_name ?? "Your match", photo_url: photos?.[0]?.photo_url });
    })();

    if (role === "caller") {
      (async () => {
        const { data } = await supabase.from("user_credits").select("phone_minutes, video_minutes").eq("profile_id", profile.id).maybeSingle();
        if (!data) await supabase.rpc("ensure_user_credits");
        const remaining = isPhone ? (data?.phone_minutes ?? 0) : (data?.video_minutes ?? 0);
        setMinutesRemaining(remaining);
        setInsufficientMinutes(remaining <= 0);
        setWalletReady(true);
      })();
    }
  }, [profile?.id, matchId, role, isPhone, navigate]);

  // ---- Start ----------------------------------------------------------------------
  useEffect(() => {
    if (startedRef.current || !walletReady || insufficientMinutes || !otherProfile || !profile?.id) return;
    startedRef.current = true;

    (async () => {
      try {
        if (role === "caller") {
          const { data: session, error } = await supabase
            .from("video_call_sessions")
            .insert({ match_id: matchId, caller_id: profile.id, receiver_id: otherProfile.id, status: "ringing", call_type: callType })
            .select("id")
            .single();
          if (error || !session) {
            toast.error("Couldn't start the call. Please try again.");
            navigate(`/chat/${matchId}`, { replace: true });
            return;
          }
          sessionIdRef.current = session.id;
          setStatus("ringing");
          // Reach them outside the app too (WhatsApp / push). The server checks the match.
          supabase.functions
            .invoke("send-whatsapp-call-notification", { body: { matchId, callSessionId: session.id, callType } })
            .catch(() => undefined);
          ringTimerRef.current = setTimeout(() => {
            if (statusRef.current === "ringing" || statusRef.current === "connecting") {
              supabase.functions.invoke("send-missed-call-notification", { body: { matchId, callType } }).catch(() => undefined);
              call.hangUp();
              finish("missed");
            }
          }, RING_TIMEOUT_MS);
        } else {
          setStatus("connecting");
          await supabase.from("video_call_sessions").update({ status: "connecting" }).eq("id", answerSessionId!);
        }

        const stream = await call.start();
        if (!isPhone && localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (e) {
        console.error("Call start failed:", e);
        toast.error(isPhone ? "We need microphone access to call." : "We need camera and microphone access to call.");
        call.hangUp();
        finish("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletReady, insufficientMinutes, otherProfile, profile?.id]);

  // ---- Caller learns about decline / remote end from the session row ---------
  useEffect(() => {
    if (role !== "caller" || !matchId || !profile?.id) return;
    const channel = supabase
      .channel(`call-session-${matchId}-${profile.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "video_call_sessions", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const row = payload.new as { id: string; status: string };
          if (row.id !== sessionIdRef.current || finishedRef.current) return;
          if (row.status === "declined") { call.hangUp(); finish("declined"); }
          else if (row.status === "ended" && statusRef.current !== "connected") { call.hangUp(); finish("peer"); }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, matchId, profile?.id]);

  // Safety net: leaving the page always closes the session.
  useEffect(() => () => {
    if (!finishedRef.current && sessionIdRef.current) {
      finishedRef.current = true;
      supabase.from("video_call_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString(), ...(role === "caller" ? { duration_seconds: durationRef.current, credits_used: minutesUsedRef.current } : {}) })
        .eq("id", sessionIdRef.current)
        .then(() => undefined);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (minuteTimerRef.current) clearInterval(minuteTimerRef.current);
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
  }, [role]);

  const hangUp = () => {
    call.hangUp();
    finish("hangup");
  };

  const toggleMute = () => {
    const next = !isMuted;
    call.setMuted(next);
    setIsMuted(next);
  };

  const toggleVideo = () => {
    if (isPhone) return;
    const next = !isVideoOff;
    call.setVideoOff(next);
    setIsVideoOff(next);
  };

  if (insufficientMinutes) {
    return (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              No {isPhone ? "phone" : "video"} minutes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You need {isPhone ? "phone" : "video"} minutes to start this call. You're only charged while the call is connected.
              <span className="block mt-4 p-3 bg-muted rounded-lg text-foreground font-medium">
                Your balance: {minutesRemaining} {isPhone ? "phone" : "video"} min
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => navigate(-1)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/buy-minutes")}>Buy minutes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const connected = status === "connected" || status === "reconnecting";
  const statusLabel: Record<CallStatus, string> = {
    preparing: "Starting…",
    ringing: "Ringing…",
    connecting: "Connecting…",
    connected: isPhone ? "On call" : "Connected",
    reconnecting: "Reconnecting…",
    ended: "Call ended",
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col" role="main" aria-label={`${isPhone ? "Phone" : "Video"} call with ${otherProfile?.first_name ?? "your match"}`}>
      <div className="flex-1 relative overflow-hidden">
        {!isPhone && (
          <video
            ref={attachRemote}
            data-remote-media
            autoPlay
            playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${connected ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {isPhone && <audio ref={attachRemote} data-remote-media autoPlay className="hidden" />}

        {(!connected || isPhone) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className={`relative mb-6 ${status === "ringing" ? "animate-pulse" : ""}`}>
              {otherProfile?.photo_url ? (
                <img src={otherProfile.photo_url} alt="" className="w-32 h-32 rounded-full object-cover ring-4 ring-white/10" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-4xl font-bold text-muted-foreground">{otherProfile?.first_name?.[0] ?? "?"}</span>
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{otherProfile?.first_name ?? "Connecting…"}</h1>
            <p className="text-white/70 flex items-center gap-2" aria-live="polite">
              {status === "reconnecting" && <WifiOff className="w-4 h-4" />}
              {statusLabel[status]}
              {connected && ` · ${formatDuration(callDuration)}`}
            </p>
          </div>
        )}

        {connected && !isPhone && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="px-4 py-2 bg-black/50 backdrop-blur rounded-full flex items-center gap-2">
              <Clock className="w-4 h-4 text-white" />
              <span className="text-white font-medium tabular-nums">{formatDuration(callDuration)}</span>
            </div>
            {role === "caller" && (
              <div className="px-3 py-2 bg-amber-500/80 rounded-full text-white text-sm font-medium tabular-nums">{minutesRemaining} min</div>
            )}
            {status === "reconnecting" && (
              <div className="px-3 py-2 bg-black/50 rounded-full text-white text-sm flex items-center gap-1"><WifiOff className="w-4 h-4" />Reconnecting</div>
            )}
          </div>
        )}

        <button onClick={hangUp} className="absolute top-6 right-6 p-2 bg-black/50 rounded-full" aria-label="Close call">
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {!isPhone && (
        <div className="absolute bottom-32 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white/80 shadow-lg bg-muted">
          <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover -scale-x-100 ${isVideoOff ? "hidden" : ""}`} />
          {isVideoOff && (
            <div className="w-full h-full flex items-center justify-center"><VideoOff className="w-8 h-8 text-muted-foreground" /></div>
          )}
        </div>
      )}

      <div className="absolute left-0 right-0 flex justify-center gap-4 px-8" style={{ bottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        <button onClick={toggleMute} aria-pressed={isMuted} aria-label={isMuted ? "Unmute" : "Mute"}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-white" : "bg-white/20"}`}>
          {isMuted ? <MicOff className="w-6 h-6 text-black" /> : <Mic className="w-6 h-6 text-white" />}
        </button>
        {!isPhone && (
          <button onClick={toggleVideo} aria-pressed={isVideoOff} aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? "bg-white" : "bg-white/20"}`}>
            {isVideoOff ? <VideoOff className="w-6 h-6 text-black" /> : <Video className="w-6 h-6 text-white" />}
          </button>
        )}
        <button onClick={() => navigate(`/chat/${matchId}`)} aria-label="Open chat" className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-white" />
        </button>
        <button onClick={hangUp} aria-label="Hang up" className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
          <Phone className="w-6 h-6 text-white rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
