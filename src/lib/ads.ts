/**
 * ISEXY ads: placements, build configuration and the two ad sources.
 *
 * Free members (and signed-out visitors on public content pages) see small
 * banners; members who pay for anything see none (isexy.get_my_ad_status,
 * src/hooks/useAdFree.ts). Each slot tries, in order:
 *   1. TAKATAK ads, the owner's local ad network (POST {base}/api/ads/serve);
 *   2. Google AdSense, only when VITE_ADSENSE_CLIENT and the placement's slot
 *      id are set (personalized only with the Advertising consent);
 *   3. the house banner "Go ad-free with ISEXY Plus".
 * Never on chat threads, calls, checkout/purchase/Premium pages, sign-in,
 * onboarding, profile setup, admin/staff pages, legal pages or the 404 page.
 * Owner setup: docs/ADS.md.
 */

export type AdPlacement =
  | "isexy-discover-banner"
  | "isexy-list-banner"
  | "isexy-feed-inline"
  | "isexy-profile-banner"
  | "isexy-content-inline";

export type AdFormat = "slim" | "banner" | "card";

/** One successful payment keeps ads away this long (0016_ads.sql c_ad_free_after_payment). */
export const AD_FREE_DAYS_AFTER_PAYMENT = 30;

interface PlacementSpec {
  /** Pages where the placement may render. */
  routes: RegExp;
  format: AdFormat;
  /** Height of the whole slot (label included), reserved before anything loads: no layout shift. */
  height: number;
  /** Height of the AdSense unit inside the slot. */
  adsenseHeight: number;
  /** VITE_ADSENSE_SLOT_* suffix. */
  adsenseKey: "DISCOVER" | "LIST" | "FEED" | "PROFILE" | "CONTENT";
  /** Shown to signed-out visitors (public pages only). */
  signedOut: boolean;
}

export const PLACEMENTS: Record<AdPlacement, PlacementSpec> = {
  // Discover: a slim strip between the card area and the bottom nav.
  "isexy-discover-banner": { routes: /^\/discover\/?$/, format: "slim", height: 72, adsenseHeight: 50, adsenseKey: "DISCOVER", signedOut: false },
  // Matches, Messages inbox, Likes / Who liked you: one banner after the 3rd row.
  "isexy-list-banner": { routes: /^\/(matches|matches-list|likes|who-liked-you)\/?$/, format: "banner", height: 120, adsenseHeight: 100, adsenseKey: "LIST", signedOut: false },
  // Explore, News, Community Stories: one inline card every ~6 items.
  "isexy-feed-inline": { routes: /^\/(explore|news|community-stories)\/?$/, format: "card", height: 300, adsenseHeight: 250, adsenseKey: "FEED", signedOut: true },
  // Own Profile and Settings, at the bottom.
  "isexy-profile-banner": { routes: /^\/(profile|settings)\/?$/, format: "banner", height: 120, adsenseHeight: 100, adsenseKey: "PROFILE", signedOut: false },
  // Public content pages (FAQ, Safety Tips, Help, Help Centre, About), signed-out visitors too.
  "isexy-content-inline": { routes: /^\/(faq|safety-tips|help-support|about|knowledge-base(\/[^/]+)?)\/?$/, format: "card", height: 300, adsenseHeight: 250, adsenseKey: "CONTENT", signedOut: true },
};

/**
 * Pages that never show an ad, whatever a component asks: chat, calls,
 * checkout and purchases, sign-in / onboarding / profile setup, staff, legal.
 * (The 404 page has no slot.) Checked before the placement's own routes.
 */
export const AD_FREE_ROUTES: RegExp[] = [
  /^\/(chat|group-chat|video-call)(\/|$)/,
  /^\/phone-line(\/|$)/,
  /^\/(premium|compare-plans|subscription-comparison|get-super-likes|get-boosts|buy-credits|buy-minutes|my-subscription|restore-purchase|redeem-code|manage-payment-account|donate|loyalty-rewards|my-stars|cuban-cashout|cuban-donations)(\/|$)/,
  /^\/(auth|login|signup|onboarding|profile-setup|tourist-signup|cuban-signup|house-rules|verify|phone|reset-password|update-password|welcome)(\/|$)/,
  /^\/(admin|agent-dashboard|staff-login|support)(\/|$)/,
  /^\/(privacy|terms|cookie-policy|cookies|consumer-health-privacy|licenses|regulations|dating-regulations|community-guidelines)(\/|$)/,
];

export function isAdFreeRoute(pathname: string): boolean {
  return AD_FREE_ROUTES.some((re) => re.test(pathname));
}

/** May `placement` render on `pathname`? */
export function placementAllowedOn(placement: AdPlacement, pathname: string): boolean {
  const spec = PLACEMENTS[placement];
  return !!spec && !isAdFreeRoute(pathname) && spec.routes.test(pathname);
}

// ---------------------------------------------------------------------------
// Positions inside lists and feeds
// ---------------------------------------------------------------------------
export const LIST_AD_AFTER_ROWS = 3;
export const FEED_AD_EVERY = 6;

