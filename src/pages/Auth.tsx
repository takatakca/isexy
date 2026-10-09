import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { TakatakSignIn } from "@/components/TakatakSignIn";

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
      <aside className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-end p-12">
        <img src="/images/hero-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" />
        <div className="relative text-white max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight mb-4">Real connections between Canada and Cuba.</h2>
          <p className="text-white/85 text-lg">Verified profiles, live translation, video calls and gifts that actually reach the people you care about.</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 h-16">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-foreground hover:opacity-70" aria-label="Go back">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <Logo size="sm" variant="dark" />
          <div className="w-10" />
        </header>

        <main className="flex-1 flex flex-col px-6 pb-28 lg:pb-10 w-full max-w-md mx-auto animate-fade-in">
          <h1 className="text-3xl font-extrabold text-foreground mt-4 mb-2">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {mode === "login" ? "Sign in to keep the conversation going." : "Join the #1 Canadian–Cuban dating community."}
          </p>

          <div role="tablist" className="grid grid-cols-2 p-1 rounded-full bg-muted mb-6">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`py-2.5 rounded-full text-sm font-semibold transition-all ${mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
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
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Link to="/cuban-signup" className="rounded-xl border border-border p-3 text-center hover:bg-muted transition-colors">🇨🇺 I live in Cuba</Link>
              <Link to="/tourist-signup" className="rounded-xl border border-border p-3 text-center hover:bg-muted transition-colors">✈️ I'm visiting Cuba</Link>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
