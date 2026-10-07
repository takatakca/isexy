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

## Database

Migrations live in `supabase/migrations`. The October 2026 revamp
(`20261007120000_revamp_profile_kb_takatak.sql`) adds the profile fields edited
in Edit Profile, safe Help Center view/feedback counters, the TAKATAK identity
link table, the bot→agent transcript link, and cleans legacy Help Center
content.

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
