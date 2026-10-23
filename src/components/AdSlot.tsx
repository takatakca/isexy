import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdFree } from "@/hooks/useAdFree";
import { useLanguage } from "@/hooks/useLanguage";
import { getConsent, onConsentChange } from "@/lib/consent";
import {
  ADS_CONFIG,
  PLACEMENTS,
  adsenseSlotFor,
  buildAdsContext,
  fetchTakatakAd,
  loadAdSense,
  placementAllowedOn,
  pushAdSenseUnit,
  sendTakatakEvent,
  setAdSensePersonalization,
  type AdFormat,
  type AdPlacement,
  type AdsContext,
  type TakatakAd,
} from "@/lib/ads";
import { cn } from "@/lib/utils";

type Lang = "en" | "fr" | "es";

const COPY: Record<Lang, {
  takatak: string; adsense: string; house: string; houseTitle: string; houseBody: string; houseCta: string; learn: string;
}> = {
  en: {
    takatak: "Advertisement", adsense: "Advertisements", house: "ISEXY Plus",
    houseTitle: "Go ad-free with ISEXY Plus", houseBody: "Unlimited Likes, Passport and no ads.", houseCta: "See Plus", learn: "Learn more",
  },
  fr: {
    takatak: "Publicité", adsense: "Publicités", house: "ISEXY Plus",
    houseTitle: "Sans publicité avec ISEXY Plus", houseBody: "Mentions J'aime illimitées, Passeport et aucune publicité.", houseCta: "Voir Plus", learn: "En savoir plus",
  },
  es: {
    takatak: "Publicidad", adsense: "Anuncios", house: "ISEXY Plus",
    houseTitle: "Sin anuncios con ISEXY Plus", houseBody: "Me gusta ilimitados, Pasaporte y sin anuncios.", houseCta: "Ver Plus", learn: "Más información",
  },
};

type Stage = "loading" | "takatak" | "adsense" | "house";

/**
 * One ad slot. Renders nothing for paying members, while their status is
 * loading, on pages that never carry ads, or (except on public content
 * pages) for signed-out visitors. Otherwise it reserves its height at once
 * and fills it with, in order: a TAKATAK ad, a Google AdSense unit (when
 * configured), or the house "Go ad-free" banner. Any error falls through to
 * the house banner. See src/lib/ads.ts and docs/ADS.md.
 */
export function AdSlot({ placement, className }: { placement: AdPlacement; className?: string }) {
  const { pathname } = useLocation();
  const { adFree, signedIn } = useAdFree();
  const spec = PLACEMENTS[placement];
  if (!spec || !placementAllowedOn(placement, pathname)) return null;
  if (adFree !== false) return null;
  if (!signedIn && !spec.signedOut) return null;
  return <AdSlotBody placement={placement} className={className} />;
}

function useAdvertisingConsent(): boolean {
  const [advertising, setAdvertising] = useState(() => getConsent().advertising);
  useEffect(() => onConsentChange((next) => {
    setAdvertising(next.advertising);
    // The next AdSense requests follow the new choice.
    if (ADS_CONFIG.adsense.client) setAdSensePersonalization(next.advertising);
  }), []);
  return advertising;
}

