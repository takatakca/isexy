import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Mic, MicOff, PhoneOff, Lock, Coins, Volume2, VolumeX, WifiOff, RotateCcw, Headphones } from "lucide-react";
import { toast } from "sonner";
import { useCallConnection, type CallFailReason, type CallRole } from "@/hooks/useCallConnection";
import { CallMediaError, getCallMedia, mediaIssueText } from "@/lib/callMedia";
import {
  answerPhoneLineCall, chargePhoneLineMinute, declinePhoneLineCall, endPhoneLineCall,
  markPhoneLineCallConnected, startPhoneLineCall,
} from "@/lib/callSessions";

type Status = "preparing" | "ringing" | "connecting" | "connected" | "reconnecting" | "ended";
interface EndInfo {
  title: string;
  detail?: string;
  retry?: boolean;
  retryLabel?: string;
  buyMinutes?: boolean;
  voiceReply?: boolean;
}

const RING_TIMEOUT_MS = 35_000;
/** The server decides whether a minute is due (first once media flows, then every 60 s). */
const CHARGE_EVERY_MS = 30_000;

/**
 * Phone Line voice call, in the app (WebRTC audio, no phone numbers involved).
 *   Caller:   /phone-line/call/new?to=<profileId>   (from Browse voices)
 *   Receiver: /phone-line/call/<sessionId>?answer=1 (from the incoming call sheet)
 * Microphone first (nothing rings without it), then the call_sessions RPCs in
 * lib/callSessions. Only the caller pays, only once audio flows, billed by
 * the server. Media goes through TURN when it is configured, so neither side
 * learns the other's IP address.
 */
export default function PhoneLineCall() {
  const location = useLocation();
  return <PhoneLineCallScreen key={location.key} />;
}

