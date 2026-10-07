import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/hooks/useLanguage";
import {
  getConsent,
  onOpenConsentSettings,
  prefersNoTracking,
  setConsent,
} from "@/lib/consent";

type Lang = "en" | "es" | "fr";

const COPY: Record<Lang, {
  title: string; body: string; accept: string; reject: string; customize: string; save: string;
  necessary: string; necessaryDesc: string; analytics: string; analyticsDesc: string;
  marketing: string; marketingDesc: string; policy: string; always: string;
}> = {
  en: {
    title: "Your privacy, your choice",
    body: "We use essential cookies to keep you signed in and safe. With your permission we'd also like to measure how ISEXY is used, to improve it, and to measure our ads.",
    accept: "Accept all", reject: "Essential only", customize: "Customize", save: "Save choices",
    necessary: "Essential", necessaryDesc: "Sign-in, security, language and your choices here. Always on.",
    analytics: "Analytics", analyticsDesc: "Anonymous usage statistics and performance (first-party, optional Google Analytics).",
    marketing: "Marketing", marketingDesc: "Measure the effectiveness of our ads (e.g. Meta).",
    policy: "Cookie Policy", always: "Always on",
  },
  es: {
    title: "Tu privacidad, tu decisión",
    body: "Usamos cookies esenciales para mantener tu sesión y tu seguridad. Con tu permiso, también mediremos cómo se usa ISEXY para mejorarlo y medir nuestros anuncios.",
    accept: "Aceptar todo", reject: "Solo esenciales", customize: "Personalizar", save: "Guardar",
    necessary: "Esenciales", necessaryDesc: "Inicio de sesión, seguridad, idioma y estas preferencias. Siempre activas.",
    analytics: "Analítica", analyticsDesc: "Estadísticas de uso anónimas y rendimiento.",
    marketing: "Marketing", marketingDesc: "Medir la eficacia de nuestros anuncios (p. ej. Meta).",
    policy: "Política de cookies", always: "Siempre activas",
  },
  fr: {
    title: "Votre vie privée, votre choix",
    body: "Nous utilisons des témoins essentiels pour garder votre session active et sécuritaire. Avec votre permission, nous mesurerons aussi l'utilisation d'ISEXY pour l'améliorer et évaluer nos publicités.",
    accept: "Tout accepter", reject: "Essentiels seulement", customize: "Personnaliser", save: "Enregistrer",
    necessary: "Essentiels", necessaryDesc: "Connexion, sécurité, langue et ces préférences. Toujours actifs.",
    analytics: "Analytique", analyticsDesc: "Statistiques d'utilisation anonymes et performance.",
    marketing: "Marketing", marketingDesc: "Mesurer l'efficacité de nos publicités (ex. Meta).",
    policy: "Politique sur les témoins", always: "Toujours actifs",
  },
};

export function ConsentBanner() {
  const { language } = useLanguage();
  const lang: Lang = language.code === "es" || language.code === "fr" ? language.code : "en";
  const t = COPY[lang];

  const [open, setOpen] = useState(() => getConsent().decidedAt === null);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(() => getConsent().analytics);
  const [marketing, setMarketing] = useState(() => getConsent().marketing);

  useEffect(() => onOpenConsentSettings(() => {
    const current = getConsent();
    setAnalytics(current.analytics);
    setMarketing(current.marketing);
    setCustomizing(true);
    setOpen(true);
  }), []);

  if (!open) return null;

  const decide = (choice: { analytics: boolean; marketing: boolean }) => {
    setConsent(choice);
    setOpen(false);
    setCustomizing(false);
  };

  const noTracking = prefersNoTracking();

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4 pointer-events-none"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto mx-auto max-w-2xl rounded-3xl border border-border bg-card/95 backdrop-blur shadow-2xl p-5 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="consent-title" className="font-bold text-foreground">{t.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t.body}{" "}
              <Link to="/cookie-policy" className="text-primary underline underline-offset-2">{t.policy}</Link>
            </p>
          </div>
          {customizing && (
            <button onClick={() => setCustomizing(false)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Back">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {customizing && (
          <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
            <ConsentRow title={t.necessary} description={t.necessaryDesc} badge={t.always} />
            <ConsentRow title={t.analytics} description={t.analyticsDesc} checked={analytics} onChange={setAnalytics} />
            <ConsentRow title={t.marketing} description={t.marketingDesc} checked={marketing} onChange={setMarketing} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {customizing ? (
            <>
              <button onClick={() => decide({ analytics: false, marketing: false })} className="h-11 rounded-full border border-border font-semibold text-sm text-foreground hover:bg-muted">
                {t.reject}
              </button>
              <button onClick={() => decide({ analytics, marketing })} className="h-11 rounded-full border border-border font-semibold text-sm text-foreground hover:bg-muted">
                {t.save}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => decide({ analytics: false, marketing: false })} className="h-11 rounded-full border border-border font-semibold text-sm text-foreground hover:bg-muted">
                {t.reject}
              </button>
              <button
                onClick={() => { setMarketing(!noTracking && marketing); setCustomizing(true); }}
                className="h-11 rounded-full border border-border font-semibold text-sm text-foreground hover:bg-muted"
              >
                {t.customize}
              </button>
            </>
          )}
          <button onClick={() => decide({ analytics: true, marketing: true })} className="h-11 rounded-full gradient-primary text-white font-bold text-sm">
            {t.accept}
          </button>
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5" /> Law 25 (Québec) · PIPEDA · GDPR
        </p>
      </div>
    </div>
  );
}

function ConsentRow({
  title, description, checked, onChange, badge,
}: {
  title: string;
  description: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 p-4 cursor-pointer">
      <span>
        <span className="block font-semibold text-sm text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
      </span>
      {badge ? (
        <span className="text-xs font-semibold text-primary whitespace-nowrap">{badge}</span>
      ) : (
        <Switch checked={!!checked} onCheckedChange={(v) => onChange?.(v)} aria-label={title} />
      )}
    </label>
  );
}
