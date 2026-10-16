import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Mic,
  Headphones,
  Inbox,
  Radio,
  Coins,
  Shield,
  ArrowLeft,
  PhoneCall,
  Lock,
  Sparkles,
  Smartphone,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface PhoneLineProfileRow {
  id: string;
  status: string;
  is_public: boolean;
  display_name: string;
}

/** The ISEXY phone line number members call (build setting; the IVR card is hidden without it). */
const PHONE_LINE_NUMBER = (import.meta.env.VITE_PHONE_LINE_NUMBER as string | undefined)?.trim() || "";

const maskPhone = (e164: string) =>
  e164.length > 6 ? `${e164.slice(0, 2)}${"•".repeat(e164.length - 6)}${e164.slice(-4)}` : e164;

export default function PhoneLine() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [plProfile, setPlProfile] = useState<PhoneLineProfileRow | null>(null);
  const [greetingReview, setGreetingReview] = useState<string | null>(null);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkIssue, setLinkIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) {
        setLoading(false);
        return;
      }
      const [{ data }, { data: numbers }] = await Promise.all([
        supabase
          .from("phone_line_profiles")
          .select("id, status, is_public, display_name")
          .eq("profile_id", profile.id)
          .maybeSingle(),
        supabase
          .from("phone_line_numbers")
          .select("phone_number_e164")
          .eq("profile_id", profile.id)
          .eq("phone_verified", true)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);
      setPlProfile(data as PhoneLineProfileRow | null);
      setLinkedPhone(numbers?.[0]?.phone_number_e164 ?? null);
      if (data?.id) {
        const { data: g } = await supabase
          .from("voice_greetings")
          .select("moderation_status")
          .eq("phone_line_profile_id", data.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);
        setGreetingReview(g?.[0]?.moderation_status ?? null);
      }
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  /** Links the number confirmed by SMS at sign-in, so calling the phone line from it reaches the menu. */
  const linkPhone = async () => {
    setLinking(true);
    setLinkIssue(null);
    const { data, error } = await supabase.rpc("link_my_verified_phone");
    setLinking(false);
    const res = data as { success?: boolean; error?: string; phone_masked?: string } | null;
    if (error || !res?.success) {
      setLinkIssue(
        res?.error === "no_verified_phone"
          ? "Your account has no phone number confirmed by SMS code. Sign in with your phone number once, then link it here."
          : "Your number couldn't be linked. Try again in a moment.",
      );
      return;
    }
    setLinkedPhone(res.phone_masked ?? "linked");
    toast.success("Your phone number is linked to the phone line.");
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  const live = !!plProfile && plProfile.status === "active" && plProfile.is_public;

  const statusLabel = (() => {
    if (!plProfile) return "Not set up yet";
    const s = plProfile.status;
    if (s === "banned") return "Removed by moderation";
    if (live) {
      if (greetingReview === "approved") return "Live · receiving calls";
      if (greetingReview === "pending") return "Live · greeting waiting for review";
      if (greetingReview === "rejected") return "Greeting not approved · re-record";
      return "Live · record a greeting";
    }
    if (s === "paused") return "Paused · not visible";
    return "Draft · not live";
  })();

  const statusTone = (() => {
    if (!plProfile) return "bg-muted text-muted-foreground";
    const s = plProfile.status;
    if (s === "banned" || (live && greetingReview === "rejected"))
      return "bg-destructive/15 text-destructive border border-destructive/30";
    if (live && greetingReview === "approved")
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
    if (live) return "bg-primary/15 text-primary border border-primary/30";
    if (s === "paused") return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
    return "bg-muted text-muted-foreground border border-border";
  })();

  const tiles: Array<{
    icon: typeof Mic;
    title: string;
    desc: string;
    to: string;
    primary?: boolean;
    disabled?: boolean;
  }> = [
    {
      icon: Mic,
      title: "Your voice profile",
      desc: plProfile ? statusLabel : "Record a 90-second greeting",
      to: "/phone-line/setup",
      primary: true,
    },
    { icon: Headphones, title: "Browse voices", desc: "Listen to real greetings", to: "/phone-line/browse" },
    { icon: Inbox, title: "Voice inbox", desc: "Your received & sent replies", to: "/phone-line/inbox" },
    { icon: Radio, title: "Live chat line", desc: "Coming soon", to: "#", disabled: true },
    { icon: Coins, title: "Buy minutes", desc: "Top up phone & video minutes", to: "/buy-minutes" },
    { icon: Shield, title: "Safety & 18+", desc: "How we keep your number private", to: "/safety" },
  ];

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
        <h1 className="text-lg font-extrabold tracking-tight">Phone Line</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 pb-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-primary-light/20 blur-3xl" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> Voice-first conversations
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Meet by <span className="text-gradient">voice</span> first.
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Use voice to get comfortable before calling. Your real phone number stays private — always.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2.5 py-1 text-muted-foreground">
                <Lock className="h-3 w-3" /> Number stays private
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                18+ only
              </span>
            </div>

            {!loading && (
              <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${statusTone}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabel}
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tiles.map((t) => {
              const Icon = t.icon;
              const inner = (
                <Card
                  className={`group flex h-full items-start gap-3 rounded-2xl border-border/60 bg-card p-4 transition-all ${
                    t.disabled
                      ? "opacity-50"
                      : "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
                  } ${t.primary ? "border-primary/40 bg-gradient-to-br from-primary/10 to-transparent" : ""}`}
                >
                  <div
                    className={`rounded-xl p-2.5 ${
                      t.primary
                        ? "bg-primary text-primary-foreground glow-primary"
                        : "bg-primary/10 text-primary"
                    } transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{t.title}</div>
                    <div className="text-sm text-muted-foreground truncate">{t.desc}</div>
                  </div>
                </Card>
              );
              return t.disabled ? (
                <div key={t.title}>{inner}</div>
              ) : (
                <Link key={t.title} to={t.to} className="block">
                  {inner}
                </Link>
              );
            })}
          </div>
        )}

        {!loading && PHONE_LINE_NUMBER && (
          <Card className="space-y-3 rounded-2xl border-border/60 bg-card p-4" data-testid="phone-line-ivr">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold">Use the phone line by phone</div>
                <div className="text-sm text-muted-foreground">
                  Call{" "}
                  <a href={`tel:${PHONE_LINE_NUMBER.replace(/[^\d+]/g, "")}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                    {PHONE_LINE_NUMBER}
                  </a>{" "}
                  to listen to voices and hear how many voice replies and minutes you have. It answers only your linked number, and your number is never shown to anyone.
                </div>
              </div>
            </div>
            {linkedPhone ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>
                  Linked: <span className="font-mono">{linkedPhone.startsWith("+") ? maskPhone(linkedPhone) : linkedPhone}</span>
                </span>
              </div>
            ) : (
              <Button onClick={linkPhone} disabled={linking} variant="outline" className="w-full gap-2 rounded-full">
                {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
                Link my phone number
              </Button>
            )}
            {linkIssue && (
              <p role="alert" className="text-sm text-destructive">
                {linkIssue}
              </p>
            )}
          </Card>
        )}

        {!loading && !plProfile && (
          <button
            onClick={() => navigate("/phone-line/setup")}
            className="cta-primary w-full"
          >
            <PhoneCall className="h-4 w-4" />
            Create your voice profile
          </button>
        )}

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Block or report anyone who makes you uncomfortable.
        </p>
      </main>
    </div>
  );
}