/**
 * Lists (Matches, Messages, Likes): the index of the item the banner follows
 * (after the 3rd row; `columns` items per row in a grid), or -1 = at the top
 * of a list shorter than that.
 */
export function listAdAfterIndex(itemCount: number, columns = 1): number {
  const after = LIST_AD_AFTER_ROWS * Math.max(1, columns);
  return itemCount >= after ? after - 1 : -1;
}

/** Feeds: an inline card after every 6th item; a feed shorter than that gets one at its end. */
export function feedAdAfter(index: number, itemCount: number): boolean {
  if (itemCount <= 0 || index < 0 || index >= itemCount) return false;
  if (itemCount < FEED_AD_EVERY) return index === itemCount - 1;
  return (index + 1) % FEED_AD_EVERY === 0;
}

// ---------------------------------------------------------------------------
// Build configuration (all optional)
// ---------------------------------------------------------------------------
function flag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  return !/^(0|false|no|off)$/i.test(value.trim());
}

/** An https origin (+ optional path) without trailing slash; http only for local testing. Invalid = null. */
export function cleanBaseUrl(value: string | undefined): string | null {
  try {
    const url = new URL((value ?? "").trim());
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** "ca-pub-" + 10 to 20 digits, as AdSense shows it. */
export function cleanAdSenseClient(value: string | undefined): string | null {
  const v = (value ?? "").trim();
  return /^ca-pub-\d{10,20}$/.test(v) ? v : null;
}

// (import.meta.env is undefined when the logic checks in e2e/ads-e2e.mjs import this file in Node.)
const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
const takatakBase = cleanBaseUrl(env.VITE_TAKATAK_ADS_URL || "https://takatak.ca");
const adsenseClient = cleanAdSenseClient(env.VITE_ADSENSE_CLIENT);
const slotId = (v: string | undefined) => (/^\d{4,20}$/.test((v ?? "").trim()) ? (v as string).trim() : null);

export const ADS_CONFIG = {
  takatak: {
    enabled: flag(env.VITE_TAKATAK_ADS_ENABLED, true) && takatakBase !== null,
    baseUrl: takatakBase ?? "",
    publisher: (env.VITE_TAKATAK_ADS_PUBLISHER || "isexy").trim() || "isexy",
  },
  adsense: {
    client: adsenseClient,
    slots: {
      DISCOVER: slotId(env.VITE_ADSENSE_SLOT_DISCOVER),
      LIST: slotId(env.VITE_ADSENSE_SLOT_LIST),
      FEED: slotId(env.VITE_ADSENSE_SLOT_FEED),
      PROFILE: slotId(env.VITE_ADSENSE_SLOT_PROFILE),
      CONTENT: slotId(env.VITE_ADSENSE_SLOT_CONTENT),
    } as Record<PlacementSpec["adsenseKey"], string | null>,
  },
} as const;

/** The AdSense unit id for a placement, or null when AdSense is off for it. */
export function adsenseSlotFor(placement: AdPlacement): string | null {
  if (!ADS_CONFIG.adsense.client) return null;
  return ADS_CONFIG.adsense.slots[PLACEMENTS[placement].adsenseKey] ?? null;
}

// ---------------------------------------------------------------------------
// TAKATAK ads (takatak-v1 src/app/api/ads/{serve,events,click})
// ---------------------------------------------------------------------------
export interface AdsContext {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  postalPrefix?: string | null;
  category?: string | null;
  locale?: string | null;
  device?: string | null;
}

/** A served ad, checked and trimmed: only these fields ever reach the page (as text, never HTML). */
export interface TakatakAd {
  campaignId: string;
  creativeId: string;
  headline: string;
  body: string | null;
  callToAction: string | null;
  /** Where a tap goes: TAKATAK's signed click redirect when tracking is on, else the advertiser's page. */
  href: string;
  /** True when `href` is TAKATAK's click redirect (it records the click itself). */
  clickTracked: boolean;
  imageUrl: string | null;
  label: "Publicité" | "Advertisement";
  trackingToken: string | null;
  trackingEnabled: boolean;
}

export function adDevice(width = typeof window === "undefined" ? 1024 : window.innerWidth): "mobile" | "tablet" | "desktop" {
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

/**
 * Targeting context. Contextual by default (language, device, category);
 * the city and country on the member's profile are added only with the
 * Advertising consent. Never a name, email, phone, id or message.
 */
export function buildAdsContext(opts: {
  language: string;
  personalized: boolean;
  city?: string | null;
  country?: string | null;
}): AdsContext {
  const short = (v: string | null | undefined, max: number) => {
    const t = (v ?? "").trim();
    return t ? t.slice(0, max) : undefined;
  };
  const ctx: AdsContext = {
    category: "social",
    locale: (opts.language || "en").slice(0, 2).toLowerCase(),
    device: adDevice(),
  };
  if (opts.personalized) {
    const country = short(opts.country, 80);
    const city = short(opts.city, 120);
    if (country) ctx.country = country;
    if (city) ctx.city = city;
  }
  return ctx;
}

function httpUrl(value: unknown, { allowHttp = false } = {}): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || ((allowHttp || local) && url.protocol === "http:")) return url.toString();
    return null;
  } catch {
    return null;
  }
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Validate a /api/ads/serve answer. Anything unexpected = no ad (fail closed). */
export function parseServedAd(json: unknown): TakatakAd | null {
  if (!json || typeof json !== "object") return null;
  const res = json as Record<string, unknown>;
  if (res.ok !== true || res.filled !== true || !res.ad || typeof res.ad !== "object") return null;
  const ad = res.ad as Record<string, unknown>;
  const headline = text(ad.headline, 90);
  const destination = httpUrl(ad.destinationUrl, { allowHttp: true });
  if (!headline || !destination || typeof ad.campaignId !== "string" || typeof ad.creativeId !== "string") return null;
  const clickUrl = httpUrl(ad.clickUrl);
  const token = typeof ad.trackingToken === "string" && ad.trackingToken.length > 0 && ad.trackingToken.length < 4096 ? ad.trackingToken : null;
  return {
    campaignId: ad.campaignId,
    creativeId: ad.creativeId,
    headline,
    body: text(ad.body, 140),
    callToAction: text(ad.callToAction, 24),
    href: clickUrl ?? destination,
    clickTracked: !!clickUrl,
    imageUrl: httpUrl(ad.imageUrl),
    label: ad.label === "Publicité" ? "Publicité" : "Advertisement",
    trackingToken: token,
    trackingEnabled: ad.trackingEnabled === true && !!token,
  };
}

const SERVE_TIMEOUT_MS = 4000;

/** Ask TAKATAK for one ad for this placement. null = no fill, off, or any error. */
export async function fetchTakatakAd(placement: AdPlacement, context: AdsContext, signal?: AbortSignal): Promise<TakatakAd | null> {
  if (!ADS_CONFIG.takatak.enabled) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SERVE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`${ADS_CONFIG.takatak.baseUrl}/api/ads/serve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publisherCode: ADS_CONFIG.takatak.publisher, placementCode: placement, context }),
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return parseServedAd(await res.json());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Impression or click event for a served ad (only when TAKATAK enabled tracking for it).
 * No `keepalive`: the JSON body needs a CORS preflight, which some browsers refuse
 * for keepalive requests; the page stays open anyway (ads open in a new tab).
 */
export function sendTakatakEvent(ad: TakatakAd, eventType: "impression" | "click", context: AdsContext): void {
  if (!ADS_CONFIG.takatak.enabled || !ad.trackingEnabled || !ad.trackingToken) return;
  try {
    fetch(`${ADS_CONFIG.takatak.baseUrl}/api/ads/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingToken: ad.trackingToken, eventType, context }),
      credentials: "omit",
      cache: "no-store",
    }).catch(() => undefined);
  } catch {
    /* never let ad tracking break the page */
  }
}

