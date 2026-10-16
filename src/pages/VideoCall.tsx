import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, X, Clock, AlertCircle, WifiOff, SwitchCamera, Volume2, VolumeX,
  MessageCircle, RotateCcw, Coins, CameraOff,
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
import { useCallConnection, type CallFailReason, type CallRole } from "@/hooks/useCallConnection";
import { CallMediaError, cameraFallbackText, getCallMedia, mediaIssueText, type MediaIssue } from "@/lib/callMedia";
import {
  answerCall, chargeCallMinute, declineCall, endCall, markCallConnected, recordMissedCall, startCall,
} from "@/lib/callSessions";

type CallType = "video" | "phone";
type CallStatus = "preparing" | "ringing" | "connecting" | "connected" | "reconnecting" | "ended";
type EndKind = "hangup" | "peer" | "missed" | "declined" | "failed" | "no-minutes" | "unavailable" | "media";
interface EndInfo {
  kind: EndKind;
  title: string;
  detail?: string;
  retry?: boolean;
  buyMinutes?: boolean;
}
interface OtherPerson {
  id: string;
  first_name: string;
  photo_url?: string;
}

const RING_TIMEOUT_MS = 35_000;
/** The server decides whether a minute is due (first at connect, then every 60 s). */
const CHARGE_EVERY_MS = 30_000;

/**
 * One screen for both sides of a call.
 *   Caller: /video-call/:matchId?type=video|phone
 *   Callee: /video-call/:matchId?type=…&answer=<sessionId>  (from IncomingCallNotification)
 * Camera/microphone first (nothing rings until the microphone works), then the
 * session RPCs in lib/callSessions. Only the caller pays, only while connected,
 * billed by the server.
 */
export default function VideoCall() {
  const location = useLocation();
  // "Call again" navigates to the same route: remount so every ref starts fresh.
  return <CallScreen key={location.key} />;
}

