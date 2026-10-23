# Work log

Newest first, one line per piece of work. Rule: `AGENTS.md` › Work log rule.
Format: `YYYY-MM-DD | agent | branch → PR | status | what | next step`

- 2026-10-23 | cursor | cursor/isexy-release-live-3bc7 → PR #8 | PR #8 | isexy.ca answered HTTP 200 and the homepage rendered, but Chrome can stay stuck on yesterday's broken HTTP/3; the site now sends Alt-Svc clear and the proxy generator will not turn HTTP/3 back on | next: hard-refresh https://isexy.ca

- 2026-10-22 | cursor | cursor/isexy-release-live-3bc7 → PR #8 | done | Smoke test printed active=unknown because isexy.ca/release.json commit was null; Coolify had not published cb3965b, and the saved nginx config was plain text where Coolify stores base64, so the new container crash-looped | next: none

- 2026-10-22 | cursor | cursor/isexy-smoke-live-3bc7 → PR #7 | done | Smoke test failed waiting on Render for a4b70711 while isexy.ca is production and its release.json commit was null; point the check at isexy.ca, stamp the build SHA from git, and poll long enough for Coolify | next: none

- 2026-10-22 | cursor | cursor/isexy-http3-fix-3bc7 → PR #4 | PR #4 | isexy.ca answered HTTP/2 200 but Traefik advertised broken HTTP/3, so Chrome failed with a QUIC error; HTTP/3 removed from the proxy and directory redirects stay on HTTPS | next: owner hard-refreshes https://isexy.ca; do not turn proxy HTTP/3 back on

- 2026-10-22 | cursor | cursor/isexy-coolify-dns-3bc7 → PR #3 | PR #3 | isexy.ca 403 was empty Apache on 209.42.24.127; Coolify serves main with GitHub App auto-deploy, DNS A 31.220.96.134, TLS issued, mail kept on mail.isexy.ca | next: merge PR #3; owner sets new Contabo, MochaHost, WHM and bolon cPanel passwords

- 2026-10-16 | ChatGPT | main + Supabase V1 | done (partial release) | Atomic boost purchases migration 0012 tested in CI run 38951304397 SUCCESS, checksummed and applied to isexy schema, service-role-only permissions verified, Stripe webhook deployed v6 ACTIVE; Render 445fc829 LIVE | next: sandbox Stripe, donations/gifts idempotence, Cron secret, GitHub backend deployment, Coolify/isexy.ca


- 2026-10-16 | ChatGPT | main + Supabase | done (partial release) | Removed Stripe webhook email-based member lookup, deployed webhook v4 after CI; restricted ticket confirmation to owner/staff (Edge v2), gated unpaid subscriptions and exposed entitlement write failures (commit dd06); tests last CI pending | next: confirm dd06 CI, deploy new webhook v5 if green, check Cron & Coolify, Stripe sandbox

- 2026-10-16 | ChatGPT | main | done (awaiting CI before DB apply) | Created 0011 atomic credit/minute RPC and test; corrected ambiguous SQL fixture; created JWT-authenticated daily Cron workflow, no secret or live job claimed | next: check run 38884128241, apply 0011 only after green, deploy webhook/cron and check production

- 2026-10-16 | ChatGPT | main | done (partial release; P0 blocked) | Hardened Stripe checkout metadata and webhook settlement/duplicate handling, fail-closed payment gate, added Data API smoke test; six existing migrations unchanged | next: inspect Data API CI outcome, resolve backend deploy secrets, Cron JWT and live billing idempotency

- 2026-10-15 | ChatGPT | main | done (incremental release) | Added release.json+smoke checks and superseded-run detection; removed unfulfilled 50% promo and blocked premium checkout; support confirmation shows email success only when actually sent | next: verify final CI/Render SHA, backend auto-deploy secrets, Coolify/domain and provider/OTP/payment tests

- 2026-10-15 | ChatGPT | main | done (partial release) | Applied 0009/0010 support ticket permissions and test, persisted restoration reviews, fixed 6 Stripe Edge Functions for SMS and customer isolation, removed unsupported promo, added live SHA release probe and CI supersession check | next: confirm latest CI/Render SHA, Coolify/domain, Cron scheduler, provider secrets and end-to-end tests

- 2026-10-15 | ChatGPT | main + Supabase V1 | done (partial release) | Fixed false-success allowance cron responses; deployed isexy-reset-allowances v2 preserving verify_jwt=true; audited privileged RPC access and updated handoff | next: resolve authenticated Cron scheduling, GitHub deployment secrets, Coolify and real provider tests

- 2026-10-15 | ChatGPT | main | done (partial; blockers documented) | Fixed Cuba age placeholder and upload failures; quarantined unsafe functions; applied guarded migrations 0007/0008 and verified RPC permissions; Render f889e931 live | next: finish Cron JWT compatibility, GitHub secrets, Coolify/domain and provider flows

- 2026-10-14 | ChatGPT | main | done (partial release) | Added 18+ database enforcement (migration 0006) and CI assertions; subscription status retry UI; fail-closed IAP 501 deployed v2; Render latest SHA live | next: check queued CI, Coolify/isexy.ca, GitHub production secrets and real provider tests

- 2026-10-14 | ChatGPT | main | done (partial rollout) | Verified Render auto-deploy and V1 state; committed and applied migration 0005 (12 relationship indexes); created durable project status, task queue, decisions and handoff | next: verify newest Render SHA, Coolify/isexy.ca, missing deploy secrets and end-to-end flows

- 2026-10-14 | ChatGPT | main + Supabase V1 | done (partial launch) | 25 of 27 ISEXY functions ACTIVE; applied and checksummed migration 0004 (fixed search_path security warning); CI build success, GitHub production publish still skipped | next: configure deploy secrets and host, review two remaining functions, verify ISEXY live services

- 2026-10-14 | ChatGPT | main → direct commit | done | Allow SMS-only Takatak users to access Stripe subscription and portal; use trusted billing return URL; avoid logging customer email/session URL | next: deploy remaining isexy-* functions, check per-app secrets and live host

- 2026-10-09 | claude | claude/zealous-brown-kv2hmx → PR #1 | PR #1 (not merged) | Coolify hosting: no bun (bun.lockb only on main), nixpacks.toml pins Node 22 + npm, CI lockfile rule, docs (Render = fallback) | owner: merge PR #1 (or point Coolify at the branch once), then V1-MIGRATION.md 3.9 checks
- 2026-10-09 | claude | claude/zealous-brown-kv2hmx → PR #1 | PR #1 (not merged) | Reposition ISEXY: Canadian 18+ social network wording everywhere, Canada/EN-FR default; Cuba removal ON HOLD (nothing Cuba removed, no data deleted) | owner: decide docs/REPOSITIONING.md › Waiting on the owner (hero image, Cuba items)
- 2026-10-09 | claude | claude/zealous-brown-kv2hmx → PR #1 | PR #1 (not merged, nothing deployed to V1) | Move ISEXY off Lovable onto TAKATAK V1: isexy schema + guarded migrate.sh, isexy-* functions, Takatak Auth, Claude, Stripe customer fix | owner: review PR #1, then do docs/V1-MIGRATION.md §3 (expose isexy schema, ISEXY_DB_URL dry run, secrets, Stripe webhook)
- 2026-10-08 | claude (owner setup) | default branch | done | Added the work log rule, this log and the stop reminder | every agent follows AGENTS.md › Work log rule