// ---------------------------------------------------------------------------
// Google AdSense
// ---------------------------------------------------------------------------
type AdsByGoogle = unknown[] & { requestNonPersonalizedAds?: 0 | 1; pauseAdRequests?: 0 | 1 };

declare global {
  interface Window {
    adsbygoogle?: AdsByGoogle;
  }
}

export const ADSENSE_SCRIPT_ORIGIN = "https://pagead2.googlesyndication.com";
let adsenseLoad: Promise<boolean> | null = null;

/**
 * Personalized ads only with the Advertising consent; otherwise every
 * request asks for non-personalized ads. Applies to the next ad requests.
 */
export function setAdSensePersonalization(personalized: boolean): void {
  const q = (window.adsbygoogle = window.adsbygoogle || ([] as unknown as AdsByGoogle));
  q.requestNonPersonalizedAds = personalized ? 0 : 1;
}

/** Load adsbygoogle.js once. Resolves false when it cannot load (blocked, offline). */
export function loadAdSense(personalized: boolean): Promise<boolean> {
  const client = ADS_CONFIG.adsense.client;
  if (!client) return Promise.resolve(false);
  // Before the script runs, so the very first request already follows the consent.
  setAdSensePersonalization(personalized);
  if (adsenseLoad) return adsenseLoad;
  adsenseLoad = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `${ADSENSE_SCRIPT_ORIGIN}/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    s.onload = () => resolve(true);
    s.onerror = () => {
      adsenseLoad = null; // a later page may try again
      s.remove();
      resolve(false);
    };
    document.head.appendChild(s);
  });
  return adsenseLoad;
}

/** Ask AdSense to fill one <ins class="adsbygoogle"> (once per element). */
export function pushAdSenseUnit(): boolean {
  try {
    (window.adsbygoogle = window.adsbygoogle || ([] as unknown as AdsByGoogle)).push({});
    return true;
  } catch {
    return false;
  }
}
