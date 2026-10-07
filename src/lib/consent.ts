/**
 * Privacy consent (Québec Law 25, PIPEDA, GDPR-style opt-in).
 *
 * - "necessary" is always on (sign-in session, security, language).
 * - "analytics" (first-party product analytics, GA4) and "marketing"
 *   (Meta Pixel / ad measurement) are OFF until the visitor opts in.
 * - Global Privacy Control (navigator.globalPrivacyControl) is honoured: the
 *   banner never pre-selects marketing for those visitors.
 */
export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp of the visitor's choice; null = not decided yet. */
  decidedAt: string | null;
  version: number;
}

export const CONSENT_VERSION = 1;
const STORAGE_KEY = "isexy_consent";
const CHANGE_EVENT = "isexy:consent-changed";
const OPEN_EVENT = "isexy:open-consent";

const DEFAULT: ConsentState = { analytics: false, marketing: false, decidedAt: null, version: CONSENT_VERSION };

export function getConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as ConsentState;
    // A new consent version (new purposes) asks again.
    if (parsed.version !== CONSENT_VERSION) return DEFAULT;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export function setConsent(choice: { analytics: boolean; marketing: boolean }) {
  const next: ConsentState = { ...choice, decidedAt: new Date().toISOString(), version: CONSENT_VERSION };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the choice still applies for this page view */
  }
  window.dispatchEvent(new CustomEvent<ConsentState>(CHANGE_EVENT, { detail: next }));
}

export function onConsentChange(listener: (state: ConsentState) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<ConsentState>).detail);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

/** Re-open the consent dialog (footer link, Settings, Cookie Policy page). */
export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenConsentSettings(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

export function prefersNoTracking(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || navigator.doNotTrack === "1";
}