function PhoneLineCallScreen() {
  const { callSessionId = "" } = useParams<{ callSessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const isNew = callSessionId === "new";
  const targetId = searchParams.get("to");
  const role: CallRole = isNew ? "caller" : "callee";

  const [status, setStatusState] = useState<Status>("preparing");
  const statusRef = useRef<Status>("preparing");
  const setStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);
  const [endInfo, setEndInfo] = useState<EndInfo | null>(null);
  const [otherName, setOtherName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(isNew ? null : callSessionId);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const [muted, setMuted] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);

  const sessionIdRef = useRef<string | null>(isNew ? null : callSessionId);
  const otherRef = useRef("");
  const finishedRef = useRef(false);
  const startedRef = useRef(false);
  const connectedOnceRef = useRef(false);
  const mediaRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chargeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callRef = useRef<ReturnType<typeof useCallConnection> | null>(null);

  const name = () => otherRef.current || "They";

  const stopTimers = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (chargeRef.current) clearInterval(chargeRef.current);
    if (ringRef.current) clearTimeout(ringRef.current);
    tickRef.current = chargeRef.current = ringRef.current = null;
  }, []);

  /** Finish for any reason. `reason` goes to the server unless it already knows. */
  const end = useCallback((info: EndInfo | null, reason: string | null) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopTimers();
    callRef.current?.hangUp();
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    setStatus("ended");
    const id = sessionIdRef.current;
    if (id && reason) void endPhoneLineCall(id, reason);
    if (info) {
      setEndInfo(info);
    } else {
      toast(connectedOnceRef.current ? `Call ended · ${fmt(elapsedRef.current)}` : "Call ended");
      setTimeout(() => navigate("/phone-line", { replace: true }), 700);
    }
  }, [navigate, setStatus, stopTimers]);
  const endRef = useRef(end);
  endRef.current = end;

  // ---- Remote audio --------------------------------------------------------------
  const play = useCallback((el: HTMLMediaElement) => {
    el.play?.().then(() => setNeedsTap(false)).catch((e: unknown) => {
      if ((e as { name?: string })?.name === "NotAllowedError") setNeedsTap(true);
    });
  }, []);
  const attachRemote = useCallback((el: HTMLAudioElement | null) => {
    if (el && remoteRef.current && el.srcObject !== remoteRef.current) {
      el.srcObject = remoteRef.current;
      play(el);
    }
  }, [play]);

  // ---- Billing (caller, once audio flows; the server keeps time) ----------------------
  const charge = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id || finishedRef.current) return;
    const r = await chargePhoneLineMinute(id);
    if (r.success) {
      if (typeof r.remaining === "number") {
        setRemaining(r.remaining);
        if (r.charged && r.remaining <= 2) {
          toast.warning(r.remaining === 0 ? "This is your last phone minute" : `Only ${r.remaining} phone minute${r.remaining === 1 ? "" : "s"} left`);
        }
      }
    } else if (r.error === "no_minutes") {
      endRef.current({ title: "You're out of phone minutes", detail: "The call ended because you have no phone minutes left.", buyMinutes: true }, "out_of_minutes");
    } else if (r.error === "call_not_active") {
      endRef.current(null, null);
    }
  }, []);

  const call = useCallConnection({
    myId: profile?.id ?? "",
    role,
    video: false,
    privateRelay: true,
    onRemoteStream: (stream) => {
      remoteRef.current = stream;
      document.querySelectorAll<HTMLAudioElement>("[data-remote-media]").forEach((el) => attachRemote(el));
    },
    onConnected: () => {
      if (ringRef.current) clearTimeout(ringRef.current);
      ringRef.current = null;
      if (finishedRef.current) return;
      setStatus("connected");
      if (connectedOnceRef.current) return;
      connectedOnceRef.current = true;
      tickRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
      const id = sessionIdRef.current;
      if (!id) return;
      void markPhoneLineCallConnected(id).then(() => {
        if (role !== "caller" || finishedRef.current) return;
        void charge();
        chargeRef.current = setInterval(() => void charge(), CHARGE_EVERY_MS);
      });
    },
    onPeerJoined: () => {
      if (statusRef.current !== "ringing") return;
      if (ringRef.current) clearTimeout(ringRef.current);
      ringRef.current = null;
      setStatus("connecting");
    },
    onPeerHangup: () => {
      if (!connectedOnceRef.current && role === "caller") {
        endRef.current({ title: `${name()} can't take your call right now`, detail: "Leave a voice reply instead, or try again later.", retry: true, voiceReply: true }, "peer_hangup");
      } else {
        endRef.current(null, "peer_hangup");
      }
    },
    onFailed: (reason: CallFailReason) => {
      const info: Record<CallFailReason, EndInfo> = {
        connection_lost: { title: "Connection lost", detail: "The network dropped and we couldn't reconnect. Check your connection and try again.", retry: role === "caller" },
        timeout: { title: `Couldn't connect with ${name()}`, detail: "One of you may be on a network that blocks calls. Try Wi-Fi or mobile data.", retry: role === "caller" },
        signaling: { title: "Couldn't reach the call service", detail: "Check your internet connection and try again.", retry: role === "caller" },
      };
      endRef.current(info[reason], "failed");
    },
  });
  callRef.current = call;

  useEffect(() => {
    if (call.phase === "reconnecting" && connectedOnceRef.current && !finishedRef.current) setStatus("reconnecting");
  }, [call.phase, setStatus]);

  // ---- Ring timeout (caller) ------------------------------------------------------------
  const onRingTimeout = useCallback(() => {
    ringRef.current = null;
    if (statusRef.current !== "ringing" || finishedRef.current) return;
    endRef.current({ title: `${name()} didn't answer`, detail: "Leave a voice reply so they can call you back.", retry: true, voiceReply: true }, "no_answer");
  }, []);

  // ---- Start: microphone, then the session, then the connection -------------------------
  useEffect(() => {
    if (startedRef.current || !profile?.id) return;
    startedRef.current = true;
    void (async () => {
      if (isNew && !targetId) {
        end({ title: "Pick a voice to call", detail: "Choose someone in Browse voices." }, null);
        return;
      }
      let stream: MediaStream;
      try {
        stream = (await getCallMedia(false)).stream;
      } catch (e) {
        const issue = e instanceof CallMediaError ? e.issue : "unsupported";
        if (!isNew) void declinePhoneLineCall(callSessionId);
        end({ ...mediaIssueText(issue, "microphone"), retry: isNew, retryLabel: "Try again" }, null);
        return;
      }
      if (finishedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaRef.current = stream;

      if (isNew) {
        const r = await startPhoneLineCall(targetId!);
        if (finishedRef.current) {
          if (r.call_session_id) void endPhoneLineCall(r.call_session_id, "left");
          return;
        }
        if (!r.success || !r.call_session_id) {
          end(startErrorInfo(r.error), null);
          return;
        }
        sessionIdRef.current = r.call_session_id;
        setSessionId(r.call_session_id);
        otherRef.current = r.display_name ?? "Voice profile";
        setOtherName(otherRef.current);
        if (typeof r.phone_minutes === "number") setRemaining(r.phone_minutes);
        setStatus("ringing");
        ringRef.current = setTimeout(onRingTimeout, RING_TIMEOUT_MS);
      } else {
        const r = await answerPhoneLineCall(callSessionId);
        if (finishedRef.current) return;
        if (!r.success) {
          end({ title: "This call has ended", detail: "The caller is no longer on the line." }, null);
          return;
        }
        otherRef.current = r.caller_name ?? "Caller";
        setOtherName(otherRef.current);
        setStatus("connecting");
      }
      const s = mediaRef.current;
      mediaRef.current = null; // the connection owns the tracks now
      if (s && sessionIdRef.current) callRef.current?.start(s, `pl-${sessionIdRef.current}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // ---- Caller: answer / decline seen on the session row ---------------------------------
  useEffect(() => {
    if (role !== "caller" || !sessionId) return;
    const channel = supabase
      .channel(`phone-line-session-${sessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "isexy", table: "call_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as { status?: string };
          if (finishedRef.current) return;
          if (row.status === "declined") {
            endRef.current({ title: `${name()} can't take your call right now`, detail: "Leave a voice reply instead, or try again later.", retry: true, voiceReply: true }, null);
          } else if (row.status === "connected" && statusRef.current === "ringing") {
            if (ringRef.current) clearTimeout(ringRef.current);
            ringRef.current = null;
            setStatus("connecting");
            callRef.current?.expectPeer();
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [role, sessionId, setStatus]);

  // ---- Leaving the page ends the call ------------------------------------------------------
  useEffect(() => {
    const close = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (sessionIdRef.current) void endPhoneLineCall(sessionIdRef.current, "left");
    };
    window.addEventListener("pagehide", close);
    return () => {
      window.removeEventListener("pagehide", close);
      close();
      stopTimers();
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopTimers]);

  const toggleMute = () => {
    const next = !muted;
    call.setMuted(next);
    setMuted(next);
  };
  const hangUp = () => end(null, "hangup");
  const callAgain = () => {
    if (targetId) navigate(`/phone-line/call/new?to=${targetId}`, { replace: true });
  };

  // ---- End screen ---------------------------------------------------------------------------
  if (endInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 safe-bottom" role="alert" aria-live="assertive">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border/60 bg-card p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            {endInfo.buyMinutes ? <Coins className="h-7 w-7" /> : <PhoneOff className="h-7 w-7" />}
          </div>
          <div>
            <h1 className="text-xl font-extrabold">{endInfo.title}</h1>
            {endInfo.detail && <p className="mt-1 text-sm text-muted-foreground">{endInfo.detail}</p>}
          </div>
          {endInfo.buyMinutes && (
            <button onClick={() => navigate("/buy-minutes")} className="cta-primary w-full">
              <Coins className="h-4 w-4" /> Buy minutes
            </button>
          )}
          {endInfo.retry && targetId && (
            <button onClick={callAgain} className={endInfo.buyMinutes ? "w-full rounded-full border border-border px-6 py-3 text-sm font-semibold" : "cta-primary w-full"}>
              <RotateCcw className="h-4 w-4" /> {endInfo.retryLabel ?? "Call again"}
            </button>
          )}
          {endInfo.voiceReply && (
            <button onClick={() => navigate("/phone-line/browse", { replace: true })} className="w-full rounded-full border border-border px-6 py-3 text-sm font-semibold">
              <span className="inline-flex items-center gap-2"><Headphones className="h-4 w-4" /> Leave a voice reply</span>
            </button>
          )}
          <button onClick={() => navigate("/phone-line", { replace: true })} className="w-full rounded-full px-6 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
            Back to Phone Line
          </button>
        </div>
      </div>
    );
  }

  const connected = status === "connected" || status === "reconnecting";
  const label: Record<Status, string> = {
    preparing: "Starting your microphone…",
    ringing: "Ringing…",
    connecting: "Connecting…",
    connected: "On call",
    reconnecting: "Reconnecting…",
    ended: "Call ended",
  };
  const initial = (otherName || "?").charAt(0).toUpperCase();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background p-6 safe-bottom" aria-label={`Phone Line call with ${otherName || "a voice profile"}`}>
      <audio ref={attachRemote} data-remote-media autoPlay muted={!soundOn} className="hidden" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-light/15 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full flex-col items-center pt-8">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">
          <Lock className="h-3 w-3" /> Phone Line call
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{otherName || "Phone Line"}</h1>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite" data-testid="call-status">
          {status === "reconnecting" ? <WifiOff className="h-4 w-4" /> : (
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-primary"} animate-pulse`} />
          )}
          {label[status]}
        </p>
        {connected && !call.peerState.micOn && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-card/70 px-3 py-1 text-xs text-muted-foreground" role="status">
            <MicOff className="h-3.5 w-3.5" /> {otherName || "They"} muted their microphone
          </p>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative">
          <span className={`absolute inset-0 -m-4 rounded-full bg-primary/15 ${status === "ringing" ? "animate-ping" : "animate-pulse"}`} />
          <span className="absolute inset-0 -m-2 rounded-full bg-primary/25" />
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-light text-6xl font-extrabold text-primary-foreground shadow-2xl">
            {initial}
          </div>
        </div>
        <div className="text-center">
          <div className="font-mono text-5xl font-extrabold tabular-nums">{fmt(elapsed)}</div>
          {role === "caller" && remaining !== null && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Coins className="h-3 w-3 text-primary" />
              <span><span className="font-bold text-foreground">{remaining}</span> phone minutes left</span>
            </div>
          )}
        </div>
        {needsTap && connected && (
          <button
            onClick={() => document.querySelectorAll<HTMLAudioElement>("[data-remote-media]").forEach((el) => play(el))}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg"
          >
            <Volume2 className="h-5 w-5" /> Tap to hear {otherName || "them"}
          </button>
        )}
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
            className={`flex h-16 w-16 items-center justify-center rounded-full border border-border/60 transition-all active:scale-95 ${muted ? "bg-foreground text-background" : "bg-card/60 text-foreground backdrop-blur hover:bg-card"}`}
          >
            {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <button
            type="button"
            onClick={hangUp}
            aria-label="Hang up"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-2xl shadow-destructive/40 transition-all hover:brightness-110 active:scale-95"
          >
            <PhoneOff className="h-8 w-8" />
          </button>
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-label={soundOn ? "Speaker on" : "Speaker off"}
            aria-pressed={!soundOn}
            className={`flex h-16 w-16 items-center justify-center rounded-full border border-border/60 transition-all active:scale-95 ${!soundOn ? "bg-foreground text-background" : "bg-card/60 text-foreground backdrop-blur hover:bg-card"}`}
          >
            {soundOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Your phone number stays private. 18+ only.</p>
      </div>
    </div>
  );
}

function startErrorInfo(error: string | undefined): EndInfo {
  switch (error) {
    case "no_minutes":
      return { title: "You need phone minutes to call", detail: "You're only charged while the call is connected.", buyMinutes: true };
    case "voice_profile_unavailable":
    case "blocked":
      return { title: "This voice isn't taking calls right now", detail: "Try another voice in Browse voices." };
    case "age_restricted":
      return { title: "Phone Line calls are 18+ only" };
    case "incomplete_profile":
      return { title: "Finish your profile first", detail: "Add your first name in your profile, then call again." };
    case "cannot_call_self":
      return { title: "That's your own voice profile" };
    case "too_many_calls":
      return { title: "Too many calls in a row", detail: "Wait a couple of minutes before calling again." };
    case "not_deployed":
      return { title: "Phone Line calls aren't available yet", detail: "Leave a voice reply instead.", voiceReply: true };
    default:
      return { title: "Couldn't start the call", detail: "Check your connection and try again.", retry: true };
  }
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