function CallScreen() {
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

  const [endInfo, setEndInfo] = useState<EndInfo | null>(null);
  const [noMinutes, setNoMinutes] = useState(false);
  const [other, setOther] = useState<OtherPerson | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(answerSessionId);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const [cameraIssue, setCameraIssue] = useState<MediaIssue | null>(null);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  const sessionIdRef = useRef<string | null>(answerSessionId);
  const otherRef = useRef<OtherPerson | null>(null);
  const durationRef = useRef(0);
  const connectedOnceRef = useRef(false);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);
  /** Camera/microphone until the connection takes them over. */
  const mediaRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chargeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outputIndex = useRef(0);

  const whoName = () => otherRef.current?.first_name ?? "They";

  const stopTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (chargeTimerRef.current) clearInterval(chargeTimerRef.current);
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    timerRef.current = chargeTimerRef.current = ringTimerRef.current = null;
  }, []);

  // ---- Remote media ----------------------------------------------------------------
  const playRemote = useCallback((el: HTMLMediaElement) => {
    el.play?.()
      .then(() => setNeedsTap(false))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "NotAllowedError") setNeedsTap(true);
      });
  }, []);

  // Attach the remote stream whenever its element (video or audio) mounts.
  const attachRemote = useCallback((el: HTMLMediaElement | null) => {
    if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
      playRemote(el);
    }
  }, [playRemote]);

  const onRemoteStream = useCallback((stream: MediaStream) => {
    remoteStreamRef.current = stream;
    setRemoteHasVideo(stream.getVideoTracks().length > 0);
    document.querySelectorAll<HTMLMediaElement>("[data-remote-media]").forEach((el) => attachRemote(el));
  }, [attachRemote]);

  // ---- Finish (any reason) ---------------------------------------------------------
  const callRef = useRef<ReturnType<typeof useCallConnection> | null>(null);
  const end = useCallback((info: EndInfo, opts: { skipServer?: boolean } = {}) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopTimers();
    callRef.current?.hangUp();
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    setStatus("ended");
    const id = sessionIdRef.current;
    if (id && !opts.skipServer) void endCall(id, info.kind);

    if (info.kind === "hangup" || info.kind === "peer") {
      if (info.kind === "peer") toast(connectedOnceRef.current ? `${whoName()} ended the call` : `${whoName()} hung up`);
      else if (connectedOnceRef.current) toast(`Call ended · ${formatDuration(durationRef.current)}`);
      setTimeout(() => navigate(`/chat/${matchId}`, { replace: true }), 700);
      return;
    }
    setEndInfo(info);
  }, [matchId, navigate, setStatus, stopTimers]);

  // ---- Billing (caller only, while connected; the server keeps time) ---------------
  const charge = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id || finishedRef.current) return;
    const r = await chargeCallMinute(id);
    if (r.success) {
      if (typeof r.remaining === "number") {
        setMinutesRemaining(r.remaining);
        if (r.charged && r.remaining <= 2) {
          toast.warning(r.remaining === 0
            ? `This is your last ${callType} minute`
            : `Only ${r.remaining} ${callType} minute${r.remaining === 1 ? "" : "s"} left`);
        }
      }
    } else if (r.error === "no_minutes") {
      end({
        kind: "no-minutes",
        title: "You're out of minutes",
        detail: `The call ended because you have no ${callType} minutes left.`,
        buyMinutes: true,
      });
    }
    // Other errors (network): ending the call settles whatever is still owed.
  }, [callType, end]);
  const chargeRef = useRef(charge);
  chargeRef.current = charge;

  const onConnected = useCallback(() => {
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    ringTimerRef.current = null;
    if (finishedRef.current) return;
    setStatus("connected");
    if (connectedOnceRef.current) return; // back after a reconnect
    connectedOnceRef.current = true;
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setCallDuration(durationRef.current);
    }, 1000);
    const id = sessionIdRef.current;
    if (!id) return;
    void markCallConnected(id).then(() => {
      if (role !== "caller" || finishedRef.current) return;
      void chargeRef.current();
      chargeTimerRef.current = setInterval(() => void chargeRef.current(), CHARGE_EVERY_MS);
    });
  }, [role, setStatus]);

  const onFailed = useCallback((reason: CallFailReason) => {
    const who = whoName();
    const info: Record<CallFailReason, EndInfo> = {
      connection_lost: {
        kind: "failed",
        title: "Connection lost",
        detail: "The network dropped and we couldn't reconnect. Check your connection, then call again.",
        retry: true,
      },
      timeout: {
        kind: "failed",
        title: `Couldn't connect with ${who}`,
        detail: "One of you may be on a network that blocks calls. Try Wi-Fi or mobile data, then call again.",
        retry: true,
      },
      signaling: {
        kind: "failed",
        title: "Couldn't reach the call service",
        detail: "Check your internet connection and try again.",
        retry: true,
      },
    };
    end(info[reason]);
  }, [end]);

  const call = useCallConnection({
    myId: profile?.id ?? "",
    role,
    video: !isPhone,
    onRemoteStream,
    onConnected,
    onPeerJoined: () => {
      if (statusRef.current !== "ringing") return;
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
      setStatus("connecting");
    },
    onPeerHangup: () => {
      if (!connectedOnceRef.current && role === "caller") {
        end({ kind: "declined", title: `${whoName()} can't take your call right now`, detail: "Send a message to pick a better time.", retry: true });
      } else {
        end({ kind: "peer", title: "Call ended" });
      }
    },
    onFailed,
  });
  callRef.current = call;

  useEffect(() => {
    if (call.phase === "reconnecting" && connectedOnceRef.current && !finishedRef.current) setStatus("reconnecting");
  }, [call.phase, setStatus]);

  // ---- Load the other person ---------------------------------------------------------
  useEffect(() => {
    if (!profile?.id || !matchId) return;
    let cancelled = false;
    (async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("profile1_id, profile2_id, is_active")
        .eq("id", matchId)
        .maybeSingle();
      if (cancelled) return;
      if (!match || match.is_active === false || (match.profile1_id !== profile.id && match.profile2_id !== profile.id)) {
        end({ kind: "unavailable", title: "This conversation isn't available", detail: "The match may have ended." }, { skipServer: true });
        return;
      }
      const otherId = match.profile1_id === profile.id ? match.profile2_id : match.profile1_id;
      const [{ data: o }, { data: photos }] = await Promise.all([
        supabase.from("profiles").select("id, first_name").eq("id", otherId).maybeSingle(),
        supabase.from("profile_photos").select("photo_url").eq("profile_id", otherId).order("position").limit(1),
      ]);
      if (cancelled) return;
      const person = { id: otherId, first_name: o?.first_name ?? "Your match", photo_url: photos?.[0]?.photo_url };
      otherRef.current = person;
      setOther(person);
    })();
    return () => { cancelled = true; };
  }, [profile?.id, matchId, end]);

  // ---- Ring timeout (caller): record the missed call, tell them ------------------
  const onRingTimeout = useCallback(async () => {
    ringTimerRef.current = null;
    if (statusRef.current !== "ringing" || finishedRef.current) return;
    const id = sessionIdRef.current;
    let recorded = false;
    if (id) {
      const r = await recordMissedCall(id);
      if (!r.success && r.error === "call_not_ringing" && r.status === "connecting") {
        // They answered at the last second: the connect timer takes over.
        setStatus("connecting");
        return;
      }
      recorded = r.success;
      if (recorded) {
        supabase.functions
          .invoke("isexy-send-missed-call-notification", { body: { matchId, callType, callSessionId: id } })
          .catch(() => undefined);
      }
    }
    end({
      kind: "missed",
      title: `${whoName()} didn't answer`,
      detail: recorded ? "We let them know you called. Send a message to pick a good time." : "Send a message to pick a good time.",
      retry: true,
    }, { skipServer: recorded });
  }, [matchId, callType, end, setStatus]);
  const onRingTimeoutRef = useRef(onRingTimeout);
  onRingTimeoutRef.current = onRingTimeout;

  // ---- Start: media, then session, then connection ---------------------------------
  useEffect(() => {
    if (startedRef.current || !profile?.id || !other) return;
    startedRef.current = true;

    void (async () => {
      let media: { stream: MediaStream; cameraIssue: MediaIssue | null };
      try {
        media = await getCallMedia(!isPhone);
      } catch (e) {
        const issue = e instanceof CallMediaError ? e.issue : "unsupported";
        // Don't leave the caller ringing.
        if (role === "callee" && answerSessionId) void declineCall(answerSessionId);
        end({ kind: "media", ...mediaIssueText(issue, "microphone"), retry: true }, { skipServer: true });
        return;
      }
      if (finishedRef.current) {
        media.stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaRef.current = media.stream;
      setCameraIssue(media.cameraIssue);

      if (role === "caller") {
        const r = await startCall(matchId, callType);
        if (finishedRef.current) {
          if (r.call_session_id) void endCall(r.call_session_id, "left");
          return;
        }
        if (!r.success || !r.call_session_id) {
          if (r.error === "no_minutes") {
            finishedRef.current = true;
            mediaRef.current?.getTracks().forEach((t) => t.stop());
            mediaRef.current = null;
            setStatus("ended");
            setMinutesRemaining(r.remaining ?? 0);
            setNoMinutes(true);
            return;
          }
          end(startErrorInfo(r.error, whoName()), { skipServer: true });
          return;
        }
        sessionIdRef.current = r.call_session_id;
        setSessionId(r.call_session_id);
        if (typeof r.remaining === "number") setMinutesRemaining(r.remaining);
        setStatus("ringing");
        // Reach them outside the app too (push). The server checks the match.
        supabase.functions
          .invoke("isexy-send-whatsapp-call-notification", { body: { matchId, callSessionId: r.call_session_id, callType } })
          .catch(() => undefined);
        ringTimerRef.current = setTimeout(() => void onRingTimeoutRef.current(), RING_TIMEOUT_MS);
      } else {
        const r = await answerCall(answerSessionId!);
        if (finishedRef.current) return;
        if (!r.success) {
          end({
            kind: "unavailable",
            title: "This call has ended",
            detail: `${whoName()} is no longer calling. You can call them back.`,
            retry: true,
          }, { skipServer: true });
          return;
        }
        setStatus("connecting");
      }

      const stream = mediaRef.current;
      mediaRef.current = null; // the connection owns the tracks now
      if (stream && sessionIdRef.current) callRef.current?.start(stream, sessionIdRef.current);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, other]);

  // ---- Caller: decline / answer seen on the session row ----------------------------
  useEffect(() => {
    if (role !== "caller" || !sessionId) return;
    const channel = supabase
      .channel(`call-session-${sessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "isexy", table: "video_call_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as { status?: string };
          if (finishedRef.current) return;
          if (row.status === "declined") {
            end({ kind: "declined", title: `${whoName()} can't take your call right now`, detail: "Send a message to pick a better time.", retry: true }, { skipServer: true });
          } else if (row.status === "connecting" && statusRef.current === "ringing") {
            if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
            ringTimerRef.current = null;
            setStatus("connecting");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [role, sessionId, end, setStatus]);

  // ---- Leaving the page always closes the session ----------------------------------
  useEffect(() => {
    const close = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (sessionIdRef.current) void endCall(sessionIdRef.current, "left");
    };
    window.addEventListener("pagehide", close);
    return () => {
      window.removeEventListener("pagehide", close);
      close();
      stopTimers();
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopTimers]);

  // ---- Controls ----------------------------------------------------------------------
  const localHasVideo = !!call.localStream?.getVideoTracks().length;

  const attachLocal = useCallback((el: HTMLVideoElement | null) => {
    if (el && call.localStream && el.srcObject !== call.localStream) el.srcObject = call.localStream;
  }, [call.localStream]);

  const hangUp = () => end({ kind: "hangup", title: "Call ended" });

  const toggleMute = () => {
    const next = !isMuted;
    call.setMuted(next);
    setIsMuted(next);
  };

  const toggleVideo = () => {
    if (isPhone || !localHasVideo) return;
    const next = !isVideoOff;
    call.setVideoOff(next);
    setIsVideoOff(next);
  };

  const flipCamera = async () => {
    const ok = await call.switchCamera();
    if (!ok) toast.error("Couldn't switch camera");
  };

  /** Choose the next audio output where the browser allows it, otherwise sound on/off. */
  const toggleSpeaker = async () => {
    const el = document.querySelector<HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }>("[data-remote-media]");
    if (el?.setSinkId && navigator.mediaDevices?.enumerateDevices) {
      try {
        const outs = (await navigator.mediaDevices.enumerateDevices())
          .filter((d) => d.kind === "audiooutput" && d.deviceId && d.deviceId !== "communications");
        if (outs.length > 1) {
          outputIndex.current = (outputIndex.current + 1) % outs.length;
          const out = outs[outputIndex.current];
          await el.setSinkId(out.deviceId);
          setSoundOn(true);
          toast(`Sound: ${out.label || `output ${outputIndex.current + 1}`}`);
          return;
        }
      } catch {
        /* fall back to sound on/off */
      }
    }
    setSoundOn((v) => !v);
  };

  const enableSound = () => {
    document.querySelectorAll<HTMLMediaElement>("[data-remote-media]").forEach((el) => playRemote(el));
  };

  // ---- Screens -----------------------------------------------------------------------
  const backToChat = () => navigate(`/chat/${matchId}`, { replace: true });
  const callAgain = () => navigate(`/video-call/${matchId}?type=${callType}`, { replace: true });

  if (noMinutes) {
    return (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              No {isPhone ? "phone" : "video"} minutes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You need {isPhone ? "phone" : "video"} minutes to start this call. You're only charged while the call is connected.
              <span className="block mt-4 p-3 bg-muted rounded-lg text-foreground font-medium">
                Your balance: {minutesRemaining ?? 0} {isPhone ? "phone" : "video"} min
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={backToChat}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/buy-minutes")}>Buy minutes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (endInfo) {
    const canMessage = endInfo.kind !== "unavailable" || !!other;
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black px-6 text-center" role="alert" aria-live="assertive">
        <Avatar person={other} size="w-24 h-24" />
        <h1 className="mt-6 text-2xl font-bold text-white">{endInfo.title}</h1>
        {endInfo.detail && <p className="mt-2 max-w-sm text-white/70">{endInfo.detail}</p>}
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          {endInfo.buyMinutes && (
            <button onClick={() => navigate("/buy-minutes")} className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground">
              <Coins className="h-5 w-5" /> Buy minutes
            </button>
          )}
          {endInfo.retry && other && (
            <button onClick={callAgain} className={`flex h-12 items-center justify-center gap-2 rounded-full font-semibold ${endInfo.buyMinutes ? "bg-white/15 text-white" : "bg-primary text-primary-foreground"}`}>
              <RotateCcw className="h-5 w-5" />
              {endInfo.kind === "media" ? "Try again" : role === "callee" ? "Call back" : "Call again"}
            </button>
          )}
          {canMessage && (
            <button onClick={backToChat} className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/15 font-semibold text-white">
              <MessageCircle className="h-5 w-5" /> {other ? `Message ${other.first_name}` : "Back to chat"}
            </button>
          )}
          <button onClick={() => navigate(other ? `/chat/${matchId}` : "/matches", { replace: true })} className="h-11 text-sm font-medium text-white/60">
            Close
          </button>
        </div>
      </div>
    );
  }

  const connected = status === "connected" || status === "reconnecting";
  const peerCamOn = call.peerState.camOn && remoteHasVideo;
  const showRemoteVideo = !isPhone && connected && peerCamOn;
  const statusLabel: Record<CallStatus, string> = {
    preparing: isPhone ? "Starting your microphone…" : "Starting your camera…",
    ringing: "Ringing…",
    connecting: "Connecting…",
    connected: isPhone ? "On call" : "Connected",
    reconnecting: "Reconnecting…",
    ended: "Call ended",
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col" role="main" aria-label={`${isPhone ? "Phone" : "Video"} call with ${other?.first_name ?? "your match"}`}>
      <div className="flex-1 relative overflow-hidden">
        {!isPhone && (
          <video
            ref={attachRemote}
            data-remote-media
            autoPlay
            playsInline
            muted={!soundOn}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${showRemoteVideo ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {isPhone && <audio ref={attachRemote} data-remote-media autoPlay muted={!soundOn} className="hidden" />}

        {!showRemoteVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className={`relative mb-6 ${status === "ringing" ? "animate-pulse" : ""}`}>
              <Avatar person={other} size="w-32 h-32" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{other?.first_name ?? "Connecting…"}</h1>
            <p className="text-white/70 flex items-center gap-2" aria-live="polite" data-testid="call-status">
              {status === "reconnecting" && <WifiOff className="w-4 h-4" />}
              {statusLabel[status]}
              {connected && ` · ${formatDuration(callDuration)}`}
            </p>
            {!isPhone && connected && !peerCamOn && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-white/60"><CameraOff className="h-4 w-4" /> {other?.first_name ?? "They"}'s camera is off</p>
            )}
          </div>
        )}

        {/* Top bar */}
        <div className="absolute left-0 right-0 flex flex-col items-center gap-2 px-16" style={{ top: "max(1.5rem, env(safe-area-inset-top))" }}>
          {connected && !isPhone && showRemoteVideo && (
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-black/50 backdrop-blur rounded-full flex items-center gap-2">
                <Clock className="w-4 h-4 text-white" />
                <span className="text-white font-medium tabular-nums">{formatDuration(callDuration)}</span>
              </div>
              {status === "reconnecting" && (
                <div className="px-3 py-2 bg-black/50 rounded-full text-white text-sm flex items-center gap-1" aria-live="polite"><WifiOff className="w-4 h-4" />Reconnecting</div>
              )}
            </div>
          )}
          {role === "caller" && connected && minutesRemaining !== null && (
            <div className="px-3 py-1.5 bg-white/15 backdrop-blur rounded-full text-white text-sm font-medium tabular-nums" aria-label={`${minutesRemaining} ${callType} minutes left`}>
              {minutesRemaining} min left
            </div>
          )}
          {cameraIssue && !isPhone && (
            <div className="rounded-full bg-black/60 px-3 py-1.5 text-center text-xs text-white/90 backdrop-blur" role="status">
              {cameraFallbackText(cameraIssue)}
            </div>
          )}
          {connected && !call.peerState.micOn && (
            <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/90" role="status">
              <MicOff className="h-3.5 w-3.5" /> {other?.first_name ?? "They"} muted their microphone
            </div>
          )}
        </div>

        {needsTap && connected && (
          <button onClick={enableSound} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg">
            <Volume2 className="h-5 w-5" /> Tap to hear {other?.first_name ?? "them"}
          </button>
        )}

        <button onClick={hangUp} className="absolute right-4 p-2 bg-black/50 rounded-full" style={{ top: "max(1.5rem, env(safe-area-inset-top))" }} aria-label="Close call">
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {!isPhone && localHasVideo && (
        <div className="absolute bottom-32 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white/80 shadow-lg bg-muted">
          <video ref={attachLocal} autoPlay playsInline muted className={`w-full h-full object-cover ${call.facing === "user" ? "-scale-x-100" : ""} ${isVideoOff ? "hidden" : ""}`} />
          {isVideoOff && (
            <div className="w-full h-full flex items-center justify-center"><VideoOff className="w-8 h-8 text-muted-foreground" /></div>
          )}
        </div>
      )}

      <div className="absolute left-0 right-0 flex justify-center gap-3 px-4" style={{ bottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        <CallButton onClick={toggleMute} pressed={isMuted} label={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <MicOff className="w-6 h-6 text-black" /> : <Mic className="w-6 h-6 text-white" />}
        </CallButton>
        {!isPhone && localHasVideo && (
          <CallButton onClick={toggleVideo} pressed={isVideoOff} label={isVideoOff ? "Turn camera on" : "Turn camera off"}>
            {isVideoOff ? <VideoOff className="w-6 h-6 text-black" /> : <Video className="w-6 h-6 text-white" />}
          </CallButton>
        )}
        {!isPhone && localHasVideo && call.canSwitchCamera && !isVideoOff && (
          <CallButton onClick={flipCamera} label="Switch camera">
            <SwitchCamera className="w-6 h-6 text-white" />
          </CallButton>
        )}
        <CallButton onClick={toggleSpeaker} pressed={!soundOn} label={soundOn ? "Speaker on" : "Speaker off"}>
          {soundOn ? <Volume2 className="w-6 h-6 text-white" /> : <VolumeX className="w-6 h-6 text-black" />}
        </CallButton>
        <button onClick={hangUp} aria-label="Hang up" className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center">
          <PhoneOff className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
}

function CallButton({ onClick, pressed, label, children }: { onClick: () => void; pressed?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${pressed ? "bg-white" : "bg-white/20"}`}
    >
      {children}
    </button>
  );
}

function Avatar({ person, size }: { person: OtherPerson | null; size: string }) {
  return person?.photo_url ? (
    <img src={person.photo_url} alt="" className={`${size} rounded-full object-cover ring-4 ring-white/10`} />
  ) : (
    <div className={`${size} rounded-full bg-muted flex items-center justify-center`}>
      <span className="text-4xl font-bold text-muted-foreground">{person?.first_name?.[0] ?? "?"}</span>
    </div>
  );
}

function startErrorInfo(error: string | undefined, name: string): EndInfo {
  switch (error) {
    case "match_unavailable":
      return { kind: "unavailable", title: "This conversation isn't available", detail: "The match may have ended." };
    case "unavailable":
      return { kind: "unavailable", title: `You can't call ${name}`, detail: "Calls between you and this member aren't possible." };
    case "too_many_calls":
      return { kind: "failed", title: "Too many calls in a row", detail: "Wait a couple of minutes before calling again, or send a message." };
    default:
      return { kind: "failed", title: "Couldn't start the call", detail: "Check your connection and try again.", retry: true };
  }
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