function AdSlotBody({ placement, className }: { placement: AdPlacement; className?: string }) {
  const spec = PLACEMENTS[placement];
  const { profile } = useAuth();
  const { language } = useLanguage();
  const lang: Lang = language.code === "fr" || language.code === "es" ? language.code : "en";
  const t = COPY[lang];
  const personalized = useAdvertisingConsent();

  const [stage, setStage] = useState<Stage>("loading");
  const [ad, setAd] = useState<TakatakAd | null>(null);
  // The context of this mount (one serve request per slot mount).
  const contextRef = useRef<AdsContext>(buildAdsContext({
    language: language.code,
    personalized,
    city: profile?.city,
    country: profile?.country,
  }));

  useEffect(() => {
    const controller = new AbortController();
    fetchTakatakAd(placement, contextRef.current, controller.signal)
      .then((served) => {
        if (controller.signal.aborted) return;
        if (served) {
          setAd(served);
          setStage("takatak");
        } else {
          setStage(adsenseSlotFor(placement) ? "adsense" : "house");
        }
      })
      .catch(() => { if (!controller.signal.aborted) setStage("house"); });
    return () => controller.abort();
  }, [placement]);

  // "Advertisement" / "Publicité" (TAKATAK's own labels), "Advertisements" / "Publicités" for AdSense (Google's allowed label).
  const label = stage === "adsense" ? t.adsense : stage === "house" ? t.house : t.takatak;

  return (
    <aside
      aria-label={label}
      data-ad-placement={placement}
      data-ad-source={stage}
      className={cn("relative w-full overflow-hidden rounded-2xl border border-border/70 bg-card/80", className)}
      style={{ height: spec.height }}
    >
      {stage === "loading" && <SlotSkeleton format={spec.format} label={label} />}
      {stage === "takatak" && ad && (
        <TakatakCreative ad={ad} format={spec.format} label={label} learn={t.learn} context={contextRef.current} />
      )}
      {stage === "adsense" && (
        <AdSenseUnit
          slot={adsenseSlotFor(placement) ?? ""}
          height={spec.adsenseHeight}
          label={label}
          personalized={personalized}
          onFail={() => setStage("house")}
        />
      )}
      {stage === "house" && <HouseAd format={spec.format} t={t} />}
    </aside>
  );
}

function AdLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground leading-none", className)}>
      {children}
    </span>
  );
}

function SlotSkeleton({ format, label }: { format: AdFormat; label: string }) {
  return (
    <div className="h-full w-full p-3 flex flex-col gap-2" aria-busy="true">
      <AdLabel>{label}</AdLabel>
      <div className={cn("flex-1 rounded-xl bg-muted/50 animate-pulse", format === "card" && "rounded-2xl")} />
    </div>
  );
}

/** A TAKATAK ad: text only from the server (never HTML), labelled, sponsored link, impression after 1 s at 50 % visible. */
function TakatakCreative({ ad, format, label, learn, context }: {
  ad: TakatakAd; format: AdFormat; label: string; learn: string; context: AdsContext;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [imageOk, setImageOk] = useState(!!ad.imageUrl);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ad.trackingEnabled || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    let sent = false;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
      if (visible && timer === undefined && !sent) {
        timer = window.setTimeout(() => {
          timer = undefined;
          if (sent || document.visibilityState !== "visible") return;
          sent = true;
          sendTakatakEvent(ad, "impression", context);
          io.disconnect();
        }, 1000);
      } else if (!visible && timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [ad, context]);

  // TAKATAK's click redirect records the click itself; otherwise send the event.
  const onClick = () => { if (!ad.clickTracked) sendTakatakEvent(ad, "click", context); };
  const cta = ad.callToAction ?? learn;
  const image = imageOk && ad.imageUrl ? (
    <img
      src={ad.imageUrl}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setImageOk(false)}
      className={cn(
        "object-cover shrink-0 bg-muted",
        format === "slim" && "w-12 h-12 rounded-xl",
        format === "banner" && "w-[88px] h-[88px] rounded-xl",
        format === "card" && "w-full h-[140px]",
      )}
    />
  ) : null;

  const common = {
    ref,
    href: ad.href,
    target: "_blank",
    rel: "sponsored noopener noreferrer",
    onClick,
    "aria-label": `${label}: ${ad.headline}`,
    "data-ad-campaign": ad.campaignId,
  } as const;

  if (format === "card") {
    return (
      <a {...common} className="flex h-full flex-col text-left hover:bg-muted/30 transition-colors">
        {image ?? <div className="w-full h-[140px] shrink-0 bg-gradient-to-br from-primary/40 via-secondary to-card" aria-hidden />}
        <div className="flex-1 min-h-0 p-3 flex flex-col">
          <AdLabel className="mb-1.5">{label}</AdLabel>
          <p className="font-bold text-foreground leading-snug line-clamp-2">{ad.headline}</p>
          {ad.body && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{ad.body}</p>}
          <span className="mt-auto self-start rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">{cta}</span>
        </div>
      </a>
    );
  }
  return (
    <a {...common} className={cn("flex h-full items-center gap-3 px-3 text-left hover:bg-muted/30 transition-colors", format === "banner" && "py-3")}>
      {image}
      <div className="min-w-0 flex-1">
        <AdLabel className="mb-1">{label}</AdLabel>
        <p className="text-sm font-bold text-foreground truncate">{ad.headline}</p>
        {ad.body && (
          <p className={cn("text-xs text-muted-foreground", format === "slim" ? "truncate" : "line-clamp-2")}>{ad.body}</p>
        )}
      </div>
      <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground max-w-[7.5rem] truncate">{cta}</span>
    </a>
  );
}

