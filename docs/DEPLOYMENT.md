# ISEXY deployment

ISEXY runs on **TAKATAK V1** (Supabase `pcjfahhlozsseqqevimi`, `isexy` schema,
`isexy-*` edge functions) and is hosted on **Coolify** (coolify.takatak.ca, project ISEXY;
Nixpacks static site from `/dist`, configured by `nixpacks.toml`), with **Render**
(`https://isexy.onrender.com`) kept as a fallback for now.
First-time setup and every human step: [`V1-MIGRATION.md`](V1-MIGRATION.md).

`.github/workflows/ci-cd.yml` runs on every push and pull request:

| Stage | What happens | Turns on when |
| --- | --- | --- |
| **Verify** | `npm ci` → typecheck → `npm run build` (incl. SEO generation) → `deno check` of every `isexy-*` function → lint report | always |
| **ISEXY migrations on a V1 stand-in** | Postgres 16 + `scripts/isexy/test/v1-mock.sql` (Supabase roles, auth, storage, realtime, plus V1 lookalike objects in `public`) → `migrate.sh` dry run → `--apply` → re-run is a no-op; the guard fails the job if any V1 object changes | always |
| **V1 safety rules** | fails on `supabase/migrations/`, `supabase db push`, a bare `supabase functions deploy`, a function not named `isexy-*`, `public.*` in ISEXY migrations, or any Lovable dependency | always |
| **Deploy ISEXY to TAKATAK V1** | `migrate.sh` dry run on V1 → `migrate.sh --apply` (isexy schema only) → deploy each `isexy-*` function by name | push to `main`; migrations when `ISEXY_DB_URL` exists, functions when `SUPABASE_ACCESS_TOKEN` exists; waits for the `production` environment's reviewers |
| **Publish website** | Coolify (and Render, fallback) deploy `main` on their own. Optional: rsync `dist/` to an SSH host with an atomic swap | SSH part only when all `ISEXY_DEPLOY_*` secrets exist |
| **Smoke test** | `/`, `/auth`, `/discover`, `/knowledge-base`, `/faq` must return 200; warns if `isexy-*` functions are missing | push to `main` |

Stages without their secrets are skipped with a notice, so the pipeline stays
green and switches on as soon as you add them. **Never** run `supabase db push`
for ISEXY: V1's migration history belongs to `takatak-v1`.

## GitHub → Settings → Secrets and variables → Actions

### Secrets

| Name | Value |
| --- | --- |
| `ISEXY_DB_URL` | V1 session-pooler connection string (Connect → Session pooler, port 5432) with the database password |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token of an account in the V1 organization |
| `VITE_TURN_CREDENTIAL` | *(recommended)* TURN password baked into the web build (use short-lived/limited credentials) |
| `ISEXY_DEPLOY_HOST` / `_PORT` / `_USER` / `_PATH` / `_SSH_KEY` / `_KNOWN_HOSTS` | *(optional)* extra SSH host to publish `dist/` to |

Function secrets (Stripe, Claude, Resend, Twilio, WhatsApp, VAPID, cron) are set
on V1 itself as `ISEXY_*` names, not in GitHub: see `V1-MIGRATION.md` › 3.6.

### Variables

| Name | Value |
| --- | --- |
| `ISEXY_SITE_URL` | Public URL (default `https://isexy.onrender.com`; later `https://isexy.ca`) |
| `SUPABASE_PROJECT_REF` | default `pcjfahhlozsseqqevimi` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | defaults: V1 URL and anon key |
| `VITE_GA4_ID` | *(optional)* Google Analytics 4 measurement ID |
| `VITE_META_PIXEL_ID` | *(optional)* Meta Pixel ID |
| `VITE_TURN_URLS` | *(recommended)* comma-separated TURN URLs, e.g. `turn:turn.isexy.ca:3478,turns:turn.isexy.ca:5349` — needed for calls on strict mobile NAT (Cuba) |
| `VITE_TURN_USERNAME` | *(recommended)* TURN username |

## Database migrations by hand

```sh
ISEXY_DB_URL='postgresql://…' scripts/isexy/migrate.sh           # dry run, rolled back
ISEXY_DB_URL='postgresql://…' scripts/isexy/migrate.sh --apply   # apply
```

New migration: add `supabase/isexy-migrations/0003_<name>.sql`, schema-qualify
everything with `isexy.` and set `SET LOCAL search_path = isexy, extensions;` at
the top. Never edit a file that was already applied (checksummed).

## Static hosting notes

The app is a single-page app: the host must serve `index.html` for unknown paths.
Public pages also exist as `dist/<page>/index.html` with pre-rendered meta tags.
On Coolify see `V1-MIGRATION.md` › 3.9. On an Apache host (if ever used again) add to the web root `.htaccess`:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(self), microphone=(self), geolocation=(self)"
  <FilesMatch "\.(js|css|woff2?|png|svg)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
```

## Rollback

Releases live in `<ISEXY_DEPLOY_PATH>.releases/<sha>`. Point the symlink back:

```sh
ln -sfn <path>.releases/<previous-sha> <path>.next && mv -Tf <path>.next <path>
```

Website: Coolify → ISEXY → Deployments → redeploy a previous one (Render fallback: Deploys → *Rollback*).

Database migrations are forward-only: fix forward with a new
`supabase/isexy-migrations/000N_*.sql`. Removing ISEXY entirely is described in
`docs/V1-MIGRATION.md` › Rollback.
