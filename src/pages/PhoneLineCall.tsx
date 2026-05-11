import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";
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

      // Get current phone minutes
      if (profile?.id) {
        const { data: c } = await supabase
          .from("user_credits")
          .select("phone_minutes")
          .eq("profile_id", profile.id)
          .maybeSingle();
        setRemaining(c?.phone_minutes ?? 0);
      }

      // Mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch {
        toast.error("Microphone permission denied");
      }

      // Charge first minute immediately
      await chargeOne();

      // Tick every second for timer
      tickRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      // Charge again every 60s
      chargeRef.current = window.setInterval(() => {
        chargeOne();
      }, 60_000);
    };

    init();

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (chargeRef.current) clearInterval(chargeRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      // best-effort end if user navigates away
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
        toast.error("Out of phone minutes");
        await hangUp("out_of_minutes");
        navigate("/buy-minutes");
        return;
      }
      if (r?.error === "call_not_active") {
        await hangUp("call_not_active");
      }
      return;
    }
    // success — may or may not have charged this tick (server time-gated)
    if (typeof r.remaining === "number") setRemaining(r.remaining);
  };

  const toggleMute = () => {
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const hangUp = async (reason = "user_ended") => {
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
    if (reason === "user_ended") navigate("/phone-line");
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md space-y-6 p-6 text-center">
        <div>
          <div className="text-sm text-muted-foreground">Phone-line call</div>
          <h1 className="mt-1 text-2xl font-bold">{otherName || "Connecting…"}</h1>
          <div className="mt-2 text-sm">
            {session ? (
              <span className="capitalize">{session.status}</span>
            ) : (
              <Loader2 className="inline h-4 w-4 animate-spin" />
            )}
          </div>
        </div>

        <div className="text-4xl font-mono">{fmt(elapsed)}</div>

        <div className="text-sm text-muted-foreground">
          Phone minutes remaining: <span className="font-semibold text-foreground">{remaining ?? "…"}</span>
        </div>

        <div className="flex justify-center gap-3">
          <Button
            type="button"
            variant={muted ? "secondary" : "outline"}
            size="lg"
            onClick={toggleMute}
            className="gap-2"
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            {muted ? "Muted" : "Mute"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={() => hangUp("user_ended")}
            disabled={ending}
            className="gap-2"
          >
            <PhoneOff className="h-5 w-5" /> End call
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Your phone number stays private. 18+ only.
        </p>
      </Card>
    </div>
  );
}
