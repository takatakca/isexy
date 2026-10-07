/**
 * SEO + consent kit: the ONE settings file per site.
 *
 * Rules:
 * - Only facts already present in this repo. Never invent an address, hours, phone, rating or review.
 * - Unknown values stay `undefined` with a `TODO(owner)` comment; the JSON-LD builder skips them.
 * - `url` is the real production domain (see foodhubca/private/hosting/MOCHAHOST_DOMAINS.md), never *.lovable.app.
 */

export type SchemaType =
  | "Organization"
  | "LocalBusiness"
  | "Restaurant"
  | "NGO"
  | "SportsOrganization"
  | "Event";

export type PostalAddress = {
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode?: string | undefined;
  addressCountry: string;
};

export type SiteConfig = {
  /** Public business name. */
  name: string;
  /** Legal name if different (TODO(owner) when unknown). */
  legalName?: string | undefined;
  /** Real production origin, no trailing slash. */
  url: string;
  /** <html lang>. French first (Québec). */
  lang: "fr-CA";
  /** Open Graph locale. */
  locale: "fr_CA";
  defaultTitle: string;
  defaultDescription: string;
  /** Default share image: path under /public or absolute URL. undefined = no og:image. */
  ogImage?: string | undefined;
  /** Logo: path under /public or absolute URL. */
  logo?: string | undefined;
  schemaType: SchemaType;
  email?: string | undefined;
  /** E.164, e.g. "+15145550000". */
  phone?: string | undefined;
  address?: PostalAddress | undefined;
  /** Real social profile URLs only (no "#", no generic facebook.com). */
  sameAs: string[];
  /** Privacy policy route, used by the cookie banner. undefined = no page yet (TODO(owner)). */
  privacyPath?: string | undefined;
  /** Law 25 privacy officer. */
  privacyOfficer: { name?: string | undefined; email?: string | undefined };
};

export const SITE: SiteConfig = {
  name: "ISEXY",
  // As written on /privacy and /about. TODO(owner): confirm the registered legal name.
  legalName: "ISEXY Inc.",
  url: "https://isexy.ca",
  lang: "fr-CA",
  locale: "fr_CA",
  // TODO(owner): French title/description (site is English only today).
  defaultTitle: "ISEXY — Canadian & Cuban Dating App",
  defaultDescription:
    "ISEXY is the dating app connecting Canadians with Cuban singles. Verified profiles, voice-first phone line, and meaningful cross-border matches.",
  // Home hero image (portrait 1024x1536). TODO(owner): dedicated 1200x630 share image (og-default.jpg).
  ogImage: "/images/hero-bg.png",
  // TODO(owner): real logo file in /public (today only the Lovable favicon exists).
  logo: undefined,
  schemaType: "Organization",
  email: "cubaresort.ca@gmail.com",
  // TODO(owner): /privacy lists +1 450 999 4999; confirm before publishing it here.
  phone: undefined,
  // TODO(owner): street address (only "Montreal, Quebec, Canada" is known).
  address: undefined,
  // TODO(owner): real social profile URLs.
  sameAs: [],
  privacyPath: "/privacy",
  // TODO(owner): name of the person responsible for personal information (Law 25). Email from /privacy.
  privacyOfficer: { name: undefined, email: "cubaresort.ca@gmail.com" },
};
