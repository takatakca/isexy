import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Play,
  Pause,
  Mic,
  Square,
  RotateCcw,
  Send,
  Flag,
  Ban,
  Phone,
  Headphones,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

const MAX_REPLY_SECONDS = 90;
const AUTO_APPROVE_VOICE_REPLIES =
  import.meta.env.VITE_AUTO_APPROVE_VOICE_REPLIES === "true";

interface PLProfile {
  id: string;
  profile_id: string;
  display_name: string;
  age: number;
  city: string | null;
  headline: string | null;
  greeting_id: string;
  greeting_duration: number;
}

export default function PhoneLineBrowse() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<PLProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // reply modal
  const [replyTo, setReplyTo] = useState<PLProfile | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) {
        setLoading(false);
        return;
      }
      const { data: profs } = await supabase
        .from("phone_line_profiles")
        .select("id, profile_id, display_name, age, city, headline")
        .eq("status", "active")
        .eq("is_public", true)
        .neq("profile_id", profile.id)
        .order("last_active_at", { ascending: false, nullsFirst: false })
        .limit(60);

      if (!profs || profs.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const plIds = profs.map((p) => p.id);
      const profileIds = profs.map((p) => p.profile_id);

      const { data: greetings } = await supabase
        .from("voice_greetings")
        .select("id, phone_line_profile_id, duration_seconds, created_at")
        .in("phone_line_profile_id", plIds)
        .eq("moderation_status", "approved")
        .eq("is_active", true)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

      const greetingByPl = new Map<string, { id: string; duration: number }>();
      (greetings ?? []).forEach((g) => {
        if (!greetingByPl.has(g.phone_line_profile_id)) {
          greetingByPl.set(g.phone_line_profile_id, {
            id: g.id,
            duration: g.duration_seconds,
          });
        }
      });

      const { data: blocks } = await supabase
        .from("blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${profile.id},blocked_id.eq.${profile.id}`);
      const blockedSet = new Set<string>();
      (blocks ?? []).forEach((b) => {
        if (b.blocker_id === profile.id) blockedSet.add(b.blocked_id);
        if (b.blocked_id === profile.id) blockedSet.add(b.blocker_id);
      });

      const result: PLProfile[] = profs
        .filter((p) => greetingByPl.has(p.id) && !blockedSet.has(p.profile_id))
        .map((p) => {
          const g = greetingByPl.get(p.id)!;
          return {
            id: p.id,
            profile_id: p.profile_id,
            display_name: p.display_name,
            age: p.age,
            city: p.city,
            headline: p.headline,
            greeting_id: g.id,
            greeting_duration: g.duration,
          };
        });

      void profileIds;

      setItems(result);
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const playGreeting = async (g: PLProfile) => {
    try {
      if (playingId === g.greeting_id && audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
        return;
      }
      const { data, error } = await supabase.functions.invoke("get-voice-greeting-url", {
        body: { greeting_id: g.greeting_id },
      });
      if (error || !data?.signed_url) throw new Error(error?.message ?? "Cannot load audio");
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(data.signed_url);
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      await audio.play();
      setPlayingId(g.greeting_id);
    } catch (e: any) {
      toast.error(e.message ?? "Could not play greeting");
    }
  };

  const openReply = (g: PLProfile) => {
    setReplyTo(g);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsed(0);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          if (next >= MAX_REPLY_SECONDS) stopRec();
          return next;
        });
      }, 1000);
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  const stopRec = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const sendReply = async () => {
    if (!profile?.id || !user || !replyTo || !recordedBlob) return;
    setSending(true);
    try {
      const path = `${user.id}/${replyTo.id}-${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage
        .from("voice-replies")
        .upload(path, recordedBlob, { contentType: "audio/webm", upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("phone_line_voice_replies").insert({
        from_profile_id: profile.id,
        to_profile_id: replyTo.profile_id,
        greeting_id: replyTo.greeting_id,
        audio_url: path,
        duration_seconds: Math.max(1, Math.min(elapsed || 1, MAX_REPLY_SECONDS)),
        moderation_status: AUTO_APPROVE_VOICE_REPLIES ? "approved" : "pending",
      });
      if (insErr) throw insErr;

      toast.success("Voice reply sent.");
      setReplyTo(null);
      setRecordedBlob(null);
      setRecordedUrl(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const blockUser = async (g: PLProfile) => {
    if (!profile?.id) return;
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: profile.id, blocked_id: g.profile_id });
    if (error) return toast.error(error.message);
    toast.success("User blocked");
    setItems((prev) => prev.filter((x) => x.id !== g.id));
  };

  const reportUser = (g: PLProfile) => {
    navigate(`/block-report/${g.profile_id}`);
  };

  const callVoice = async (g: PLProfile) => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
    }
    const { data, error } = await supabase.rpc("start_phone_line_call_session", {
      p_target_profile_id: g.profile_id,
      p_call_type: "phone_line_profile",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const r = data as { success: boolean; error?: string; call_session_id?: string };
    if (!r?.success) {
      if (r?.error === "no_minutes") {
        toast.error("You need phone minutes to call.");
        navigate("/buy-minutes");
        return;
      }
      if (r?.error === "blocked") return toast.error("This user is unavailable.");
      if (r?.error === "age_restricted") return toast.error("18+ only.");
      if (r?.error === "incomplete_profile") return toast.error("Complete your profile first.");
      if (r?.error === "voice_profile_unavailable") return toast.error("Voice profile not available.");
      return toast.error(r?.error ?? "Could not start call");
    }
    navigate(`/phone-line/call/${r.call_session_id}`);
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="rounded-full p-2 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Browse voices</h1>
          <p className="text-[11px] text-muted-foreground">Tap play to listen</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-10">
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-primary" />
          Your real phone number stays private. 18+ only.
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-card" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 rounded-2xl border-border/60 bg-card p-10 text-center">
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <Headphones className="h-7 w-7" />
            </div>
            <div>
              <div className="font-bold">No voice profiles available right now.</div>
              <div className="mt-1 text-sm text-muted-foreground">Check back soon.</div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((g) => {
              const isPlaying = playingId === g.greeting_id;
              return (
                <Card
                  key={g.id}
                  className="overflow-hidden rounded-2xl border-border/60 bg-card p-4 transition-all hover:border-primary/40"
                >
                  <div className="flex items-start gap-3">
                    {/* Play circle */}
                    <button
                      onClick={() => playGreeting(g)}
                      aria-label={isPlaying ? "Pause greeting" : "Play greeting"}
                      className={`relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${
                        isPlaying
                          ? "bg-primary text-primary-foreground glow-primary"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                    >
                      {isPlaying && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                      )}
                      {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold">
                          {g.display_name}, {g.age}
                        </div>
                        {g.city && (
                          <span className="text-xs text-muted-foreground">· {g.city}</span>
                        )}
                      </div>
                      {g.headline && (
                        <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {g.headline}
                        </div>
                      )}
                      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary/80">
                        {g.greeting_duration}s greeting
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border/40 pt-3">
                    <Button
                      size="sm"
                      onClick={() => callVoice(g)}
                      className="gap-1.5 rounded-full bg-primary text-primary-foreground hover:brightness-110"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 rounded-full"
                      onClick={() => openReply(g)}
                    >
                      <Mic className="h-3.5 w-3.5" /> Voice reply
                    </Button>
                    <div className="ml-auto flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 rounded-full text-muted-foreground"
                        onClick={() => reportUser(g)}
                      >
                        <Flag className="h-3.5 w-3.5" /> Report
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 rounded-full text-destructive"
                        onClick={() => blockUser(g)}
                      >
                        <Ban className="h-3.5 w-3.5" /> Block
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Reply dialog */}
      <Dialog open={!!replyTo} onOpenChange={(o) => !o && setReplyTo(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Voice reply to {replyTo?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Up to {MAX_REPLY_SECONDS} seconds. Your real number stays private.
            </p>

            <div className="flex flex-col items-center gap-3 py-2">
              <div className="relative">
                {recording && (
                  <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-primary/40" />
                )}
                <button
                  type="button"
                  onClick={recording ? stopRec : startRec}
                  disabled={!!recordedBlob}
                  aria-label={recording ? "Stop recording" : "Start recording"}
                  className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-transform active:scale-95 ${
                    recording
                      ? "bg-destructive text-white"
                      : recordedBlob
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground glow-primary"
                  } disabled:cursor-not-allowed`}
                >
                  {recording ? <Square className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                </button>
              </div>
              <div className="font-mono text-xl font-bold tabular-nums">
                {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
              </div>
              <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (elapsed / MAX_REPLY_SECONDS) * 100)}%` }}
                />
              </div>
            </div>

            {!recording && recordedBlob && recordedUrl && (
              <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
                <audio src={recordedUrl} controls className="w-full" />
                <Button
                  onClick={() => {
                    setRecordedBlob(null);
                    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                    setRecordedUrl(null);
                    setElapsed(0);
                  }}
                  variant="outline"
                  className="w-full gap-2 rounded-full"
                >
                  <RotateCcw className="h-4 w-4" /> Re-record
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplyTo(null)} className="rounded-full">
              Cancel
            </Button>
            <Button
              onClick={sendReply}
              disabled={!recordedBlob || sending}
              className="gap-2 rounded-full bg-primary text-primary-foreground hover:brightness-110"
            >
              <Send className="h-4 w-4" /> Send reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
