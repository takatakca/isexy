# ISEXY

A Canadian social network for adults (18+): member profiles, swipes to find
people to talk with and become friends, chat with live translation, phone
calls, webcam video calls and PhoneLine voice messages, plus an AI concierge.
Launching in Canada (English and French). Positioning and what changed:
[`docs/REPOSITIONING.md`](docs/REPOSITIONING.md).

A GROUPE TAKATAK app: it runs on **TAKATAK V1** (Supabase project
`pcjfahhlozsseqqevimi`, shared with takatak.ca) in its own `isexy` schema, and
members sign in with **Takatak Auth**. Live at https://isexy.onrender.com
(Render, auto-deployed from `main`).

## Stack

| Layer | Tech |
| --- | --- |
| Web app | Vite · React 18 · TypeScript · Tailwind · shadcn/ui (routes lazy-loaded) |
| Backend | TAKATAK V1 Supabase: Postgres `isexy` schema + RLS, Storage (`isexy-*` buckets), Realtime, Edge Functions (`isexy-*`, Deno) |
| Identity | Takatak Auth on V1 (shared `auth.users`): Google, email code, SMS code. `isexy.profiles.id = user_id = auth.users.id` |
| AI | `isexy-ai-chat` / `isexy-translate-message` → Claude (Anthropic API), grounded in `isexy.knowledge_base` |
| Payments | Stripe, server-side only (checkout sessions + webhook in edge functions) |
| Hosting | Render static site `isexy` (rewrite `/*` → `/index.html`) |

## Run locally

```sh
npm ci
npm run dev          # http://localhost:8080
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

`.env` holds only public values (V1 URL + anon key). Moving off Lovable and
onto V1, and every human step that remains: [`docs/V1-MIGRATION.md`](docs/V1-MIGRATION.md).

## AI concierge & Help Center

- The floating **Concierge** popup (`src/components/AIChatWidget.tsx`) works for
  guests and members, answers in English / Español / Français, cites Help Center
  articles, can be stopped mid-answer, and hands off to a human agent
  (`live_chat_sessions`, visible in `/agent-dashboard`).
- `supabase/functions/isexy-ai-chat` validates input, rate-limits, retrieves the most
  relevant published `knowledge_base` articles, streams the answer and stores
  the transcript server-side. Answers come from Claude (`claude-opus-5-5` by
  default, low effort, server-side refusal fallback). Requires the
  `ISEXY_ANTHROPIC_API_KEY` function secret (optional `ISEXY_AI_CHAT_MODEL`).
- Help Center (`/knowledge-base`) supports `?q=`, `?category=` and
  `?article=<id>` deep links; any page can open the concierge with
  `openAssistant(question)` from `src/lib/assistant.ts`.

## Takatak Auth (TAKATAK V1)

ISEXY has no accounts of its own: a member signs in with their TAKATAK account
(`src/components/TakatakSignIn.tsx`), by Google, an email code or an SMS code,
on V1's shared `auth.users`. No passwords. The ISEXY profile is created by the
signup flow (`/profile-setup`, `/cuban-signup`, `/tourist-signup`) and is keyed
by the auth user id. Nothing is added to `auth.users` (no trigger), so a
takatak.ca account only becomes an ISEXY member when that person signs up here.
Staff (`/staff-login`) use the same sign-in; `isexy.user_roles` grants
admin/moderator.

## Core experience (Discover · Matches · Chat)

- **Discover** (`useDiscoverDeck` + `SwipeDeck` + `useSwipeGesture`): the deck
  comes from `get_discover_feed` in one query (mutual preferences, age range,
  blocks, already-swiped, ranking, distance and photos). Swipes are
  optimistic — the card leaves instantly, the server call runs in the
  background and a refused swipe (limits, errors) puts the card back. The
  gesture moves the card without React re-renders; flick, spring-back,
  keyboard (← → ↑, Backspace = undo) and haptics are supported. Explore
  categories use the same engine with an interests filter.
- **Matches** (`fetchInbox`): `get_my_conversations` returns the whole inbox in
  one call (was 5 queries per match), updates live over Realtime, with real
  search, a "New matches" row and relative times.
- **Chat**: messages appear instantly (optimistic, confirmed or rolled back),
  incoming messages render before translation, history is translated on open
  (4 at a time), real typing indicator over Realtime broadcast, latest 200
  messages loaded, smart scrolling.

## Security fixes (October 2026)

- `perform_like`, `check_swipe_rate_limit`, `use_boost`, `redeem_coupon`,
  `unlock_conversation` and `sync_entitlements` trusted a client-supplied
  profile id. They now verify ownership (`assert_profile_owner`); originals
  live on as `*_unchecked`, callable only by the service role.
- `send-notification-email` was a public open relay (any recipient, any
  HTML). Members can now only trigger a throttled "new message" email to the
  other participant of their own match; the recipient is resolved server-side
  and all interpolated text is escaped.
- Explore categories no longer bypass like limits; `/explore/:category`,
  `/agent-dashboard` require sign-in / staff role.

## SEO

- **One source of truth:** `src/seo/routes.json` (title, description, sitemap
  priority, indexability) feeds both the in-app `RouteSeo` tags and the
  build-time generator.
- **Domain:** set `VITE_SITE_URL` (default `https://isexy.onrender.com`); switch
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

ISEXY's tables, functions, policies and triggers live in the `isexy` schema on
TAKATAK V1; V1's `public` schema is never touched. Migrations are in
`supabase/isexy-migrations/` and run through `scripts/isexy/migrate.sh`
(dry run by default, `--apply` to apply, tracked in `isexy.schema_migrations`),
never `supabase db push` (V1's migration history belongs to takatak-v1).
`0001_isexy_baseline.sql` is the Lovable-era history converted by
`scripts/isexy/convert-lovable-migrations.mjs`; add new work as
`0003_<name>.sql`, `0004_…`. Applied files are immutable (checksummed).

## CI/CD

`.github/workflows/ci-cd.yml`: every push runs typecheck, build, `deno check`
of every `isexy-*` function, the migrations on a Postgres stand-in of V1 (with a
guard proving V1's objects are unchanged) and the V1 safety rules. On `main`,
it applies migrations with `migrate.sh` and deploys each `isexy-*` function by
name, once the `ISEXY_DB_URL` / `SUPABASE_ACCESS_TOKEN` secrets exist. Render
deploys the website itself. Details: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

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
3. The script will print 9 `STRIPE_PRICE_*` env vars and `APP_URL`. Add each one
   on TAKATAK V1 as an **`ISEXY_`-prefixed** function secret (e.g.
   `ISEXY_STRIPE_PRICE_GOLD_MONTH`, `ISEXY_APP_URL`). See `docs/V1-MIGRATION.md` › Stripe.
4. Function secrets apply on the next invocation; no redeploy needed.

The script:
- Refuses to run without `STRIPE_SECRET_KEY`.
- Never logs the secret key.
- Prints whether it ran in TEST or LIVE mode.
- Reuses existing products/prices by metadata to avoid duplicates.
