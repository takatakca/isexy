/**
 * Public site identity. Change the domain in one place: set VITE_SITE_URL
 * (e.g. https://isexy.ca) — canonical URLs, social tags, structured data and
 * the generated sitemap/robots all follow it.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://isexy.lovable.app").replace(/\/+$/, "");
export const SITE_NAME = "ISEXY";
export const SITE_TAGLINE = "Premium Dating for Canada & Cuba";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;
export const LOGO_URL = `${SITE_URL}/icons/icon-512.png`;

export const SUPPORT = {
  email: "cubaresort.ca@gmail.com",
  phoneCanada: "+1-450-999-4999",
  phoneCuba: "+53-5307-1185",
} as const;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
