import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Loader2, Lock, Coins } from "lucide-react";
import { toast } from "sonner";

interface SessionRow {
  id: string;
  status: string;
  receiver_profile_id: string | null;
  call_type: string;
  answered_at: string | null;
}

export default function PhoneLineCall() {
  const { callSessionId } = useParams<{ callSessionId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [session, setSession] = useState<SessionRow | null>(null);
  const [otherName, setOtherName] = useState<string>("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [ending, setEnding] = useState(false);
  const [outOfMinutes, setOutOfMinutes] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const chargeRef = useRef<number | null>(null);
  const endedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!callSessionId) return;

    const init = async () => {
      const { data: s, error } = await supabase
        .from("call_sessions")
        .select("id, status, receiver_profile_id, call_type, answered_at")
        .eq("id", callSessionId)
        .maybeSingle();
      if (error || !s) {
        toast.error("Call session not found");
        navigate("/phone-line");
        return;
      }
      setSession(s as SessionRow);

      if (s.receiver_profile_id) {
        const { data: rp } = await supabase
          .from("profiles")
          .select("first_name")
          .eq("id", s.receiver_profile_id)
          .maybeSingle();
        setOtherName(rp?.first_name ?? "Voice profile");
      }

      if (profile?.id) {
        const { data: c } = await supabase
          .from("user_credits")
          .select("phone_minutes")
          .eq("profile_id", profile.id)
          .maybeSingle();
        setRemaining(c?.phone_minutes ?? 0);
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch {
        toast.error("Microphone permission denied");
      }

      await chargeOne();

      tickRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      chargeRef.current = window.setInterval(() => {
        chargeOne();
      }, 60_000);
    };

    init();

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (chargeRef.current) clearInterval(chargeRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (!endedRef.current && callSessionId) {
        supabase.rpc("end_call_session", {
          p_call_session_id: callSessionId,
          p_end_reason: "navigated_away",
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callSessionId, user?.id, profile?.id]);

  const chargeOne = async () => {
    if (!callSessionId || endedRef.current) return;
    const { data, error } = await supabase.rpc("charge_call_session_minute", {
      p_call_session_id: callSessionId,
    });
    if (error) return;
    const r = data as { success: boolean; charged?: boolean; remaining?: number; error?: string };
    if (!r?.success) {
      if (r?.error === "no_minutes") {
        setOutOfMinutes(true);
        await hangUp("out_of_minutes", false);
        return;
      }
      if (r?.error === "call_not_active") {
        await hangUp("call_not_active");
      }
      return;
    }
    if (typeof r.remaining === "number") setRemaining(r.remaining);
  };

  const toggleMute = () => {
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const hangUp = async (reason = "user_ended", redirect = true) => {
    if (endedRef.current || !callSessionId) return;
    endedRef.current = true;
    setEnding(true);
    if (tickRef.current) clearInterval(tickRef.current);
    if (chargeRef.current) clearInterval(chargeRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    await supabase.rpc("end_call_session", {
      p_call_session_id: callSessionId,
      p_end_reason: reason,
    });
    if (reason === "user_ended" && redirect) navigate("/phone-line");
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ---------- Out of minutes overlay ----------
  if (outOfMinutes) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 safe-bottom">
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-destructive/40 bg-card p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <PhoneOff className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Out of phone minutes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Top up your minutes to keep calling voice profiles.
            </p>
          </div>
          <button
            onClick={() => navigate("/buy-minutes")}
            className="cta-primary w-full"
          >
            <Coins className="h-4 w-4" /> Buy minutes
          </button>
          <button
            onClick={() => navigate("/phone-line")}
            className="w-full rounded-full px-6 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Back to phone line
          </button>
        </div>
      </div>
    );
  }

  const initial = (otherName || "?").charAt(0).toUpperCase();
  const connected = session?.status === "active" || !!session?.answered_at;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-background p-6 safe-bottom">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-light/15 blur-3xl" />
      </div>

      <div className="relative z-10 flex w-full flex-col items-center pt-8">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">
          <Lock className="h-3 w-3" /> Phone-line call
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          {otherName || "Connecting…"}
        </h1>
        <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          {!session ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-emerald-400" : "bg-amber-400"
              } animate-pulse`}
            />
          )}
          <span className="capitalize">{session?.status ?? "connecting"}</span>
        </div>
      </div>

      {/* Avatar + timer */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative">
          <span className="absolute inset-0 -m-4 animate-pulse rounded-full bg-primary/15" />
          <span className="absolute inset-0 -m-2 rounded-full bg-primary/25" />
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-light text-6xl font-extrabold text-primary-foreground shadow-2xl">
            {initial}
          </div>
        </div>

        <div className="text-center">
          <div className="font-mono text-5xl font-extrabold tabular-nums">{fmt(elapsed)}</div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Coins className="h-3 w-3 text-primary" />
            <span>
              <span className="font-bold text-foreground">{remaining ?? "…"}</span> minutes left
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className={`flex h-16 w-16 items-center justify-center rounded-full border border-border/60 transition-all active:scale-95 ${
              muted
                ? "bg-muted text-foreground"
                : "bg-card/60 text-foreground hover:bg-card backdrop-blur"
            }`}
          >
            {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>

          <Button
            type="button"
            onClick={() => hangUp("user_ended")}
            disabled={ending}
            aria-label="End call"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-2xl shadow-destructive/40 transition-all hover:brightness-110 active:scale-95"
          >
            <PhoneOff className="h-8 w-8" />
          </Button>

          <div className="h-16 w-16" aria-hidden />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Your phone number stays private. 18+ only.
        </p>
      </div>
    </div>
  );
}
