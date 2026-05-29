import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Save,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
} from "lucide-react";
import { toast } from "sonner";

const MAX_SECONDS = 90;

// Production-safe: greetings save as `pending` and only show publicly once approved.
// To re-enable auto-approve for staging, set VITE_AUTO_APPROVE_VOICE_GREETINGS=true.
const AUTO_APPROVE_VOICE_GREETINGS =
  import.meta.env.VITE_AUTO_APPROVE_VOICE_GREETINGS === "true";

interface PLProfile {
  id: string;
  display_name: string;
  age: number;
  city: string | null;
  gender: string | null;
  headline: string | null;
  status: string;
  is_public: boolean;
  last_active_at: string | null;
}

interface Greeting {
  id: string;
  audio_url: string;
  duration_seconds: number;
  is_active: boolean;
  moderation_status?: string;
}

export default function PhoneLineSetup() {
  const { user, profile, photoCount } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plProfile, setPlProfile] = useState<PLProfile | null>(null);
  const [greeting, setGreeting] = useState<Greeting | null>(null);
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);

  // form
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState("");
  const [headline, setHeadline] = useState("");

  // recorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // -------- load existing data --------
  useEffect(() => {
    const load = async () => {
      if (!profile?.id) {
        setLoading(false);
        return;
      }
      const { data: pl } = await supabase
        .from("phone_line_profiles")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (pl) {
        setPlProfile(pl as PLProfile);
        setDisplayName(pl.display_name);
        setAge(pl.age);
        setCity(pl.city ?? "");
        setGender(pl.gender ?? "");
        setHeadline(pl.headline ?? "");

        const { data: g } = await supabase
          .from("voice_greetings")
          .select("id, audio_url, duration_seconds, is_active, moderation_status")
          .eq("phone_line_profile_id", pl.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (g) {
          setGreeting(g as Greeting);
          const { data: signed } = await supabase.storage
            .from("voice-greetings")
            .createSignedUrl(g.audio_url, 3600);
          if (signed) setSignedAudioUrl(signed.signedUrl);
        }
      } else {
        setDisplayName(profile.first_name ?? "");
        if (profile.birth_date) {
          const yrs = Math.floor(
            (Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)
          );
          setAge(yrs);
        }
        setCity(profile.city ?? "");
        setGender(profile.gender ?? "");
      }
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  // -------- gating --------
  if (!user) {
    navigate("/auth");
    return null;
  }

  const ageOk = typeof age === "number" && age >= 18;
  const profileComplete = !!profile?.first_name && !!profile?.birth_date && !!profile?.gender;
  const hasPhoto = photoCount > 0;
  const canActivate = ageOk && profileComplete && hasPhoto;

  // -------- recording --------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
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
          if (next >= MAX_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      toast.error("Microphone permission denied");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const reRecord = () => {
    setRecordedBlob(null);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setElapsed(0);
  };

  // -------- save --------
  const saveProfile = async (activate: boolean) => {
    if (!profile?.id || !user) return;
    if (!displayName.trim()) return toast.error("Display name is required");
    if (!ageOk) return toast.error("You must be 18 or older");
    if (activate && !canActivate)
      return toast.error("Complete your main profile and add a photo first");

    setSaving(true);
    try {
      const status = activate ? "active" : plProfile?.status === "active" ? "active" : "draft";
      const payload = {
        profile_id: profile.id,
        display_name: displayName.trim(),
        age: age as number,
        city: city.trim() || null,
        gender: gender || null,
        headline: headline.trim() || null,
        status,
        is_public: activate ? true : plProfile?.is_public ?? false,
        last_active_at: activate ? new Date().toISOString() : plProfile?.last_active_at ?? null,
      };

      let plId = plProfile?.id;
      if (plId) {
        const { error } = await supabase.from("phone_line_profiles").update(payload).eq("id", plId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("phone_line_profiles")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        plId = data.id;
      }

      if (recordedBlob && plId) {
        const path = `${user.id}/${plId}-${Date.now()}.webm`;
        const { error: upErr } = await supabase.storage
          .from("voice-greetings")
          .upload(path, recordedBlob, { contentType: "audio/webm", upsert: false });
        if (upErr) throw upErr;

        await supabase
          .from("voice_greetings")
          .update({ is_active: false })
          .eq("phone_line_profile_id", plId);

        const { error: insErr } = await supabase.from("voice_greetings").insert({
          phone_line_profile_id: plId,
          profile_id: profile.id,
          audio_url: path,
          duration_seconds: Math.max(1, Math.min(elapsed || 1, MAX_SECONDS)),
          is_active: true,
          moderation_status: AUTO_APPROVE_VOICE_GREETINGS ? "approved" : "pending",
        });
        if (insErr) throw insErr;
      }

      if (recordedBlob && !AUTO_APPROVE_VOICE_GREETINGS) {
        toast.success("Your greeting was saved and is pending review.");
      } else {
        toast.success(activate ? "Your greeting is live." : "Saved as draft.");
      }
      navigate("/phone-line");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const pauseLine = async () => {
    if (!plProfile?.id) return;
    const { error } = await supabase
      .from("phone_line_profiles")
      .update({ status: "paused", is_public: false })
      .eq("id", plProfile.id);
    if (error) return toast.error(error.message);
    toast.success("Voice profile paused");
    setPlProfile({ ...plProfile, status: "paused", is_public: false });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  }

  // ---- moderation banner ----
  const modStatus = greeting?.moderation_status;
  let modBanner: { icon: typeof CheckCircle2; tone: string; label: string; desc: string } | null = null;
  if (greeting) {
    if (plProfile?.status === "paused") {
      modBanner = {
        icon: PauseCircle,
        tone: "border-amber-500/40 bg-amber-500/10 text-amber-200",
        label: "Paused",
        desc: "Your voice profile is hidden until you go live again.",
      };
    } else if (modStatus === "pending") {
      modBanner = {
        icon: Clock,
        tone: "border-primary/40 bg-primary/10 text-primary",
        label: "Pending review",
        desc: "We review every greeting to keep things safe. Usually under 24h.",
      };
    } else if (modStatus === "rejected") {
      modBanner = {
        icon: AlertTriangle,
        tone: "border-destructive/40 bg-destructive/10 text-destructive",
        label: "Rejected",
        desc: "This greeting wasn't approved. Please re-record following the guidelines.",
      };
    } else if (modStatus === "approved" && plProfile?.status === "active") {
      modBanner = {
        icon: CheckCircle2,
        tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
        label: "Live",
        desc: "Your greeting is approved and visible on the phone line.",
      };
    }
  }

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
        <h1 className="text-lg font-extrabold tracking-tight">Voice profile</h1>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 p-4 pb-10">
        {!canActivate && (
          <Card className="flex items-start gap-3 rounded-2xl border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              To go live on the phone line you must be 18+, complete your main profile, and add at
              least one photo.
            </span>
          </Card>
        )}

        {modBanner && (
          <Card className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${modBanner.tone}`}>
            <modBanner.icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <div className="font-bold">{modBanner.label}</div>
              <div className="opacity-90">{modBanner.desc}</div>
            </div>
          </Card>
        )}

        <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5">
          <h2 className="font-bold">About you</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dn">Display name</Label>
              <Input
                id="dn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={18}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <Input
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                maxLength={30}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="headline">Headline</Label>
            <Textarea
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={140}
              placeholder="One line that makes someone want to hear your voice"
            />
          </div>
        </Card>

        {/* Recorder */}
        <Card className="relative space-y-4 overflow-hidden rounded-2xl border-border/60 bg-card p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <h2 className="font-bold">Your voice greeting</h2>
            <span className="text-xs text-muted-foreground">max {MAX_SECONDS}s</span>
          </div>

          {greeting && !recordedBlob && signedAudioUrl && (
            <div className="relative rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current greeting · {greeting.duration_seconds}s
              </div>
              <audio src={signedAudioUrl} controls className="w-full" />
            </div>
          )}

          {/* Big mic circle */}
          <div className="relative flex flex-col items-center gap-4 py-4">
            <div className="relative">
              {recording && (
                <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-primary/40" />
              )}
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={!!recordedBlob}
                aria-label={recording ? "Stop recording" : "Start recording"}
                className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-transform active:scale-95 ${
                  recording
                    ? "bg-destructive text-white"
                    : recordedBlob
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary text-primary-foreground glow-primary"
                } disabled:cursor-not-allowed`}
              >
                {recording ? <Square className="h-9 w-9" /> : <Mic className="h-9 w-9" />}
              </button>
            </div>
            <div className="text-center">
              <div className="font-mono text-2xl font-bold tabular-nums">
                {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
              </div>
              <div className="text-xs text-muted-foreground">
                {recording
                  ? "Recording…"
                  : recordedBlob
                  ? "Preview your recording"
                  : greeting
                  ? "Tap to re-record"
                  : "Tap to start recording"}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (elapsed / MAX_SECONDS) * 100)}%` }}
              />
            </div>
          </div>

          {!recording && recordedBlob && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={togglePlay} variant="secondary" className="gap-2 rounded-full">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? "Pause" : "Play preview"}
              </Button>
              <Button onClick={reRecord} variant="outline" className="gap-2 rounded-full">
                <RotateCcw className="h-4 w-4" /> Re-record
              </Button>
            </div>
          )}

          {recordedUrl && (
            <audio
              ref={audioRef}
              src={recordedUrl}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          )}
        </Card>

        {/* Actions */}
        <div className="sticky bottom-0 -mx-4 border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl safe-bottom">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => saveProfile(false)}
              variant="outline"
              disabled={saving}
              className="flex-1 gap-2 rounded-full"
            >
              <Save className="h-4 w-4" /> Save draft
            </Button>
            <Button
              onClick={() => saveProfile(true)}
              disabled={saving || !canActivate}
              className="flex-1 gap-2 rounded-full bg-primary text-primary-foreground hover:brightness-110"
            >
              <Mic className="h-4 w-4" /> Go live
            </Button>
            {plProfile?.status === "active" && (
              <Button
                onClick={pauseLine}
                variant="ghost"
                disabled={saving}
                className="w-full rounded-full text-muted-foreground"
              >
                Pause my line
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Your phone number stays private. By going live you confirm you are 18+ and agree to ISEXY's
          community guidelines.
        </p>
      </main>
    </div>
  );
}
