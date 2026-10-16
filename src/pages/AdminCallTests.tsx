import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Phone,
  Play,
  Pause,
  Check,
  X,
  Mic,
  Video,
} from "lucide-react";

interface CallRow {
  id: string;
  call_type: string;
  provider: string;
  status: string;
  caller_profile_id: string | null;
  receiver_profile_id: string | null;
  provider_call_sid: string | null;
  duration_seconds: number;
  minutes_charged: number;
  end_reason: string | null;
  started_at: string;
  ended_at: string | null;
}

interface InAppCallRow {
  id: string;
  match_id: string;
  caller_id: string;
  receiver_id: string;
  call_type: string;
  status: string;
  created_at: string;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  credits_used: number | null;
  end_reason: string | null;
}

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

interface MinTxnRow {
  id: string;
  profile_id: string;
  call_session_id: string;
  call_type: string;
  minutes_charged: number;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

export default function AdminCallTests() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [inAppCalls, setInAppCalls] = useState<InAppCallRow[]>([]);
  const [txns, setTxns] = useState<MinTxnRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);

  useEffect(() => {
    void check();
  }, []);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  }, []);
  useEffect(() => () => stopAudio(), [stopAudio]);

  const check = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      navigate("/discover");
      return;
    }
    await Promise.all([fetchAll(), fetchLinkedPhone(user.id)]);
    setLoading(false);
  };

  const fetchLinkedPhone = async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof) return;
    const { data: numbers } = await supabase
      .from("phone_line_numbers")
      .select("phone_number_e164")
      .eq("profile_id", prof.id)
      .eq("phone_verified", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (numbers?.[0]) setLinkedPhone(numbers[0].phone_number_e164);
  };

  const linkPhone = async () => {
    const v = phoneInput.trim();
    if (!/^\+\d{7,16}$/.test(v)) {
      toast({ title: "Invalid format", description: "Use E.164, e.g. +15145551234", variant: "destructive" });
      return;
    }
    setLinking(true);
    const { data, error } = await supabase.rpc("link_my_phone_line_number", { p_phone_e164: v });
    setLinking(false);
    const res = data as { success?: boolean; error?: string; phone?: string } | null;
    if (error || !res?.success) {
      toast({ title: "Failed", description: error?.message || res?.error || "unknown", variant: "destructive" });
      return;
    }
    setLinkedPhone(res.phone ?? v);
    setPhoneInput("");
    toast({ title: "Linked", description: `${res.phone} is now verified for the IVR.` });
  };

  const fetchAll = async () => {
    setRefreshing(true);
    const [c, v, t, r] = await Promise.all([
      supabase
        .from("call_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50),
      supabase
        .from("video_call_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("call_minute_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("get_voice_greetings_for_review", { p_limit: 50 }),
    ]);
    setCalls((c.data as CallRow[]) ?? []);
    setInAppCalls((v.data as InAppCallRow[]) ?? []);
    setTxns((t.data as MinTxnRow[]) ?? []);
    setReviews((r.data as ReviewRow[]) ?? []);
    setReviewError(r.error ? r.error.message : null);
    setRefreshing(false);
  };

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

  const flagsForInApp = (c: InAppCallRow): string[] => {
    const flags: string[] = [];
    if ((c.credits_used ?? 0) > 0 && !c.connected_at) flags.push("charged_without_connect");
    if (["ended", "missed", "declined"].includes(c.status) && !c.ended_at) flags.push("missing_ended_at");
    if (["ringing", "connecting", "connected"].includes(c.status) && Date.now() - new Date(c.created_at).getTime() > 3 * 3600_000) {
      flags.push("stale_open_call");
    }
    const maxAllowed = Math.ceil((c.duration_seconds || 0) / 60) + 1;
    if ((c.credits_used ?? 0) > maxAllowed) flags.push("overcharged_vs_duration");
    return flags;
  };

  const flagsForCall = (c: CallRow): string[] => {
    const flags: string[] = [];
    if (c.minutes_charged > 0 && !["completed", "connected"].includes(c.status)) {
      flags.push("charged_without_connect");
    }
    if (c.status === "completed" && !c.ended_at) flags.push("missing_ended_at");
    if (c.status === "failed" && c.minutes_charged > 0) flags.push("failed_with_charges");
    if (["missed", "no-answer", "busy"].includes(c.status) && c.minutes_charged > 0) {
      flags.push("missed_with_charges");
    }
    const maxAllowed = Math.ceil((c.duration_seconds || 0) / 60) + 1;
    if (c.minutes_charged > maxAllowed) flags.push("overcharged_vs_duration");
    if (c.provider === "twilio" && !c.caller_profile_id) flags.push("twilio_no_profile");
    if (c.provider === "twilio" && c.status === "completed" && !c.ended_at) {
      flags.push("twilio_completed_no_end");
    }
    return flags;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Admin
          </Button>
          <h1 className="text-lg font-bold">Call tests</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={refreshing}>
          <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4">
        <Card data-testid="voice-review">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-4 w-4" /> Voice greetings to review ({reviews.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              New greetings are heard on the phone line only after approval. Reported greetings come
              back here.
            </p>
            {reviewError && <div className="text-sm text-destructive">Could not load the queue: {reviewError}</div>}
            {!reviewError && reviews.length === 0 && (
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> Link my phone for IVR test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Adds your cell number to <code>phone_line_numbers</code> as verified, so calling the
              ISEXY Twilio number from this phone reaches the IVR menu instead of the unknown-caller message.
            </p>
            {linkedPhone && (
              <div className="text-sm">
                Currently linked: <span className="font-mono">{linkedPhone}</span>{" "}
                <Badge variant="secondary">verified</Badge>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="+15145551234"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                disabled={linking}
              />
              <Button onClick={linkPhone} disabled={linking}>
                {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link & verify"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              E.164 format (must start with +). Use the same number you'll call from.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Phone Line calls ({calls.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {calls.length === 0 && (
              <div className="text-sm text-muted-foreground">No call sessions yet.</div>
            )}
            {calls.map((c) => {
              const flags = flagsForCall(c);
              return (
                <div key={c.id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{c.call_type}</Badge>
                    <Badge variant="secondary">{c.provider}</Badge>
                    <Badge>{c.status}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(c.started_at).toLocaleString()}
                    </span>
                    {flags.map((f) => (
                      <Badge key={f} variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> {f}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>caller: {c.caller_profile_id ?? "—"}</div>
                    <div>receiver: {c.receiver_profile_id ?? "—"}</div>
                    <div>duration: {c.duration_seconds}s</div>
                    <div>charged: {c.minutes_charged} min</div>
                    <div>end_reason: {c.end_reason ?? "—"}</div>
                    <div>ended_at: {c.ended_at ?? "—"}</div>
                    {c.provider_call_sid && <div className="sm:col-span-2">CallSid: {c.provider_call_sid}</div>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-4 w-4" /> Recent in-app calls ({inAppCalls.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inAppCalls.length === 0 && (
              <div className="text-sm text-muted-foreground">No in-app calls yet.</div>
            )}
            {inAppCalls.map((c) => {
              const flags = flagsForInApp(c);
              return (
                <div key={c.id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{c.call_type}</Badge>
                    <Badge>{c.status}</Badge>
                    <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                    {flags.map((f) => (
                      <Badge key={f} variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> {f}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>caller: {c.caller_id}</div>
                    <div>receiver: {c.receiver_id}</div>
                    <div>duration: {c.duration_seconds ?? 0}s</div>
                    <div>charged: {c.credits_used ?? 0} min</div>
                    <div>connected_at: {c.connected_at ?? "—"}</div>
                    <div>ended_at: {c.ended_at ?? "—"}</div>
                    <div>end_reason: {c.end_reason ?? "—"}</div>
                    <div>match: {c.match_id}</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent minute transactions ({txns.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {txns.length === 0 && (
              <div className="text-sm text-muted-foreground">No minute transactions yet.</div>
            )}
            {txns.map((t) => {
              const negative = t.balance_after < 0;
              return (
                <div key={t.id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t.call_type}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </span>
                    {negative && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> negative_balance
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>profile: {t.profile_id}</div>
                    <div>session: {t.call_session_id}</div>
                    <div>minutes: {t.minutes_charged}</div>
                    <div>
                      balance: {t.balance_before} → {t.balance_after}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
