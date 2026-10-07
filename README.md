# ISEXY

Premium dating for Canada 🇨🇦 and Cuba 🇨🇺 — swipe matching, chat with live
translation, video calls, PhoneLine voice dating, gifts and Cuban rewards, and
an AI concierge, built on React + Supabase and connected to the TAKATAK v1
identity platform.

## Stack

| Layer | Tech |
| --- | --- |
| Web app | Vite · React 18 · TypeScript · Tailwind · shadcn/ui (routes lazy-loaded) |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions on Deno) |
| AI | `ai-chat` edge function → Lovable AI gateway, grounded in the `knowledge_base` table |
| Identity | `takatak-bridge` edge function → TAKATAK v1 master API (`/api/v1/*`) |
| Payments | Stripe (subscriptions, credits, minutes) |

## Run locally

```sh
npm ci
npm run dev          # http://localhost:8080
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

`.env` holds only public values (Supabase URL + publishable key).

## AI concierge & Help Center

- The floating **Concierge** popup (`src/components/AIChatWidget.tsx`) works for
  guests and members, answers in English / Español / Français, cites Help Center
  articles, can be stopped mid-answer, and hands off to a human agent
  (`live_chat_sessions`, visible in `/agent-dashboard`).
- `supabase/functions/ai-chat` validates input, rate-limits, retrieves the most
  relevant published `knowledge_base` articles, streams the answer and stores
  the transcript server-side. Requires the `LOVABLE_API_KEY` function secret
  (optional `AI_CHAT_MODEL`).
- Help Center (`/knowledge-base`) supports `?q=`, `?category=` and
  `?article=<id>` deep links; any page can open the concierge with
  `openAssistant(question)` from `src/lib/assistant.ts`.

## TAKATAK v1 integration

TAKATAK v1 (`takatakca/takatak-v1`) is the shared identity authority. Its master
API is server-to-server only, so the browser never sees its key:

| Action | What it does |
| --- | --- |
| `status` | Tells the app whether TAKATAK is configured |
| `sync` | After sign-in, projects the member into a TAKATAK master identity (`takatak_identity_links`) |
| `phone_send` / `phone_verify` | Phone sign-in: TAKATAK sends + verifies the SMS code, then the bridge issues a normal ISEXY session |

Function secrets: `TAKATAK_API_URL` (e.g. `https://takatak.ca`) and
`TAKATAK_ISEXY_API_KEY` (dedicated ≥ 32-char key). Until both are set, phone
sign-in shows an email fallback and sync is a silent no-op.

> **TAKATAK side still required:** TAKATAK v1's master API currently accepts
> only the 1LV key and `source_application: "1lv"`. It needs a dedicated
> `TAKATAK_ISEXY_API_KEY` accepted on `/api/v1/auth/otp/send`,
> `/api/v1/auth/otp/verify` and `/api/v1/identity/resolve-person` (with
> `source_application: "isexy"`). Never reuse the 1LV key for ISEXY.

## SEO

- **One source of truth:** `src/seo/routes.json` (title, description, sitemap
  priority, indexability) feeds both the in-app `RouteSeo` tags and the
  build-time generator.
- **Domain:** set `VITE_SITE_URL` (default `https://isexy.lovable.app`); switch
  to `https://isexy.ca` and every canonical, social tag, sitemap and JSON-LD URL
  follows.
- `npm run build` runs `scripts/generate-seo.mjs`, which writes `sitemap.xml`
  (public pages + every published Help Center article), `robots.txt`
  (private app screens disallowed), `llms.txt`, and a pre-rendered `<head>` for
  each public page so link previews and non-JS crawlers see real metadata.
- Private app screens are `noindex`; Help Center articles live at
  `/knowledge-base/:id` with Article + Breadcrumb JSON-LD; the home page ships
  Organization, WebSite (sitelinks search) and WebApplication schema.
- Brand assets: `public/og-image.png` (1200×630), PWA `manifest.webmanifest`,
  icons (192/512/maskable/apple-touch), SVG favicon.

## Analytics & privacy

- Nothing is tracked until the visitor opts in through the consent banner
  (Québec Law 25 / PIPEDA). "Essential only" is as easy as "Accept all";
  choices can be changed from Settings or the Cookie Policy page.
- `track(event, props)` (`src/lib/analytics.ts`) sends batched first-party
  events to Supabase (`track_events` RPC → admin-only `analytics_events`),
  plus optional Google Analytics 4 (`VITE_GA4_ID`, Consent Mode v2) and Meta
  Pixel (`VITE_META_PIXEL_ID`, marketing consent only).
- Funnel events: `page_view`, `sign_up`, `login`, `profile_completed`, `like`,
  `super_like`, `match`, `message_sent`, `checkout_started`,
  `assistant_message`, `assistant_handoff`, `help_article_view`, plus
  real-user Core Web Vitals (`web_vital`).
- Admin → Analytics → **Product** shows the funnel, daily sessions, sources, top
  pages and Web Vitals (`analytics_overview` RPC, admins only).
- Retention: run `select purge_old_telemetry();` on a schedule (events 13
  months, errors 90 days).

## Reliability

- A route-level error boundary shows a recovery screen instead of a blank page
  and resets on navigation; errors are reported (no personal data) to the
  admin-only `client_errors` table.
- After a deploy, a visitor holding an old tab automatically reloads once if a
  lazy-loaded page file is gone.

## Database

Migrations live in `supabase/migrations`. The October 2026 revamp
(`20261007120000_revamp_profile_kb_takatak.sql`) adds the profile fields edited
in Edit Profile, safe Help Center view/feedback counters, the TAKATAK identity
link table, the bot→agent transcript link, and cleans legacy Help Center
content. `20261007130000_analytics_and_client_errors.sql` adds analytics,
error reporting and the admin overview.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: install,
typecheck, production build, Deno type-check of the AI and TAKATAK edge
functions, and a lint report. It does not deploy.

## Stripe Subscription Setup (admin only)

To create the ISEXY subscription products and prices in Stripe automatically:

1. Install the Stripe SDK locally if not present:
   ```
   npm install stripe
   ```
2. Run the setup script with your Stripe secret key:
   ```
   STRIPE_SECRET_KEY=sk_test_or_live_key node scripts/create-stripe-subscriptions.mjs
   ```
3. The script will print 9 `STRIPE_PRICE_*` env vars and `APP_URL`. Copy them
   into Lovable / Supabase project secrets.
4. After secrets are added, re-deploy edge functions (automatic in Lovable).

The script:
- Refuses to run without `STRIPE_SECRET_KEY`.
- Never logs the secret key.
- Prints whether it ran in TEST or LIVE mode.
- Reuses existing products/prices by metadata to avoid duplicates.
