# ISEXY → TAKATAK V1: migration and the human steps

ISEXY leaves Lovable and runs on **TAKATAK V1**: Supabase project
`pcjfahhlozsseqqevimi` ("TAKATAK User Official Dashboard V1", production,
shared with takatak.ca and `takatakca/takatak-v1`). The old Lovable Cloud
project `khvsudrwnqznuxnjurxp` only held test data and is being deleted:
nothing is copied from it.

This page lists what the code already does, then **every step a person must do**
(nothing below has been applied to V1, and no secret has been set).

---

## 1. What the code does (for review)

| Rule | How it is enforced |
| --- | --- |
| Never touch V1's `public` schema or Prisma models | Every ISEXY table, view, function, type, policy and trigger is in the **`isexy`** schema. The browser client uses `createClient(url, key, { db: { schema: 'isexy' } })`; every edge function goes through `supabase/functions/_shared/supabase.ts`, which pins the same schema. |
| No `supabase db push` on V1 | `supabase/migrations/` is gone. ISEXY migrations live in `supabase/isexy-migrations/` and run only through `scripts/isexy/migrate.sh`, tracked in their own table `isexy.schema_migrations` (version + SHA-256; applied files are immutable). CI fails if `db push` appears anywhere. |
| Dry run first | `migrate.sh` (no flag) runs all pending migrations in **one transaction and rolls it back**. `--apply` runs one transaction per migration. CI runs the dry run, then the apply. |
| Prove V1 is untouched | Before and after each run, `scripts/isexy/guard.sql` fingerprints V1's `public` schema (tables, columns, functions, types, grants, RLS, policies), triggers and policies on `auth`, policies on `realtime`, non-ISEXY storage policies and buckets, and the non-isexy realtime tables. Any difference raises an error and rolls back. Tested: altering `public.profiles`, adding a trigger on `auth.users` or changing a V1 bucket are each rejected. |
| Shared things stay shared safely | Storage buckets are `isexy-*`, storage policies are named `isexy: …`. Realtime tables are added to `supabase_realtime` one by one (idempotent). `CREATE EXTENSION` is not run (database-wide). The Lovable policy on `realtime.messages` (`… ELSE TRUE`) is **not** carried over: on V1 it would have opened V1's private realtime channels to every signed-in user, and ISEXY uses no private channels. |
| Functions renamed `isexy-<name>` | All 27 functions (`supabase/functions/isexy-*`); every `functions.invoke()` and `/functions/v1/…` URL updated. CI deploys them **one by one by name** and refuses any other name; it never runs a bare `supabase functions deploy`. |
| Function secrets don't collide with V1 | Edge-function secrets are project-wide on V1. ISEXY reads **`ISEXY_<NAME>` first** (`_shared/env.ts`). Stripe values, `PAYMENTS_LIVE_ENABLED`, `CRON_SECRET`, `APP_URL`, `ANTHROPIC_API_KEY`, `AI_CHAT_MODEL`, `SEED_PROFILES_ENABLED` and `TWILIO_SIGNATURE_BYPASS` **only** come from the `ISEXY_` name; shared provider keys (Resend, Twilio, WhatsApp, VAPID) fall back to V1's value of the same name if no `ISEXY_` value exists. |
| Takatak Auth | Sign-in is Google, email code or SMS code on V1's shared `auth.users` (`src/components/TakatakSignIn.tsx`). Passwords, the custom email-OTP and password-reset functions, and the TAKATAK master-API bridge are removed. `isexy.profiles.id = user_id = auth.users.id` (migration `0002_takatak_identity.sql`; enforced by a check constraint). **No trigger on `auth.users`**: a takatak.ca account becomes an ISEXY member only when that person signs up in ISEXY. |
| No Lovable | `lovable-tagger`, `.lovable/`, `bun.lockb`, Lovable npm-cache URLs in `package-lock.json`, `LOVABLE_API_KEY` and the Lovable AI gateway (replaced by Claude) are gone; defaults are `https://isexy.onrender.com` and V1. |

**Why an ISEXY-only runner and not takatak-v1's pipeline:** shipping ISEXY SQL
through takatak-v1 would mix two apps' histories and put ISEXY releases on V1's
gated Prisma pipeline. The runner touches only the `isexy` schema, keeps its own
history, and refuses to commit if anything of V1's changed. Gate it like V1:
see step 3.4.

**Rollback (removes ISEXY completely, V1 untouched):**
`DROP SCHEMA isexy CASCADE;`, delete the `isexy-*` buckets and the storage
policies named `isexy: %`, delete the `isexy-*` functions and `ISEXY_*` secrets.

---

## 2. Already done in the dashboards (per the owner)

- Render: rewrite `/*` → `/index.html` (`/auth`, `/discover` return 200).
- V1 Auth → URL configuration: `https://isexy.onrender.com/**` added to redirect URLs.
- V1 Auth providers: Email, Phone (OTP) and Google enabled.

