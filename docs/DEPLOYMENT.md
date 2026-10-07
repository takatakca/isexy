# ISEXY deployment

Every push to `main` runs `.github/workflows/ci-cd.yml`:

| Stage | What happens | Turns on when |
| --- | --- | --- |
| **Verify** | `npm ci` → typecheck → `npm run build` (incl. SEO generation) → Deno check of edge functions → lint report | always (also on branches and PRs) |
| **Deploy database + edge functions** | `supabase db push` (all migrations) → sync function secrets → `supabase functions deploy` | `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` secrets exist |
| **Publish website** | rsync `dist/` to a new release folder over SSH, atomic symlink swap, keeps the last 5 releases | all `ISEXY_DEPLOY_*` secrets exist |
| **Smoke test** | `/`, `/auth`, `/knowledge-base`, `/faq` must return 200; warns if edge functions are missing | always on `main` |

Stages without their secrets are skipped with a notice, so the pipeline stays green
and "lights up" as soon as you add them. Lovable keeps publishing from `main`
independently.

## GitHub → Settings → Secrets and variables → Actions

### Secrets

| Name | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token (supabase.com → Account → Access tokens) |
| `SUPABASE_DB_PASSWORD` | Database password of project `khvsudrwnqznuxnjurxp` |
| `LOVABLE_API_KEY` | *(optional)* AI gateway key used by `ai-chat`; synced into Supabase function secrets |
| `TAKATAK_API_URL` | *(optional)* e.g. `https://takatak.ca` |
| `TAKATAK_ISEXY_API_KEY` | *(optional)* dedicated ≥ 32-char key issued by TAKATAK v1 for ISEXY |
| `RESEND_FROM` | *(recommended)* verified sender for OTP / call / ticket emails, e.g. `ISEXY <no-reply@isexy.ca>` (domain must be verified in Resend) |
| `CRON_SECRET` | *(recommended)* ≥ 16 random chars; lets `pg_cron` call `subscription-resets` with header `x-cron-secret` |
| `VITE_TURN_CREDENTIAL` | *(recommended)* TURN password baked into the web build (use short-lived/limited credentials) |
| `ISEXY_DEPLOY_HOST` | SSH host (e.g. MochaHost server) |
| `ISEXY_DEPLOY_PORT` | SSH port (default 22) |
| `ISEXY_DEPLOY_USER` | SSH user |
| `ISEXY_DEPLOY_PATH` | Web root to publish to, e.g. `/home/isexy/public_html` (becomes a symlink to the active release) |
| `ISEXY_DEPLOY_SSH_KEY` | Private key of a deploy-only SSH key pair |
| `ISEXY_DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan -p <port> <host>` (host key pinning) |

### Variables

| Name | Value |
| --- | --- |
| `ISEXY_SITE_URL` | Public URL, e.g. `https://isexy.ca` (default `https://isexy.lovable.app`) |
| `SUPABASE_PROJECT_REF` | default `khvsudrwnqznuxnjurxp` |
| `VITE_GA4_ID` | *(optional)* Google Analytics 4 measurement ID |
| `VITE_META_PIXEL_ID` | *(optional)* Meta Pixel ID |
| `VITE_TURN_URLS` | *(recommended)* comma-separated TURN URLs, e.g. `turn:turn.isexy.ca:3478,turns:turn.isexy.ca:5349` — needed for calls on strict mobile NAT (Cuba) |
| `VITE_TURN_USERNAME` | *(recommended)* TURN username |

## Scheduled jobs

`subscription-resets` only accepts the service-role key or the `CRON_SECRET`. Schedule it with `pg_cron` + `pg_net`:

```sql
select cron.schedule('isexy-subscription-resets', '5 0 * * *', $$
  select net.http_post(
    url := 'https://khvsudrwnqznuxnjurxp.supabase.co/functions/v1/subscription-resets',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body := '{}'::jsonb);
$$);
```

## Static hosting notes

The app is a single-page app: the host must serve `index.html` for unknown paths.
Public pages also exist as `dist/<page>/index.html` with pre-rendered meta tags.
On Apache (cPanel/MochaHost) add to the web root `.htaccess`:

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

Database migrations are forward-only; fix forward with a new migration.
