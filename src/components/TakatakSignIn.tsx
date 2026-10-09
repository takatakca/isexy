import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/authErrors";
import { track } from "@/lib/analytics";

/**
 * Takatak Auth: the one TAKATAK identity (auth.users on TAKATAK V1), signed in
 * with Google, an email code or an SMS code. No passwords. New accounts are
 * created on first sign-in; the ISEXY profile is created afterwards by the
 * signup flow (ProtectedRoute sends members without one to /profile-setup).
 */

type Method = "email" | "phone";
type Step = "enter" | "code";

const emailSchema = z.string().trim().email("Enter a valid email address");
// E.164: + (or 00) then 8–15 digits. Spaces, dashes and brackets are ignored.
// A number without a country code is left invalid rather than guessed.
const normalizePhone = (raw: string) => {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  return compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
};
const phoneSchema = z.string().regex(/^\+\d{8,15}$/, "Enter your number with the country code, e.g. +1 514 555 0123 or +53 5 123 4567");
const codeSchema = z.string().regex(/^\d{6,8}$/, "Enter the code from your message");

interface Props {
  /** Where Google (and email links) bring the member back, e.g. "/discover". */
  redirectPath?: string;
  /** Wording only: sign-in and sign-up are the same action with Takatak Auth. */
  intent?: "login" | "signup";
  defaultMethod?: Method;
  /** Show the 18+/terms checkbox (required before an account can be created). */
  requireTerms?: boolean;
}

export function TakatakSignIn({ redirectPath = "/discover", intent = "login", defaultMethod = "email", requireTerms = intent === "signup" }: Props) {
  const [method, setMethod] = useState<Method>(defaultMethod);
  const [step, setStep] = useState<Step>("enter");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(!requireTerms);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);

  const redirectTo = `${window.location.origin}${redirectPath}`;
  const target = method === "email" ? email.trim().toLowerCase() : normalizePhone(phone);

  const termsOk = () => {
    if (acceptedTerms) return true;
    setError("Please confirm you're 18+ and accept the terms");
    return false;
  };

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || !termsOk()) return;
    const parsed = (method === "email" ? emailSchema : phoneSchema).safeParse(target);
    if (!parsed.success) return setError(parsed.error.errors[0].message);
    setBusy(true);
    setError(null);
    const { error: err } =
      method === "email"
        ? await supabase.auth.signInWithOtp({ email: target, options: { shouldCreateUser: true, emailRedirectTo: redirectTo } })
        : await supabase.auth.signInWithOtp({ phone: target, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) return setError(friendlyAuthError(err.message));
    setStep("code");
    setCode("");
    setResendAt(Date.now() + 60_000);
    track("otp_sent", { method });
  };

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const parsed = codeSchema.safeParse(code.trim());
    if (!parsed.success) return setError(parsed.error.errors[0].message);
    setBusy(true);
    setError(null);
    const { error: err } =
      method === "email"
        ? await supabase.auth.verifyOtp({ email: target, token: code.trim(), type: "email" })
        : await supabase.auth.verifyOtp({ phone: target, token: code.trim(), type: "sms" });
    setBusy(false);
    if (err) return setError(friendlyAuthError(err.message));
    track("login", { method: method === "email" ? "email_code" : "phone_code" });
    // AuthProvider picks up the session; the page redirects.
  };

  const google = async () => {
    if (busy || !termsOk()) return;
    setBusy(true);
    setError(null);
    track("login_started", { method: "google" });
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (err) {
      setBusy(false);
      setError(friendlyAuthError(err.message));
    }
  };

  if (step === "code") {
    const canResend = Date.now() >= resendAt;
    return (
      <form onSubmit={verifyCode} noValidate className="space-y-4">
        <button type="button" onClick={() => { setStep("enter"); setError(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Change {method === "email" ? "email" : "number"}
        </button>
        <p className="text-sm text-muted-foreground">
          We sent a code to <span className="font-semibold text-foreground break-all">{target}</span>.
          {method === "email" && " You can also tap the link in that email."}
        </p>
        <div>
          <label htmlFor="takatak-code" className="block text-sm font-medium text-foreground mb-1.5">Code</label>
          <input
            id="takatak-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={8}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(null); }}
            placeholder="123456"
            className="w-full h-14 px-4 rounded-xl bg-card border border-border text-center text-2xl tracking-[0.4em] font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        <button type="submit" disabled={busy} className="w-full h-14 rounded-full gradient-primary text-white font-bold shadow-button disabled:opacity-60 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-5 h-5 animate-spin" />} Continue
        </button>
        <button type="button" disabled={!canResend || busy} onClick={() => sendCode()} className="w-full text-sm font-semibold text-primary disabled:text-muted-foreground">
          {canResend ? "Send a new code" : "You can ask for a new code in a minute"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={google}
        disabled={busy}
        className="w-full h-12 rounded-full border border-border bg-card font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-3 disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or get a code</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div role="tablist" className="grid grid-cols-2 p-1 rounded-full bg-muted">
        {(["email", "phone"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={method === m}
            onClick={() => { setMethod(m); setError(null); }}
            className={`py-2.5 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2 ${method === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "email" ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            {m === "email" ? "Email" : "Phone"}
          </button>
        ))}
      </div>

      <form onSubmit={sendCode} noValidate className="space-y-4">
        {method === "email" ? (
          <div>
            <label htmlFor="takatak-email" className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input
              id="takatak-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="you@example.com"
              className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="takatak-phone" className="block text-sm font-medium text-foreground mb-1.5">Mobile number</label>
            <input
              id="takatak-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(null); }}
              placeholder="+1 514 555 0123"
              className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-muted-foreground mt-1">Canada +1 · Cuba +53 · we text you a code.</p>
          </div>
        )}

        {requireTerms && (
          <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => { setAcceptedTerms(e.target.checked); setError(null); }}
              className="mt-0.5 w-4 h-4 accent-[hsl(var(--primary))]"
            />
            <span>
              I'm 18 or older and agree to the{" "}
              <Link to="/terms" className="text-primary font-medium hover:underline">Terms</Link>,{" "}
              <Link to="/privacy" className="text-primary font-medium hover:underline">Privacy Policy</Link> and{" "}
              <Link to="/community-guidelines" className="text-primary font-medium hover:underline">Community Guidelines</Link>.
            </span>
          </label>
        )}

        {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        <button type="submit" disabled={busy} className="w-full h-14 rounded-full gradient-primary text-white font-bold shadow-button disabled:opacity-60 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-5 h-5 animate-spin" />}
          {intent === "signup" ? "Create my account" : "Send my code"}
        </button>
      </form>

      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4" /> Takatak Auth · one secure TAKATAK account, no password
      </p>
    </div>
  );
}
