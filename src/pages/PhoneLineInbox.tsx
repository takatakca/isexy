import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Play, Pause, Flag, Ban } from "lucide-react";
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
        (profs ?? []).forEach((p) => nameMap.set(p.id, { first_name: p.first_name, city: p.city }));
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
        setReceived((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_read: true } : x)));
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

  const renderRow = (r: ReplyRow, isReceived: boolean) => (
    <Card key={r.id} className={`p-4 ${isReceived && !r.is_read ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {isReceived ? "From" : "To"} {r.other_first_name}
            {r.other_city ? ` · ${r.other_city}` : ""}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(r.created_at).toLocaleString()} · {r.duration_seconds}s
            {isReceived && !r.is_read && <span className="ml-2 font-semibold text-primary">NEW</span>}
          </div>
        </div>
        <Button
          size="sm"
          variant={playingId === r.id ? "secondary" : "default"}
          onClick={() => playReply(r, isReceived)}
          className="gap-2"
        >
          {playingId === r.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          Play
        </Button>
      </div>
      {isReceived && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" className="gap-1" onClick={() => navigate(`/block-report/${r.from_profile_id}`)}>
            <Flag className="h-3.5 w-3.5" /> Report
          </Button>
          <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => blockSender(r)}>
            <Ban className="h-3.5 w-3.5" /> Block
          </Button>
        </div>
      )}
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Voice inbox</h1>
      </header>

      <main className="mx-auto max-w-2xl p-4">
        <Tabs defaultValue="received">
          <TabsList className="mb-4">
            <TabsTrigger value="received">Received</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
          </TabsList>
          <TabsContent value="received" className="space-y-3">
            {loading ? (
              <div className="text-center text-muted-foreground">Loading…</div>
            ) : received.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">No voice replies yet.</Card>
            ) : (
              received.map((r) => renderRow(r, true))
            )}
          </TabsContent>
          <TabsContent value="sent" className="space-y-3">
            {loading ? (
              <div className="text-center text-muted-foreground">Loading…</div>
            ) : sent.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">You haven't sent any replies yet.</Card>
            ) : (
              sent.map((r) => renderRow(r, false))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
