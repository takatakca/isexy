import { Link, useLocation } from "react-router-dom";
import { Compass, HelpCircle, Home } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";

const COPY = {
  en: {
    title: "This page doesn't exist",
    body: "The link may be old or mistyped. Nothing is lost: pick up where you left off.",
    home: "Back to ISEXY",
    discover: "Back to Discover",
    help: "Get help",
  },
  fr: {
    title: "Cette page n'existe pas",
    body: "Le lien est peut-être ancien ou mal saisi. Rien n'est perdu : reprenez là où vous en étiez.",
    home: "Retour à ISEXY",
    discover: "Retour à Découvrir",
    help: "Obtenir de l'aide",
  },
};

/** 404: branded, in-app links (no full reload), English or French. */
const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = COPY[language.code === "fr" ? "fr" : "en"];

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6" data-testid="not-found">
      <div className="w-full max-w-sm text-center">
        <Logo size="lg" showText={false} variant="dark" />
        <p className="mt-6 text-5xl font-extrabold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">{t.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={location.pathname}>{location.pathname}</p>
        <div className="mt-8 space-y-3">
          <Link
            to={user ? "/discover" : "/"}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground"
          >
            {user ? <Compass className="h-4 w-4" /> : <Home className="h-4 w-4" />}
            {user ? t.discover : t.home}
          </Link>
          <Link
            to="/help-support"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-6 py-3 font-semibold text-foreground"
          >
            <HelpCircle className="h-4 w-4" />
            {t.help}
          </Link>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
