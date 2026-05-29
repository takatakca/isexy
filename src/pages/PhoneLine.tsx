import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";

interface PhoneLineProfileRow {
  id: string;
  status: string;
  is_public: boolean;
  display_name: string;
}

export default function PhoneLine() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [plProfile, setPlProfile] = useState<PhoneLineProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profile?.id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("phone_line_profiles")
        .select("id, status, is_public, display_name")
        .eq("profile_id", profile.id)
        .maybeSingle();
      setPlProfile(data as PhoneLineProfileRow | null);
      setLoading(false);
    };
    load();
  }, [profile?.id]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const statusLabel = (() => {
    if (!plProfile) return "Not set up yet";
    const s = plProfile.status;
    if (s === "active" && plProfile.is_public) return "Live · receiving calls";
    if (s === "paused") return "Paused · not visible";
    if (s === "pending") return "Pending review";
    if (s === "rejected") return "Rejected · please re-record";
    return "Draft · not live";
  })();

  const statusTone = (() => {
    if (!plProfile) return "bg-muted text-muted-foreground";
    const s = plProfile.status;
    if (s === "active" && plProfile.is_public)
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
    if (s === "paused") return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
    if (s === "rejected") return "bg-destructive/15 text-destructive border border-destructive/30";
    if (s === "pending") return "bg-primary/15 text-primary border border-primary/30";
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
    { icon: Radio, title: "Live singles line", desc: "Coming soon", to: "#", disabled: true },
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
              <Sparkles className="h-3 w-3" /> Voice-first dating
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
