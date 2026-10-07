import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, Mail, Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().trim().email("Enter a valid email address");
const loginPasswordSchema = z.string().min(6, "Password must be at least 6 characters");
const signupPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

type Mode = "login" | "signup";

function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["bg-destructive", "bg-destructive", "bg-yellow-500", "bg-emerald-500", "bg-emerald-600"];

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user, loading } = useAuth();

  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; terms?: string; form?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;
  const redirectTo = from && from !== "/auth" ? from : "/discover";

  useEffect(() => {
    // ProtectedRoute sends users with an incomplete profile to /profile-setup.
    if (!loading && user) navigate(redirectTo, { replace: true });
  }, [user, loading, navigate, redirectTo]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
  };

  const validate = () => {
    const next: typeof errors = {};
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) next.email = emailResult.error.errors[0].message;
    const pwResult = (mode === "signup" ? signupPasswordSchema : loginPasswordSchema).safeParse(password);
    if (!pwResult.success) next.password = pwResult.error.errors[0].message;
    if (mode === "signup" && !acceptedTerms) next.terms = "Please confirm you're 18+ and accept the terms";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);

    if (mode === "login") {
      const { error } = await signIn(email, password, { silent: true });
      if (error) setErrors({ form: error.message });
      else toast.success("Welcome back!");
    } else {
      const { error, needsConfirmation } = await signUp(email, password, { silent: true });
      if (error) setErrors({ form: error.message });
      else if (needsConfirmation) setConfirmationSentTo(email.trim().toLowerCase());
      else toast.success("Account created — let's build your profile!");
    }

    setIsSubmitting(false);
  };

  const resendConfirmation = async () => {
    if (!confirmationSentTo) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: confirmationSentTo,
      options: { emailRedirectTo: `${window.location.origin}/profile-setup` },
    });
    setResending(false);
    if (error) toast.error("Couldn't resend right now. Try again in a minute.");
    else toast.success("Confirmation email sent again.");
  };

  if (confirmationSentTo) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-3">Check your inbox</h1>
          <p className="text-muted-foreground mb-1">We sent a confirmation link to</p>
          <p className="font-semibold text-foreground mb-6 break-all">{confirmationSentTo}</p>
          <p className="text-sm text-muted-foreground mb-8">
            Tap the link to activate your account. Can't find it? Check your spam or promotions folder.
          </p>
          <button
            onClick={resendConfirmation}
            disabled={resending}
            className="w-full py-4 rounded-full border border-border font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend email"}
          </button>
          <button
            onClick={() => { setConfirmationSentTo(null); switchMode("login"); }}
            className="mt-4 text-primary font-semibold"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const strength = passwordScore(password);

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
                onClick={() => switchMode(m)}
                className={`py-2.5 rounded-full text-sm font-semibold transition-all ${mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {m === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined, form: undefined })); }}
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                className={`w-full h-12 px-4 rounded-xl bg-card border text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${errors.email ? "border-destructive" : "border-border"}`}
              />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-password" className="block text-sm font-medium text-foreground">Password</label>
                {mode === "login" && (
                  <Link to="/reset-password" className="text-sm text-primary font-medium hover:underline">Forgot password?</Link>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined, form: undefined })); }}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                  aria-invalid={!!errors.password}
                  className={`w-full h-12 pl-4 pr-12 rounded-xl bg-card border text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${errors.password ? "border-destructive" : "border-border"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
              {mode === "signup" && password && (
                <div className="mt-2">
                  <div className="grid grid-cols-4 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`h-1 rounded-full ${i < strength ? STRENGTH_COLORS[strength] : "bg-muted"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{STRENGTH_LABELS[strength]}</p>
                </div>
              )}
            </div>

            {mode === "signup" && (
              <div>
                <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => { setAcceptedTerms(e.target.checked); setErrors((p) => ({ ...p, terms: undefined })); }}
                    className="mt-0.5 w-4 h-4 accent-[hsl(var(--primary))]"
                  />
                  <span>
                    I'm 18 or older and agree to the{" "}
                    <Link to="/terms" className="text-primary font-medium hover:underline">Terms</Link>,{" "}
                    <Link to="/privacy" className="text-primary font-medium hover:underline">Privacy Policy</Link> and{" "}
                    <Link to="/community-guidelines" className="text-primary font-medium hover:underline">Community Guidelines</Link>.
                  </span>
                </label>
                {errors.terms && <p className="text-sm text-destructive mt-1">{errors.terms}</p>}
              </div>
            )}

            {errors.form && (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errors.form}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 rounded-full gradient-primary text-white font-bold text-base shadow-button hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={() => navigate("/phone", { state: { from: redirectTo } })}
            className="w-full h-12 rounded-full border border-border bg-card font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            Continue with phone
          </button>

          {mode === "signup" && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Link to="/cuban-signup" className="rounded-xl border border-border p-3 text-center hover:bg-muted transition-colors">🇨🇺 I live in Cuba</Link>
              <Link to="/tourist-signup" className="rounded-xl border border-border p-3 text-center hover:bg-muted transition-colors">✈️ I'm visiting Cuba</Link>
            </div>
          )}

          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            Secured by TAKATAK identity · Your data stays private
          </p>
        </main>
      </div>
    </div>
  );
}
