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
import { ArrowLeft, Play, Pause, Mic, Square, RotateCcw, Send, Flag, Ban, Phone } from "lucide-react";
import { toast } from "sonner";

const MAX_REPLY_SECONDS = 90;
const AUTO_APPROVE_VOICE_REPLIES = true;

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
      // 1. fetch active public phone-line profiles (excluding self)
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

      // 2. fetch latest approved active greetings for these profiles
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

      // 3. fetch blocks (either direction)
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

      // light suppression — use profileIds variable so TS doesn't complain
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

  // ------ reply recorder ------
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Browse voices</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <p className="text-xs text-muted-foreground">
          Listen to real voices first. Your real phone number stays private. 18+ only.
        </p>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading voices…</div>
        ) : items.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No voice profiles available right now. Check back soon.
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((g) => {
              const isPlaying = playingId === g.greeting_id;
              return (
                <Card key={g.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {g.display_name}, {g.age}
                        {g.city ? ` · ${g.city}` : ""}
                      </div>
                      {g.headline && (
                        <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {g.headline}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => playGreeting(g)}
                      variant={isPlaying ? "secondary" : "default"}
                      size="sm"
                      className="gap-2"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {g.greeting_duration}s
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openReply(g)}>
                      <Mic className="h-3.5 w-3.5" /> Voice reply
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => reportUser(g)}>
                      <Flag className="h-3.5 w-3.5" /> Report
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => blockUser(g)}>
                      <Ban className="h-3.5 w-3.5" /> Block
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Reply dialog */}
      <Dialog open={!!replyTo} onOpenChange={(o) => !o && setReplyTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice reply to {replyTo?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Up to {MAX_REPLY_SECONDS} seconds. Your real number stays private.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {!recording && !recordedBlob && (
                <Button onClick={startRec} className="gap-2">
                  <Mic className="h-4 w-4" /> Record
                </Button>
              )}
              {recording && (
                <Button onClick={stopRec} variant="destructive" className="gap-2">
                  <Square className="h-4 w-4" /> Stop ({elapsed}s / {MAX_REPLY_SECONDS}s)
                </Button>
              )}
              {!recording && recordedBlob && recordedUrl && (
                <>
                  <audio src={recordedUrl} controls className="w-full" />
                  <Button
                    onClick={() => {
                      setRecordedBlob(null);
                      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                      setRecordedUrl(null);
                      setElapsed(0);
                    }}
                    variant="outline"
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" /> Re-record
                  </Button>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplyTo(null)}>
              Cancel
            </Button>
            <Button onClick={sendReply} disabled={!recordedBlob || sending} className="gap-2">
              <Send className="h-4 w-4" /> Send reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
