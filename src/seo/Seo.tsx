/**
 * SEO + consent kit (Vite SPA only): applies seoTags() to <head> on each route.
 * index.html keeps the correct site defaults for crawlers that do not run JavaScript.
 *
 *   <Seo title="Contact | Site" description="…" path="/contact" />
 *   <SiteJsonLd />   (once, in App)
 */
import { useEffect } from "react";
import { seoTags, type SeoInput } from "@/seo/head";
import { siteJsonLd, websiteJsonLd } from "@/seo/jsonld";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function applySeo(input: SeoInput) {
  const { meta, links } = seoTags(input);
  for (const m of meta) {
    if ("title" in m) document.title = m.title;
    else if ("name" in m) upsertMeta("name", m.name, m.content);
    else upsertMeta("property", m.property, m.content);
  }
  if (!input.noindex) document.head.querySelector('meta[name="robots"]')?.remove();
  if (links.length === 0) {
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.head.querySelector('meta[property="og:url"]')?.remove();
  }
  for (const l of links) upsertLink(l.rel, l.href);
}

export function Seo(props: SeoInput) {
  const { title, description, path, image, noindex, type } = props;
  useEffect(() => {
    applySeo({ title, description, path, image, noindex, type });
  }, [title, description, path, image, noindex, type]);
  return null;
}

/** Injects the site Organization/LocalBusiness + WebSite JSON-LD once. */
export function SiteJsonLd() {
  useEffect(() => {
    const id = "site-jsonld";
    if (document.getElementById(id)) return;
    const el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    el.textContent = JSON.stringify([siteJsonLd(), websiteJsonLd()]);
    document.head.appendChild(el);
  }, []);
  return null;
}
