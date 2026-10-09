import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

const COUNTRIES = [
  { iso: "CA", dial: "+1", flag: "🇨🇦", name: "Canada", digits: 10 },
  { iso: "CU", dial: "+53", flag: "🇨🇺", name: "Cuba", digits: 8 },
  { iso: "US", dial: "+1", flag: "🇺🇸", name: "United States", digits: 10 },
  { iso: "MX", dial: "+52", flag: "🇲🇽", name: "México", digits: 10 },
  { iso: "ES", dial: "+34", flag: "🇪🇸", name: "España", digits: 9 },
  { iso: "FR", dial: "+33", flag: "🇫🇷", name: "France", digits: 9 },
];

type Step = "phone" | "code";
type Availability = "checking" | "available" | "unavailable";

async function bridge<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("isexy-takatak-bridge", { body });
  if (error) {
    // FunctionsHttpError carries the JSON body in `context`.
    let message = "Something went wrong. Please try again.";
    try {
      const payload = await (error as { context?: Response }).context?.json();
      if (payload?.error) message = payload.error;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return data as T;
}

export default function PhoneAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const from = (location.state as { from?: string } | null)?.from ?? "/discover";

  const [availability, setAvailability] = useState<Availability>("checking");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  const e164 = `${country.dial}${number}`;

  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true });
  }, [user, loading, from, navigate]);

  useEffect(() => {
    bridge<{ phoneLogin: boolean }>({ action: "status" })
      .then((s) => setAvailability(s.phoneLogin ? "available" : "unavailable"))
      .catch(() => setAvailability("unavailable"));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") setTimeout(() => codeRef.current?.focus(), 100);
  }, [step]);

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || number.length < Math.min(country.digits, 8)) return;
    setBusy(true);
    setError("");
    try {
      await bridge({ action: "phone_send", phone: e164, intent: "login" });
      setStep("code");
      setCooldown(60);
      toast.success("Code sent by SMS");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const result = await bridge<{ tokenHash: string; isNewUser: boolean }>({ action: "phone_verify", phone: e164, code });
      const { error: sessionError } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "magiclink" });
      if (sessionError) throw new Error("Verified, but we couldn't sign you in. Please try again.");
      track(result.isNewUser ? "sign_up" : "login", { method: "phone" });
      toast.success(result.isNewUser ? "Welcome to ISEXY! Let's set up your profile." : "Welcome back!");
      navigate(result.isNewUser ? "/profile-setup" : from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center p-4 h-14">
        <button
          onClick={() => (step === "code" ? (setStep("phone"), setCode(""), setError("")) : navigate(-1))}
          className="p-2 -ml-2 text-foreground hover:opacity-70"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-6 pb-10 animate-fade-in">
        {availability === "checking" ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : availability === "unavailable" ? (
          <div className="pt-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground mb-2">Phone sign-in is warming up</h1>
            <p className="text-muted-foreground mb-8">
              We're connecting SMS sign-in through TAKATAK. Meanwhile, continue with your email — it takes 30 seconds.
            </p>
            <Link to="/auth" state={{ from }} className="block w-full py-4 rounded-full gradient-primary text-white font-bold">
              Continue with email
            </Link>
          </div>
        ) : step === "phone" ? (
          <form onSubmit={sendCode} noValidate>
            <h1 className="text-3xl font-extrabold text-foreground mt-2 mb-2">What's your number?</h1>
            <p className="text-muted-foreground mb-8">We'll text you a 6-digit code. Your number is never shown on your profile.</p>

            <div className="flex gap-3 mb-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  className="h-14 px-3 rounded-xl border border-border bg-card flex items-center gap-1.5 font-semibold text-foreground"
                  aria-haspopup="listbox"
                  aria-expanded={pickerOpen}
                >
                  <span className="text-xl">{country.flag}</span>
                  <span>{country.dial}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {pickerOpen && (
                  <ul role="listbox" className="absolute z-20 mt-2 w-60 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                    {COUNTRIES.map((c) => (
                      <li key={c.iso}>
                        <button
                          type="button"
                          onClick={() => { setCountry(c); setPickerOpen(false); setNumber(""); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left"
                        >
                          <span className="text-xl">{c.flag}</span>
                          <span className="flex-1 text-foreground">{c.name}</span>
                          <span className="text-muted-foreground">{c.dial}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={number}
                onChange={(e) => { setNumber(e.target.value.replace(/\D/g, "").slice(0, 12)); setError(""); }}
                placeholder={country.iso === "CU" ? "5 123 4567" : "514 555 0123"}
                className="flex-1 h-14 px-4 rounded-xl border border-border bg-card text-lg text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                aria-label="Phone number"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive mt-2">{error}</p>}

            <button
              type="submit"
              disabled={busy || number.length < Math.min(country.digits, 8)}
              className="mt-8 w-full h-14 rounded-full gradient-primary text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-5 h-5 animate-spin" />}
              Send code
            </button>
            <p className="text-center mt-6 text-sm text-muted-foreground">
              Prefer email? <Link to="/auth" state={{ from }} className="text-primary font-semibold">Use email instead</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <h1 className="text-3xl font-extrabold text-foreground mt-2 mb-2">Enter your code</h1>
            <p className="text-muted-foreground mb-8">Sent to <span className="font-semibold text-foreground">{country.flag} {e164}</span></p>
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(next);
                setError("");
              }}
              placeholder="••••••"
              className="w-full h-16 text-center tracking-[0.6em] text-3xl font-bold rounded-xl border border-border bg-card text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              aria-label="6-digit code"
            />
            {error && <p role="alert" className="text-sm text-destructive mt-2">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="mt-8 w-full h-14 rounded-full gradient-primary text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-5 h-5 animate-spin" />}
              Verify & continue
            </button>
            <p className="text-center mt-6 text-sm text-muted-foreground">
              Didn't get it?{" "}
              {cooldown > 0 ? (
                <span>Resend in {cooldown}s</span>
              ) : (
                <button type="button" onClick={() => sendCode()} className="text-primary font-semibold">Resend code</button>
              )}
            </p>
          </form>
        )}

        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4" />
          Phone verification by TAKATAK identity
        </p>
      </main>
    </div>
  );
}
