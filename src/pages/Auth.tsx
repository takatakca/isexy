import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Flame, Languages, ShieldCheck, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TakatakByline } from "@/components/SiteFooter";
import { TakatakSignIn } from "@/components/TakatakSignIn";
import { goBack } from "@/lib/navigation";

type Mode = "login" | "signup";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "signup" : "login");

  const from = (location.state as { from?: string } | null)?.from;
  const redirectTo = from && from !== "/auth" ? from : "/discover";

  useEffect(() => {
    // ProtectedRoute sends users with an incomplete profile to /profile-setup.
    if (!loading && user) navigate(redirectTo, { replace: true });
  }, [user, loading, navigate, redirectTo]);

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Brand panel (desktop) */}
      <aside className="hidden lg:flex lg:w-[46%] xl:w-1/2 brand-ambient relative overflow-hidden flex-col justify-between p-12 border-r border-foreground/[0.06]">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(hsl(var(--muted-foreground)/0.22)_1px,transparent_1.5px)] [background-size:26px_26px]" aria-hidden />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl gradient-glow shadow-glow" aria-hidden>
            <Flame className="h-5 w-5 text-white" strokeWidth={2.4} />
          </span>
          <span className="font-display text-xl font-extrabold tracking-[0.08em]">ISEXY</span>
        </div>
        <div className="relative max-w-md">
          <p className="eyebrow">Social network · 18+</p>
          <h2 className="type-title mt-4 text-4xl xl:text-5xl">Meet new people. <span className="text-gradient">Make real friends.</span></h2>
          <ul className="mt-8 space-y-4">
            {[
              [ShieldCheck, "Verified profiles", "Members confirm who they are."],
              [Languages, "Live translation", "Chat in English or French, read in yours."],
              [Video, "Calls when you're ready", "Phone and video, right in the app."],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <li key={title as string} className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30"><I className="h-5 w-5 text-primary" /></span>
                  <span>
                    <span className="block font-semibold text-foreground">{title as string}</span>
                    <span className="block text-sm text-muted-foreground">{body as string}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <TakatakByline className="relative" />
      </aside>

      <div className="flex-1 flex flex-col relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(40rem_16rem_at_50%_-20%,hsl(var(--primary)/0.25),transparent_70%)] lg:hidden" aria-hidden />
        <header className="relative flex items-center justify-between px-3 pb-1" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <button onClick={() => goBack(navigate, "/")} className="flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-secondary transition-colors" aria-label="Go back">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg gradient-glow" aria-hidden>
              <Flame className="h-4 w-4 text-white" strokeWidth={2.4} />
            </span>
            <span className="font-display font-extrabold tracking-[0.08em]">ISEXY</span>
          </div>
          <div className="w-11" />
        </header>

        <main className="relative flex-1 flex flex-col px-6 pb-28 lg:pb-10 lg:justify-center w-full max-w-md mx-auto animate-fade-in">
          <p className="eyebrow mt-6 lg:mt-0">{mode === "login" ? "Takatak Auth · no password" : "Free · adults 18+"}</p>
          <h1 className="type-title mt-3 mb-2 text-foreground">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-muted-foreground mb-7">
            {mode === "login" ? "Sign in to keep the conversation going." : "Join a social community for adults (18+) across Canada and Cuba."}
          </p>

          <div role="tablist" className="grid grid-cols-2 p-1 rounded-full bg-card border border-foreground/[0.08] mb-6">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-11 rounded-full text-sm font-semibold transition-all ${mode === m ? "bg-primary text-primary-foreground shadow-button" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <TakatakSignIn
            key={mode}
            intent={mode}
            redirectPath={redirectTo}
            defaultMethod={searchParams.get("method") === "phone" ? "phone" : "email"}
          />

          {mode === "signup" && (
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Link to="/cuban-signup" className="min-h-12 flex items-center justify-center rounded-2xl border border-foreground/10 bg-card/60 p-3 text-center hover:border-primary/50 hover:bg-secondary transition-colors">🇨🇺 I live in Cuba</Link>
              <Link to="/tourist-signup" className="min-h-12 flex items-center justify-center rounded-2xl border border-foreground/10 bg-card/60 p-3 text-center hover:border-primary/50 hover:bg-secondary transition-colors">✈️ I'm visiting Cuba</Link>
            </div>
          )}

          <TakatakByline className="mt-10 text-center lg:hidden" />
        </main>
      </div>
    </div>
  );
}
