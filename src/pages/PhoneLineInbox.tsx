import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Play, Pause, Flag, Ban, Inbox, SendHorizonal } from "lucide-react";
import { toast } from "sonner";

interface ReplyRow {
  id: string;
  from_profile_id: string;
  to_profile_id: string;
  duration_seconds: number;
  is_read: boolean;
  created_at: string;
  other_first_name?: string | null;
  other_city?: string | null;
}

export default function PhoneLineInbox() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [received, setReceived] = useState<ReplyRow[]>([]);
  const [sent, setSent] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return setLoading(false);

      const { data: rec } = await supabase
        .from("phone_line_voice_replies")
        .select("id, from_profile_id, to_profile_id, duration_seconds, is_read, created_at")
        .eq("to_profile_id", profile.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: snt } = await supabase
        .from("phone_line_voice_replies")
        .select("id, from_profile_id, to_profile_id, duration_seconds, is_read, created_at")
        .eq("from_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const otherIds = Array.from(
        new Set([
          ...(rec ?? []).map((r) => r.from_profile_id),
          ...(snt ?? []).map((r) => r.to_profile_id),
        ])
      );
      const nameMap = new Map<string, { first_name: string | null; city: string | null }>();
      if (otherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, first_name, city")
          .in("id", otherIds);
        (profs ?? []).forEach((p) =>
          nameMap.set(p.id, { first_name: p.first_name, city: p.city })
        );
      }

      setReceived(
        (rec ?? []).map((r) => ({
          ...r,
          other_first_name: nameMap.get(r.from_profile_id)?.first_name ?? "Someone",
          other_city: nameMap.get(r.from_profile_id)?.city ?? null,
        }))
      );
      setSent(
        (snt ?? []).map((r) => ({
          ...r,
          other_first_name: nameMap.get(r.to_profile_id)?.first_name ?? "Someone",
          other_city: nameMap.get(r.to_profile_id)?.city ?? null,
        }))
      );
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const playReply = async (r: ReplyRow, markRead: boolean) => {
    try {
      if (playingId === r.id && audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
        return;
      }
      const { data, error } = await supabase.functions.invoke("get-voice-reply-url", {
        body: { reply_id: r.id },
      });
      if (error || !data?.signed_url) throw new Error(error?.message ?? "Cannot load audio");
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(data.signed_url);
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      await audio.play();
      setPlayingId(r.id);

      if (markRead && !r.is_read) {
        await supabase.rpc("mark_voice_reply_read", { p_reply_id: r.id });
        setReceived((prev) =>
          prev.map((x) => (x.id === r.id ? { ...x, is_read: true } : x))
        );
      }
    } catch (e: any) {
      toast.error(e.message ?? "Could not play");
    }
  };

  const blockSender = async (r: ReplyRow) => {
    if (!profile?.id) return;
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: profile.id, blocked_id: r.from_profile_id });
    if (error) return toast.error(error.message);
    toast.success("User blocked");
    setReceived((prev) => prev.filter((x) => x.from_profile_id !== r.from_profile_id));
  };

  const renderRow = (r: ReplyRow, isReceived: boolean) => {
    const isPlaying = playingId === r.id;
    const unread = isReceived && !r.is_read;
    return (
      <Card
        key={r.id}
        className={`overflow-hidden rounded-2xl border-border/60 bg-card p-4 transition-all ${
          unread ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => playReply(r, isReceived)}
            aria-label={isPlaying ? "Pause" : "Play"}
            className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${
              isPlaying
                ? "bg-primary text-primary-foreground glow-primary"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {isPlaying && (
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            )}
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isReceived ? "From" : "To"}
              </span>
              <span className="font-bold truncate">
                {r.other_first_name}
                {r.other_city ? <span className="font-normal text-muted-foreground"> · {r.other_city}</span> : ""}
              </span>
              {unread && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  NEW
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()} · {r.duration_seconds}s
            </div>
          </div>
        </div>

        {isReceived && (
          <div className="mt-3 flex flex-wrap gap-1 border-t border-border/40 pt-3">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 rounded-full text-muted-foreground"
              onClick={() => navigate(`/block-report/${r.from_profile_id}`)}
            >
              <Flag className="h-3.5 w-3.5" /> Report
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 rounded-full text-destructive"
              onClick={() => blockSender(r)}
            >
              <Ban className="h-3.5 w-3.5" /> Block
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const emptyState = (kind: "received" | "sent") => (
    <Card className="flex flex-col items-center gap-3 rounded-2xl border-border/60 bg-card p-10 text-center">
      <div className="rounded-full bg-primary/10 p-4 text-primary">
        {kind === "received" ? <Inbox className="h-7 w-7" /> : <SendHorizonal className="h-7 w-7" />}
      </div>
      <div>
        <div className="font-bold">
          {kind === "received" ? "No voice replies yet" : "You haven't sent any replies yet"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {kind === "received"
            ? "When someone replies to your greeting, it'll show up here."
            : "Browse voices and send a voice reply to start a conversation."}
        </div>
      </div>
      {kind === "sent" && (
        <Button onClick={() => navigate("/phone-line/browse")} className="mt-2 rounded-full">
          Browse voices
        </Button>
      )}
    </Card>
  );

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
        <h1 className="text-lg font-extrabold tracking-tight">Voice inbox</h1>
      </header>

      <main className="mx-auto max-w-2xl p-4 pb-10">
        <Tabs defaultValue="received">
          <TabsList className="mb-4 rounded-full bg-card p-1">
            <TabsTrigger value="received" className="rounded-full">Received</TabsTrigger>
            <TabsTrigger value="sent" className="rounded-full">Sent</TabsTrigger>
          </TabsList>
          <TabsContent value="received" className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />
                ))}
              </div>
            ) : received.length === 0 ? (
              emptyState("received")
            ) : (
              received.map((r) => renderRow(r, true))
            )}
          </TabsContent>
          <TabsContent value="sent" className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />
                ))}
              </div>
            ) : sent.length === 0 ? (
              emptyState("sent")
            ) : (
              sent.map((r) => renderRow(r, false))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
