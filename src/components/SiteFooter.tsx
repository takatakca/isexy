import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

type Lang = "en" | "fr" | "es";

const COPY: Record<Lang, { product: string; tagline: string; links: [string, string][]; rights: string }> = {
  en: {
    product: "A GROUPE TAKATAK product",
    tagline: "A social network for adults (18+) in Canada. Meet new people and make friends.",
    links: [["/faq", "FAQ"], ["/about", "About"], ["/safety", "Safety"], ["/contact-us", "Contact"], ["/terms", "Terms"], ["/privacy", "Privacy"], ["/cookie-policy", "Cookies"], ["/consumer-health-privacy", "Health Privacy"]],
    rights: "All rights reserved.",
  },
  fr: {
    product: "Un produit GROUPE TAKATAK",
    tagline: "Un réseau social pour adultes (18+) au Canada. Rencontrez du monde et faites-vous des amis.",
    links: [["/faq", "FAQ"], ["/about", "À propos"], ["/safety", "Sécurité"], ["/contact-us", "Contact"], ["/terms", "Conditions"], ["/privacy", "Confidentialité"], ["/cookie-policy", "Témoins"], ["/consumer-health-privacy", "Données de santé"]],
    rights: "Tous droits réservés.",
  },
  es: {
    product: "Un producto de GROUPE TAKATAK",
    tagline: "Una red social para adultos (18+) en Canadá. Conoce gente nueva y haz amigos.",
    links: [["/faq", "FAQ"], ["/about", "Acerca de"], ["/safety", "Seguridad"], ["/contact-us", "Contacto"], ["/terms", "Términos"], ["/privacy", "Privacidad"], ["/cookie-policy", "Cookies"], ["/consumer-health-privacy", "Privacidad de salud"]],
    rights: "Todos los derechos reservados.",
  },
};

/** "A GROUPE TAKATAK product": text only, never a re-drawn TAKATAK logo (BRAND.md). */
export function TakatakByline({ className }: { className?: string }) {
  const { language } = useLanguage();
  const lang: Lang = language.code === "fr" || language.code === "es" ? language.code : "en";
  return (
    <p className={cn("text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground", className)}>
      {COPY[lang].product}
    </p>
  );
}

/** Public-page footer: brand, links, byline. */
export function SiteFooter({ className }: { className?: string }) {
  const { language } = useLanguage();
  const lang: Lang = language.code === "fr" || language.code === "es" ? language.code : "en";
  const t = COPY[lang];
  return (
    <footer className={cn("border-t border-foreground/[0.08] bg-background px-6 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]", className)}>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-glow shadow-glow" aria-hidden>
                <Flame className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
              </span>
              <span className="font-display text-lg font-extrabold tracking-[0.08em] text-foreground">ISEXY</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.tagline}</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-1 text-sm sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
            {t.links.map(([to, label]) => (
              <Link key={to} to={to} className="flex min-h-[2.25rem] items-center text-muted-foreground transition-colors hover:text-foreground">
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-foreground/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <TakatakByline className="text-foreground/80" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ISEXY.CA · {t.rights}</p>
        </div>
      </div>
    </footer>
  );
}
