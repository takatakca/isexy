import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Headphones, Inbox, Radio, Coins, Shield, ArrowLeft } from "lucide-react";

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

  const tiles = [
    { icon: Mic, title: "Your voice profile", desc: plProfile ? `Status: ${plProfile.status}` : "Not set up yet", to: "/phone-line/setup", primary: true },
    { icon: Headphones, title: "Browse voices", desc: "Listen to greetings (coming soon)", to: "#", disabled: true },
    { icon: Inbox, title: "Voice inbox", desc: "Your replies (coming soon)", to: "#", disabled: true },
    { icon: Radio, title: "Live singles line", desc: "Join the live room (coming soon)", to: "#", disabled: true },
    { icon: Coins, title: "Buy minutes", desc: "Top up phone & video minutes", to: "/buy-minutes" },
    { icon: Shield, title: "Safety & 18+", desc: "How we keep your number private", to: "/safety" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">ISEXY Phone Line</h1>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4">
        <section className="rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 p-5">
          <h2 className="text-2xl font-bold">Date by voice.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Record a short greeting, hear other singles, and connect — all without ever
            sharing your real phone number. Your privacy stays yours.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">
            Adults 18+ only
          </p>
        </section>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tiles.map((t) => {
              const Icon = t.icon;
              const inner = (
                <Card
                  className={`flex h-full items-start gap-3 p-4 transition ${
                    t.disabled ? "opacity-50" : "hover:border-primary/60 hover:shadow"
                  } ${t.primary ? "border-primary/40 bg-primary/5" : ""}`}
                >
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-sm text-muted-foreground">{t.desc}</div>
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

        {!plProfile && (
          <Button className="w-full" onClick={() => navigate("/phone-line/setup")}>
            Create your voice profile
          </Button>
        )}
      </main>
    </div>
  );
}
