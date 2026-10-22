import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Check, Mic, Pause, Play, RefreshCw, X } from "lucide-react";

interface ReviewRow {
  greeting_id: string;
  display_name: string;
  age: number;
  city: string | null;
  headline: string | null;
  profile_status: string;
  duration_seconds: number;
  report_count: number;
  moderation_status: string;
  created_at: string;
}

/**
 * Phone Line voice greetings waiting for review (new or reported). Admins and
 * moderators: get_voice_greetings_for_review / review_voice_greeting check
 * the role on the server, isexy-get-voice-greeting-url signs the audio for
 * staff only. Used by /admin/moderation (Voice tab) and /admin/call-tests.
 */
export function VoiceGreetingReviewQueue({ refreshKey = 0 }: { refreshKey?: number }) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }, []);
  useEffect(() => () => stopAudio(), [stopAudio]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await supabase.rpc("get_voice_greetings_for_review", { p_limit: 50 });
    setReviews((r.data as ReviewRow[]) ?? []);
    setReviewError(r.error ? r.error.message : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const playGreeting = async (id: string) => {
    if (playingId === id) return stopAudio();
    stopAudio();
    const { data, error } = await supabase.functions.invoke("isexy-get-voice-greeting-url", {
      body: { greeting_id: id },
    });
    if (error || !data?.signed_url) {
      toast({ title: "Can't play", description: error?.message ?? "No audio", variant: "destructive" });
      return;
    }
    const audio = new Audio(data.signed_url);
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    try {
      await audio.play();
      setPlayingId(id);
    } catch {
      toast({ title: "Can't play", description: "This browser can't play this file.", variant: "destructive" });
    }
  };

  const review = async (id: string, approve: boolean) => {
    setReviewing(id);
    const { data, error } = await supabase.rpc("review_voice_greeting", {
      p_greeting_id: id,
      p_approve: approve,
      p_reason: approve ? null : rejectReason[id]?.trim() || null,
    });
    setReviewing(null);
    const res = data as { success?: boolean; error?: string } | null;
    if (error || !res?.success) {
      toast({ title: "Not saved", description: error?.message || res?.error || "unknown", variant: "destructive" });
      return;
    }
    if (playingId === id) stopAudio();
    setReviews((prev) => prev.filter((x) => x.greeting_id !== id));
    toast({ title: approve ? "Approved" : "Rejected", description: approve ? "The greeting can be heard on the phone line." : "The member is asked to record again." });
  };

  return (
    <Card data-testid="voice-review">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Mic className="h-4 w-4" /> Voice greetings to review ({reviews.length})
          </span>
          <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh voice greetings">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          New greetings are heard on the phone line only after approval. Reported greetings come
          back here.
        </p>
        {reviewError && <div className="text-sm text-destructive">Could not load the queue: {reviewError}</div>}
        {!reviewError && !loading && reviews.length === 0 && (
          <div className="text-sm text-muted-foreground">Nothing to review.</div>
        )}
        {reviews.map((g) => (
          <div key={g.greeting_id} className="rounded border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => playGreeting(g.greeting_id)} aria-label={playingId === g.greeting_id ? `Pause ${g.display_name}` : `Play ${g.display_name}`}>
                {playingId === g.greeting_id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span className="font-semibold">
                {g.display_name}, {g.age}
                {g.city ? ` · ${g.city}` : ""}
              </span>
              <Badge variant="outline">{g.moderation_status}</Badge>
              <Badge variant="secondary">profile {g.profile_status}</Badge>
              {g.report_count > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {g.report_count} report{g.report_count === 1 ? "" : "s"}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {g.duration_seconds}s · {new Date(g.created_at).toLocaleString()}
              </span>
            </div>
            {g.headline && <div className="mt-1 text-muted-foreground">“{g.headline}”</div>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                className="h-8 max-w-xs"
                placeholder="Reason if rejected (shown to the member)"
                value={rejectReason[g.greeting_id] ?? ""}
                onChange={(e) => setRejectReason((prev) => ({ ...prev, [g.greeting_id]: e.target.value }))}
                maxLength={300}
              />
              <Button size="sm" onClick={() => review(g.greeting_id, true)} disabled={reviewing === g.greeting_id}>
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => review(g.greeting_id, false)} disabled={reviewing === g.greeting_id}>
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
