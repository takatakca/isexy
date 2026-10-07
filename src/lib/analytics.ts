/**
 * Product analytics — consent-gated, first-party by default.
 *
 *   track("match", { source: "discover" })
 *
 * Destinations (each only after the matching consent):
 *   • First-party: batched into Supabase via the track_events RPC (analytics consent)
 *   • Google Analytics 4: when VITE_GA4_ID is set (analytics consent, Consent Mode v2)
 *   • Meta Pixel: when VITE_META_PIXEL_ID is set (marketing consent)
 *
 * Never put personal data (names, emails, message text, phone numbers) in props.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getConsent, onConsentChange, type ConsentState } from "@/lib/consent";

type Props = Record<string, string | number | boolean | null | undefined>;

interface QueuedEvent {
  event: string;
  props: Props;
  path: string;
  referrer: string | null;
  utm: Record<string, string> | null;
  session_id: string;
  anonymous_id: string | null;
  locale: string;
  device: string;
}

const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const PII_KEY = /(email|phone|name|message|content|address|password|token|card)/i;
const MAX_QUEUE = 100;

let consent: ConsentState = getConsent();
let queue: QueuedEvent[] = [];
let flushTimer: number | undefined;
let initialized = false;
let gaLoaded = false;
let pixelLoaded = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

// ---------------------------------------------------------------------------
// Identity: session id per tab session; anonymous id only stored after consent.
// ---------------------------------------------------------------------------
function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("isexy_sid");
    if (!id) {
      id = randomId();
      sessionStorage.setItem("isexy_sid", id);
    }
    return id;
  } catch {
    return "nostorage";
  }
}

function anonymousId(): string | null {
  if (!consent.analytics) return null;
  try {
    let id = localStorage.getItem("isexy_aid");
    if (!id) {
      id = randomId();
      localStorage.setItem("isexy_aid", id);
    }
    return id;
  } catch {
    return null;
  }
}

/** First-touch attribution, kept for the tab session. */
function attribution(): { referrer: string | null; utm: Record<string, string> | null } {
  try {
    const cached = sessionStorage.getItem("isexy_attr");
    if (cached) return JSON.parse(cached);
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"]) {
      const v = params.get(key);
      if (v) utm[key] = v.slice(0, 100);
    }
    const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : null;
    const value = { referrer: ref ? ref.slice(0, 300) : null, utm: Object.keys(utm).length ? utm : null };
    sessionStorage.setItem("isexy_attr", JSON.stringify(value));
    return value;
  } catch {
    return { referrer: null, utm: null };
  }
}

function device(): string {
  const w = window.innerWidth;
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

function locale(): string {
  try {
    return (localStorage.getItem("preferred_language") || navigator.language || "en").slice(0, 8);
  } catch {
    return "en";
  }
}

function sanitize(props: Props = {}): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (PII_KEY.test(k) || v === undefined) continue;
    out[k.slice(0, 40)] = typeof v === "string" ? v.slice(0, 120) : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Third-party loaders (only ever called after consent)
// ---------------------------------------------------------------------------
function loadScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function loadGa4() {
  if (!GA4_ID || gaLoaded) return;
  gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });
  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, { send_page_view: false, anonymize_ip: true });
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`);
}

function loadMetaPixel() {
  if (!META_PIXEL_ID || pixelLoaded) return;
  pixelLoaded = true;
  const fbq = function (...args: unknown[]) {
    (fbq.queue = fbq.queue || []).push(args);
  } as NonNullable<Window["fbq"]>;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  loadScript("https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", META_PIXEL_ID);
}

function applyConsent(next: ConsentState) {
  consent = next;
  if (consent.analytics) loadGa4();
  else if (gaLoaded) window.gtag?.("consent", "update", { analytics_storage: "denied" });
  if (consent.marketing) {
    loadMetaPixel();
    window.gtag?.("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
  }
  if (!consent.analytics) queue = [];
  else scheduleFlush();
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------
async function flush() {
  flushTimer = undefined;
  if (!consent.analytics || queue.length === 0) return;
  const batch = queue.splice(0, 25);
  const { error } = await supabase.rpc("track_events", { p_events: batch as unknown as Json });
  if (error && queue.length < MAX_QUEUE) {
    // Database not migrated yet or offline: drop silently, analytics must never break the app.
    if (import.meta.env.DEV) console.debug("[analytics] dropped batch:", error.message);
  }
  if (queue.length) scheduleFlush();
}

function scheduleFlush(delay = 4000) {
  if (flushTimer !== undefined || !consent.analytics) return;
  flushTimer = window.setTimeout(flush, delay);
}

function flushOnExit() {
  if (!consent.analytics || queue.length === 0) return;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/track_events`;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const body = JSON.stringify({ p_events: queue.splice(0, 25) });
  // keepalive lets the request finish while the page unloads.
  fetch(url, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body,
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function initAnalytics() {
  if (initialized) return;
  initialized = true;
  applyConsent(consent);
  onConsentChange(applyConsent);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnExit();
  });
  observeWebVitals();
}

export function track(event: string, props?: Props) {
  if (!consent.analytics) return;
  const clean = sanitize(props);
  const { referrer, utm } = attribution();
  if (queue.length < MAX_QUEUE) {
    queue.push({
      event,
      props: clean,
      path: window.location.pathname,
      referrer,
      utm,
      session_id: sessionId(),
      anonymous_id: anonymousId(),
      locale: locale(),
      device: device(),
    });
  }
  scheduleFlush(event === "page_view" ? 1500 : 4000);

  if (gaLoaded && window.gtag) window.gtag("event", event, clean);
  if (pixelLoaded && consent.marketing && window.fbq) {
    const standard: Record<string, string> = {
      page_view: "PageView",
      sign_up: "CompleteRegistration",
      checkout_started: "InitiateCheckout",
      purchase: "Purchase",
    };
    if (standard[event]) window.fbq("track", standard[event], clean);
    else window.fbq("trackCustom", event, clean);
  }
}

export function trackPageView(path: string) {
  track("page_view", { title: document.title.slice(0, 120), path });
}

// ---------------------------------------------------------------------------
// Core Web Vitals (LCP, CLS, INP approximation) — reported once per page load.
// ---------------------------------------------------------------------------
function observeWebVitals() {
  if (typeof PerformanceObserver === "undefined") return;
  let lcp = 0;
  let cls = 0;
  let inp = 0;
  const observe = (type: string, cb: (entries: PerformanceEntryList) => void) => {
    try {
      const po = new PerformanceObserver((list) => cb(list.getEntries()));
      po.observe({ type, buffered: true } as PerformanceObserverInit);
    } catch {
      /* unsupported entry type */
    }
  };
  observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1];
    if (last) lcp = last.startTime;
  });
  observe("layout-shift", (entries) => {
    for (const e of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (!e.hadRecentInput) cls += e.value;
    }
  });
  observe("event", (entries) => {
    for (const e of entries) inp = Math.max(inp, e.duration);
  });

  let reported = false;
  document.addEventListener("visibilitychange", () => {
    if (reported || document.visibilityState !== "hidden") return;
    reported = true;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (lcp) track("web_vital", { metric: "LCP", value: Math.round(lcp) });
    track("web_vital", { metric: "CLS", value: Number(cls.toFixed(3)) });
    if (inp) track("web_vital", { metric: "INP", value: Math.round(inp) });
    if (nav) track("web_vital", { metric: "TTFB", value: Math.round(nav.responseStart) });
    flushOnExit();
  }, { capture: true });
}
