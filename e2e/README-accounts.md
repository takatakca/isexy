# Accounts e2e (wf/accounts)

Playwright scripts that drive the production build with an in-memory mock of
the TAKATAK V1 Supabase API (`accounts-mockdb.mjs`: PostgREST, Auth, Storage,
Functions). Nothing reaches the network.

```bash
NODE_OPTIONS="--import=./e2e/no-network.mjs" npm run build   # SEO step must not call production
npx vite preview --port 4301 --strictPort --host 127.0.0.1 &
node e2e/accounts-auth-setup.mjs   # sign-in routing, profile setup
node e2e/accounts-profile.mjs      # profile, edit profile + photos, bio, interests
node e2e/accounts-settings.mjs     # settings, email, push, active status, block contacts, passport, verification, delete
node e2e/accounts-signups.mjs      # tourist signup, entry pages at 390 px, sign-in guards
```

Env: `E2E_BASE`, `E2E_SHOTS` (screenshots, default a temp folder),
`PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`. A script exits 1 when a check fails.
