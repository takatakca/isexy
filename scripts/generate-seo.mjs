#!/usr/bin/env node
/**
 * Post-build SEO generator (runs after `vite build`).
 *
 * Writes into dist/:
 *   sitemap.xml  – public routes (src/seo/routes.json) + published Help Center articles
 *   robots.txt   – allows public pages, keeps private app screens out of search
 *   llms.txt     – site map for AI assistants / answer engines
 *   <route>/index.html – copy of the SPA shell with that page's title,
 *                  description, canonical and social tags pre-rendered, so link
 *                  previews and non-JS crawlers see the right metadata.
 *
 * Never fails the build: if Supabase is unreachable, articles are skipped.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

async function loadDotEnv() {
  const env = {};
  // Later files override earlier ones, like Vite.
  for (const file of [".env", ".env.production", ".env.local"]) {
    const p = path.join(root, file);
    if (!existsSync(p)) continue;
    for (const line of (await readFile(p, "utf8")).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return env;
}

const fileEnv = await loadDotEnv();
const env = (k) => process.env[k] || fileEnv[k] || "";
const SITE_URL = (env("VITE_SITE_URL") || "https://isexy.lovable.app").replace(/\/+$/, "");
const SUPABASE_URL = env("VITE_SUPABASE_URL");
const SUPABASE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const today = new Date().toISOString().slice(0, 10);

const { routes } = JSON.parse(await readFile(path.join(root, "src/seo/routes.json"), "utf8"));
const publicRoutes = routes.filter((r) => r.index !== false);

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clean = (t) =>
  String(t ?? "")
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/cubadate\.com/gi, "isexy.ca")
    .replace(/CubaDate/g, "ISEXY");
const plain = (t, n = 155) => {
  const s = clean(t).replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

async function fetchArticles() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/knowledge_base?select=id,title,content,category,updated_at&is_published=eq.true&order=view_count.desc&limit=500`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, signal: controller.signal },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).map((a) => ({ ...a, title: clean(a.title), content: clean(a.content) }));
  } catch (e) {
    console.warn(`[seo] Help Center articles skipped (${e.message})`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const articles = await fetchArticles();

// ---- sitemap.xml -----------------------------------------------------------
const urls = [
  ...publicRoutes.map(
    (r) =>
      `  <url><loc>${SITE_URL}${r.path}</loc><lastmod>${today}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${Number(r.priority).toFixed(1)}</priority></url>`,
  ),
  ...articles.map(
    (a) =>
      `  <url><loc>${SITE_URL}/knowledge-base/${a.id}</loc><lastmod>${(a.updated_at || today).slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
  ),
];
await writeFile(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
);

// ---- robots.txt ------------------------------------------------------------
const PRIVATE = [
  "/admin", "/agent-dashboard", "/staff-login", "/discover", "/explore/", "/likes", "/matches", "/chat/",
  "/group-chat/", "/video-call/", "/phone-line", "/profile", "/edit-profile", "/edit-bio", "/settings",
  "/my-subscription", "/buy-credits", "/buy-minutes", "/who-liked-you", "/passport-mode", "/web-profile",
  "/block-report/", "/donate/", "/profile-setup", "/verify", "/update-password", "/reset-password",
];
await writeFile(
  path.join(dist, "robots.txt"),
  [
    "# ISEXY — generated at build time by scripts/generate-seo.mjs",
    "User-agent: *",
    "Allow: /",
    ...PRIVATE.map((p) => `Disallow: ${p}`),
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n"),
);

// ---- llms.txt --------------------------------------------------------------
await writeFile(
  path.join(dist, "llms.txt"),
  [
    "# ISEXY",
    "",
    "> ISEXY is a premium dating platform connecting Canadians with Cuban singles: verified profiles, live chat translation (English/Spanish/French), HD video calls, a private phone line, gifts and ETECSA recharges, and an AI dating concierge. Based in Montréal, Canada.",
    "",
    "Support: cubaresort.ca@gmail.com · Canada +1 450 999 4999 · Cuba +53 5307 1185",
    "",
    "## Pages",
    "",
    ...publicRoutes.map((r) => `- [${r.title}](${SITE_URL}${r.path}): ${r.description}`),
    ...(articles.length
      ? ["", "## Help Center", "", ...articles.map((a) => `- [${a.title}](${SITE_URL}/knowledge-base/${a.id}): ${plain(a.content, 140)}`)]
      : []),
    "",
  ].join("\n"),
);

// ---- Pre-rendered heads ----------------------------------------------------
const shell = await readFile(path.join(dist, "index.html"), "utf8");

function withHead(html, { title, description, url, type = "website" }) {
  const t = esc(title);
  const d = esc(description);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>\n    <link rel="canonical" href="${url}" />`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${type}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`);
}

async function writePage(routePath, meta) {
  const dir = path.join(dist, ...routePath.split("/").filter(Boolean));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), withHead(shell, meta));
}

const home = publicRoutes.find((r) => r.path === "/");
if (home) {
  await writeFile(path.join(dist, "index.html"), withHead(shell, { ...home, url: `${SITE_URL}/` }));
}
for (const r of publicRoutes.filter((r) => r.path !== "/")) {
  await writePage(r.path, { ...r, url: `${SITE_URL}${r.path}` });
}
for (const a of articles) {
  await writePage(`/knowledge-base/${a.id}`, {
    title: `${a.title} — ISEXY Help Center`,
    description: plain(a.content),
    url: `${SITE_URL}/knowledge-base/${a.id}`,
    type: "article",
  });
}

console.log(
  `[seo] ${SITE_URL}: sitemap ${urls.length} URLs, ${publicRoutes.length} pages + ${articles.length} articles pre-rendered`,
);