/** A Google AdSense unit of a fixed height inside the slot (no layout shift). Unfilled or blocked = onFail. */
function AdSenseUnit({ slot, height, label, personalized, onFail }: {
  slot: string; height: number; label: string; personalized: boolean; onFail: () => void;
}) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  // Only the consent at mount decides how this unit loads; later changes apply to the next requests.
  const personalizedAtMount = useRef(personalized);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
      if (el?.getAttribute("data-ad-status") === "unfilled") failRef.current();
    });
    if (el && observer) observer.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    loadAdSense(personalizedAtMount.current).then((ok) => {
      if (cancelled) return;
      if (!ok) return failRef.current();
      if (!el || pushed.current) return;
      pushed.current = true;
      if (!pushAdSenseUnit()) failRef.current();
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="h-full w-full px-3 pt-2 flex flex-col">
      <AdLabel className="mb-1">{label}</AdLabel>
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <ins
          ref={ref}
          className="adsbygoogle"
          style={{ display: "inline-block", width: "100%", height }}
          data-ad-client={ADS_CONFIG.adsense.client ?? undefined}
          data-ad-slot={slot}
        />
      </div>
    </div>
  );
}

/** Our own banner when no ad fills the slot. Never shown to paying members (AdSlot hides itself for them). */
function HouseAd({ format, t }: { format: AdFormat; t: (typeof COPY)[Lang] }) {
  const icon = (
    <span className={cn("shrink-0 rounded-2xl gradient-primary flex items-center justify-center text-white", format === "card" ? "w-14 h-14" : "w-11 h-11")}>
      <Sparkles className={format === "card" ? "w-7 h-7" : "w-5 h-5"} />
    </span>
  );
  if (format === "card") {
    return (
      <Link to="/premium" data-house-ad className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center hover:bg-muted/30 transition-colors">
        <AdLabel>{t.house}</AdLabel>
        {icon}
        <p className="text-lg font-extrabold text-foreground leading-tight">{t.houseTitle}</p>
        <p className="text-sm text-muted-foreground">{t.houseBody}</p>
        <span className="rounded-full gradient-primary px-5 py-2 text-sm font-bold text-white">{t.houseCta}</span>
      </Link>
    );
  }
  return (
    <Link to="/premium" data-house-ad className={cn("flex h-full items-center gap-3 px-3 hover:bg-muted/30 transition-colors", format === "banner" && "py-3")}>
      {icon}
      <div className="min-w-0 flex-1">
        <AdLabel className="mb-1">{t.house}</AdLabel>
        <p className="text-sm font-bold text-foreground truncate">{t.houseTitle}</p>
        <p className={cn("text-xs text-muted-foreground", format === "slim" ? "truncate" : "line-clamp-2")}>{t.houseBody}</p>
      </div>
      <span className="shrink-0 rounded-full gradient-primary px-3 py-1.5 text-xs font-bold text-white">{t.houseCta}</span>
    </Link>
  );
}