---

## 3. Steps to do, in order

### 3.1 Expose the `isexy` schema to the API (V1 dashboard)

Project `pcjfahhlozsseqqevimi` → **Project Settings → Data API** →
**Exposed schemas**: add `isexy`, keep everything already listed, **Save**.
Do this after step 3.3 (the schema must exist). Until then the site loads but
every data call returns HTTP 406.

### 3.2 Auth details to check (V1 dashboard)

- **Email code:** Authentication → Emails → **Magic Link** template. The email
  must contain the code for "email code" sign-in: add `{{ .Token }}` (keep the
  existing link; this template is shared with takatak.ca, so adding the code is
  harmless for it).
- **SMS:** Authentication → Providers → Phone. Confirm the SMS provider
  (Twilio / MessageBird / Vonage) delivers to **Cuba (+53)** and Canada (+1),
  and that rate limits suit a dating launch.
- **Google:** nothing ISEXY-specific beyond the redirect URL already added.
  When `isexy.ca` is live, add `https://isexy.ca/**` to the redirect URLs too.

### 3.3 Database: dry run, then apply

1. V1 dashboard → **Connect** → *Session pooler* (port 5432) → copy the URI and
   put the database password in it.
2. GitHub → `takatakca/isexy` → Settings → Secrets and variables → Actions →
   **New repository secret** `ISEXY_DB_URL` = that URI.
3. Dry run from any machine with `psql` (nothing is kept):
   ```sh
   ISEXY_DB_URL='postgresql://…' scripts/isexy/migrate.sh
   # → "Dry run OK: 2 migration(s) apply cleanly and leave V1 objects unchanged (rolled back)."
   ```
4. Merge the pull request. On `main`, CI runs the dry run again on V1, then
   `--apply`, then reloads the API schema cache. Or apply by hand:
   `scripts/isexy/migrate.sh --apply`.

### 3.4 Gate production like V1 (GitHub)

The deploy job uses the GitHub environment **`production`**. Settings →
Environments → `production` → **Required reviewers**: add the owner. Every
ISEXY database/function deploy then waits for a click, the same way V1's
pipeline is gated.

### 3.5 Edge functions

1. Create a Supabase access token (account with access to the V1 org):
   supabase.com → Account → Access tokens.
2. GitHub secret **`SUPABASE_ACCESS_TOKEN`** = that token.
3. On the next push to `main` CI deploys each `isexy-*` function by name to
   `pcjfahhlozsseqqevimi`. By hand:
   ```sh
   for d in supabase/functions/isexy-*/; do
     supabase functions deploy "$(basename "$d")" --project-ref pcjfahhlozsseqqevimi
   done
   ```
   `verify_jwt` per function comes from `supabase/config.toml`.

### 3.6 Function secrets (V1 → Edge Functions → Secrets)

Set **only `ISEXY_`-prefixed names** (an unprefixed name would change V1's own
functions). `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
are provided by Supabase.

| Secret | Needed for | Notes |
| --- | --- | --- |
| `ISEXY_ANTHROPIC_API_KEY` | AI concierge, chat translation | Claude API key |
| `ISEXY_AI_CHAT_MODEL` | optional | default `claude-opus-5-5` |
| `ISEXY_APP_URL` | Stripe return URLs, email links | `https://isexy.onrender.com` (later `https://isexy.ca`) |
| `ISEXY_STRIPE_SECRET_KEY` | all payments | `sk_live_…` / `sk_test_…` of ISEXY's Stripe account |
| `ISEXY_STRIPE_WEBHOOK_SECRET` | `isexy-stripe-webhook` | `whsec_…` from step 3.7 |
| `ISEXY_PAYMENTS_LIVE_ENABLED` | live charges | `true` only when ready; anything else keeps payments in test mode |
| `ISEXY_STRIPE_PRICE_{PLUS,GOLD,PLATINUM}_{WEEK,MONTH,SIX_MONTHS}` | subscriptions (9) | printed by `scripts/create-stripe-subscriptions.mjs` |
| `ISEXY_STRIPE_PRICE_{PHONE_20,PHONE_150,PHONE_450,VIDEO_20,VIDEO_150,VIDEO_450,CHAT_1MO}` | minute packs (7) | optional: overrides the price ids built into `isexy-create-minute-purchase` (needed if ISEXY uses a different Stripe account than before) |
| `ISEXY_RESEND_API_KEY`, `ISEXY_RESEND_FROM` | notification emails | sender on a domain verified in Resend, e.g. `ISEXY <no-reply@isexy.ca>`; falls back to V1's `RESEND_API_KEY` |
| `ISEXY_CRON_SECRET` | `isexy-subscription-resets` | ≥ 16 random characters |
| `ISEXY_TWILIO_ACCOUNT_SID`, `ISEXY_TWILIO_AUTH_TOKEN`, `ISEXY_TWILIO_PHONE_LINE_NUMBER` | PhoneLine voice dating | Twilio webhooks verify `X-Twilio-Signature` with this token |
| `ISEXY_WHATSAPP_API_TOKEN`, `ISEXY_WHATSAPP_BUSINESS_TOKEN`, `ISEXY_WHATSAPP_PHONE_NUMBER_ID` | WhatsApp codes and call alerts | |
| `ISEXY_VAPID_PUBLIC_KEY`, `ISEXY_VAPID_PRIVATE_KEY` | web push | |
| `ISEXY_SEED_PROFILES_ENABLED` | never in production | admin demo seeding |

