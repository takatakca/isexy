import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import routesData from "@/seo/routes.json";
import { OG_IMAGE, SITE_NAME, absoluteUrl } from "@/lib/site";
import { useLanguage } from "@/hooks/useLanguage";
import {
  faqSchema,
  organizationSchema,
  webApplicationSchema,
  websiteSchema,
} from "@/seo/structuredData";

interface RouteMeta {
  path: string;
  title: string;
  description: string;
  index?: boolean;
}

const ROUTES = new Map<string, RouteMeta>((routesData.routes as RouteMeta[]).map((r) => [r.path, r]));

const PAGE_SCHEMAS: Record<string, object[]> = {
  "/": [organizationSchema, websiteSchema, webApplicationSchema],
  "/faq": [faqSchema],
  "/about": [organizationSchema],
};

const FALLBACK: RouteMeta = {
  path: "/",
  title: `${SITE_NAME} — Premium Dating for Canada & Cuba`,
  description: "Meet verified Canadian and Cuban singles on ISEXY.",
  index: false,
};

const OG_LOCALES: Record<string, string> = { en: "en_CA", fr: "fr_CA", es: "es_ES" };

/**
 * Route-level head tags. Public marketing/help pages are indexable; every app
 * screen (discover, chat, settings, admin, profiles…) is noindex so private
 * surfaces never appear in search. Pages with richer data (Help Center
 * articles) override these tags with <Seo>.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const meta = ROUTES.get(normalized) ?? FALLBACK;
  const indexable = ROUTES.has(normalized) && meta.index !== false;
  const url = absoluteUrl(normalized);
  const schemas = PAGE_SCHEMAS[normalized] ?? [];
  const lang = ["en", "es", "fr"].includes(language.code) ? language.code : "en";

  return (
    <Helmet>
      <html lang={lang} />
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="robots" content={indexable ? "index,follow,max-image-preview:large" : "noindex,nofollow"} />
      {indexable && <link rel="canonical" href={url} />}
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="ISEXY — Premium dating between Canada and Cuba" />
      <meta property="og:locale" content={OG_LOCALES[lang]} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={OG_IMAGE} />
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
}
