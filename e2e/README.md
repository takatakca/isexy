# ISEXY end-to-end checks (mocked backend, nothing reaches production)

Playwright scripts that drive the production build at a 390x844 phone size.
Every Supabase call (REST, RPC, Auth, Storage, Functions, realtime websocket)
is answered by a mock inside the script. `offline-browser.mjs` is preloaded
for every run: the browser can reach `127.0.0.1` and nothing else, so an
unmocked request fails instead of reaching TAKATAK V1, Render or isexy.ca.

## Run

```bash
# 1. Build. The SEO step would fetch Help Center articles from V1: disable network.
NODE_OPTIONS="--import=./e2e/no-network.mjs" npm run build

# 2. Serve the build (keep it running; stop it by its PID afterwards).
npx vite preview --port 4173 --strictPort --host 127.0.0.1 &

# 3. Run any script (E2E_BASE defaults to http://127.0.0.1:4173).
node --import ./e2e/offline-browser.mjs e2e/<file>.mjs [args]
```

Playwright comes from `/opt/node22/lib/node_modules/playwright` and Chromium from
`/opt/pw-browsers/chromium` (override with `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`).
`SHOTS` below is any scratch folder for screenshots.

## Scripts

Pass/fail checks (print `PASS`/`FAIL` lines, exit 1 on a failure):

| Script | Area | Covers | Run |
|---|---|---|---|
| `discover-e2e.mjs` | Discover | Show-me filter, drag/keys/undo, First Impression, Top Picks, Who liked you (locked/unlocked, paging, like back), match → chat, web profile share, News/Stories links, category errors, matches list, Double Hangout | `node --import ./e2e/offline-browser.mjs e2e/discover-e2e.mjs SHOTS public/og-image.png` |
| `accounts-auth-setup.mjs` | Accounts | sign-in routing, profile setup, profile read errors | `E2E_SHOTS=SHOTS node --import ./e2e/offline-browser.mjs e2e/accounts-auth-setup.mjs` |
| `accounts-profile.mjs` | Accounts | profile, edit profile + photos, bio, interests | same pattern |
| `accounts-settings.mjs` | Accounts | settings, active status, block contacts, passport, verification, delete | same pattern |
| `accounts-signups.mjs` | Accounts | tourist signup, entry pages, sign-in guards, home redirect | same pattern |
| `accounts-layout.mjs` | Accounts | 390x844 sweep: no horizontal scroll, no covered controls | same pattern |
| `chat-e2e.mjs` | Chat | read RPC, optimistic send + retry, history paging, translation cache, presence, locked chat | `node --import ./e2e/offline-browser.mjs e2e/chat-e2e.mjs http://127.0.0.1:4173 SHOTS public/og-image.png` |
| `chat-notifications-e2e.mjs` | Chat | badges, push opt-in + settings, email settings, missed calls, group chat, matches list | same as chat-e2e |

Broad smoke scripts (print a log to read; they stop with an error if a step cannot run):

| Script | Covers | Run |
|---|---|---|
| `smoke-swipe.mjs` | Discover deck: drag, like → match, failed swipe, keyboard, undo, photo tap | `node --import ./e2e/offline-browser.mjs e2e/smoke-swipe.mjs SHOTS public/og-image.png` |
| `smoke-chat.mjs` | inbox search, chat history, translation, optimistic send, failed send | same pattern |
| `smoke-call.mjs` | two members: incoming video call, answer, media both ways, hang up, phone call decline | `node --import ./e2e/offline-browser.mjs e2e/smoke-call.mjs SHOTS` |
| `smoke-auth.mjs` | Takatak sign-in (email/SMS code, Google redirect) | `node --import ./e2e/offline-browser.mjs e2e/smoke-auth.mjs SHOTS` |
| `smoke-reposition.mjs` | old dating URLs redirect, no dating wording on public pages | `node --import ./e2e/offline-browser.mjs e2e/smoke-reposition.mjs SHOTS` |

Helpers: `accounts-mockdb.mjs` (in-memory PostgREST/Auth/Storage/Functions mock
used by the accounts scripts), `no-network.mjs` (build-time fetch blocker),
`offline-browser.mjs` (browser network guard).

## Database checks

SQL is checked separately on a throwaway local Postgres 16, like the CI
`migrations` job: `scripts/isexy/test/v1-mock.sql`, `scripts/isexy/migrate.sh`
(dry run, `--apply`, re-run), then `scripts/isexy/test/0004-smoke.sql`
(instructions at the top of that file). Never point these at V1.