No longer used (do not set): `LOVABLE_API_KEY`, `TAKATAK_API_URL`,
`TAKATAK_ISEXY_API_KEY`.

### 3.7 Stripe (server-side only)

The browser never sees a Stripe key or a price: it sends a package id, the
`isexy-*` functions build the Checkout Session from server-side catalogs, and
the webhook credits the purchase. Each member has one Stripe customer tagged
`metadata.isexy_user_id = <auth user id>`. That also covers members who sign
in by SMS and have no email.

**Products and prices to have in ISEXY's Stripe account (CAD):**

| Product (metadata `app=isexy`, `tier`) | Week | Month | 6 months |
| --- | --- | --- | --- |
| ISEXY Plus (`plus`) | 9.99 | 26.49 | 79.99 |
| ISEXY Gold (`gold`) | 14.99 | 39.99 | 119.99 |
| ISEXY Platinum (`platinum`) | 23.99 | 63.99 | 191.99 |

Create or reuse them with
`STRIPE_SECRET_KEY=sk_… node scripts/create-stripe-subscriptions.mjs`, then copy
the 9 printed values into the `ISEXY_STRIPE_PRICE_*` secrets.

Minute packs (recurring/one-time **prices that must exist** in the account, ids
built into `isexy-create-minute-purchase`, overridable by secrets): phone 20 /
150 / 450 min, video 20 / 150 / 450 min (one-time), chat 1 month (subscription).

No Stripe product needed (priced inline by the server): super likes, boosts,
primetime and super boosts, video credits, Cuban donations, mobile top-ups,
food packages, and gifts (priced from `isexy.gift_packages`).

**Webhook:** Stripe → Developers → Webhooks → **Add endpoint**
- URL: `https://pcjfahhlozsseqqevimi.supabase.co/functions/v1/isexy-stripe-webhook`
- Events: `checkout.session.completed`
- Copy the signing secret into `ISEXY_STRIPE_WEBHOOK_SECRET`.
- Use a separate endpoint per mode (test and live each have their own secret).

**Customer portal:** Stripe → Settings → Billing → Customer portal → activate
(used by `isexy-customer-portal` for "Manage subscription").

### 3.8 Scheduled job (optional, subscription resets)

V1 dashboard → Integrations → **Cron** → new job, daily, *HTTP request*:
`POST https://pcjfahhlozsseqqevimi.supabase.co/functions/v1/isexy-subscription-resets`
with header `x-cron-secret: <ISEXY_CRON_SECRET>`. Name it `isexy-subscription-resets`.

### 3.9 Website (Render)

Nothing required: Render builds `main` with the public values in `.env`
(V1 URL, anon key, `VITE_SITE_URL=https://isexy.onrender.com`). To override,
set the same `VITE_*` names in Render → isexy → Environment. For calls from Cuba,
add a TURN server: `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`.
When `isexy.ca` points to Render, set `VITE_SITE_URL=https://isexy.ca` (Render
and GitHub variable `ISEXY_SITE_URL`) and `ISEXY_APP_URL`.

### 3.10 Clean-up

- Delete the Lovable Cloud project `khvsudrwnqznuxnjurxp` (test data only).
- Close `takatakca/takatak-v1` branch `feat/isexy-master-api` without merging:
  ISEXY now uses V1's own auth, so the master-API bridge is not needed.
- Remove GitHub secrets `LOVABLE_API_KEY`, `TAKATAK_API_URL`,
  `TAKATAK_ISEXY_API_KEY`, `SUPABASE_DB_PASSWORD` if they exist.

---

## 4. Check after go-live

1. `https://isexy.onrender.com/auth`: sign in with an email code, an SMS code
   (+1 and +53) and Google; each lands on `/profile-setup` the first time.
2. Create a profile; in the V1 SQL editor:
   `select id = user_id from isexy.profiles limit 5;` → all `true`.
3. Upload a photo (bucket `isexy-profile-photos`), like, match, chat (realtime),
   start a call.
4. Open the Concierge popup and ask a question (Claude answers, Help Center
   sources shown).
5. Stripe test mode: buy a boost, then check `isexy.stripe_webhook_events`.
6. `select * from isexy.schema_migrations;` lists `0001_isexy_baseline` and
   `0002_takatak_identity`.
7. takatak.ca still works as before (sign in, its own data): V1's `public`
   schema was never changed.
