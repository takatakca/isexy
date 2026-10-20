# Merge stage: origin/main into claude/zealous-brown-kv2hmx

Running notes, updated with every commit so nothing is lost if the run stops.
Branch `claude/zealous-brown-kv2hmx` (head before the merge `dea8b21`), main
at `a188694` (47 commits since the merge base `0a0c6be`, by ChatGPT, directly
on main). **Main is what runs in production** (Render serves main; Supabase V1
has migrations 0001-0012 applied with checksums and most `isexy-*` functions
deployed from main). Production state is the baseline; this branch is merged
on top of it.

## Progress

- [x] 1. Map of main's changes (this file)
- [ ] 2. `git merge origin/main`, conflicts resolved, decisions below
- [ ] 3. Our migrations renumbered 0013/0014 and reconciled with main's 0004-0012
- [ ] 4. Migration tests (from scratch + production simulation), every smoke test, typecheck, build, lint, e2e
- [ ] 5. Functions to deploy (content differs from main, or new)
- [ ] 6. HANDOFF.md, WORKLOG.md, push

## 1. What main changed and why (0a0c6be..a188694)

Docs on main (French): `docs/AGENT_HANDOFF.md` (relay notes, newest first),
`docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md`, `docs/DECISIONS.md` (33
permanent decisions), `docs/DEPLOYMENT.md` (verified deployment notes on top).

### Migrations (applied to V1 in this order, checksummed: never edit them)

| File | What | Why |
|---|---|---|
| `0004_pin_normalize_gender_search_path` | `normalize_gender(text)` `SET search_path = ''` | Supabase security advisor |
| `0005_core_relationship_indexes` | 12 FK indexes (`idx_isexy_*`: blocks.blocked_id, swipes.swiped_id, matches.profile2_id, messages.sender_id, chatbot_messages.conversation_id, group_messages.group_chat_id + sender_id, live_chat_messages.session_id, support_tickets.user_id + assigned_to, phone_line_voice_replies.greeting_id, message_translations.message_id) | FK advisor 82 → 71 |
| `0006_require_adult_profiles` | trigger `isexy_require_adult_profile` (BEFORE INSERT OR UPDATE OF birth_date): under 18 refused, 23514 | 18+ enforced by the database (decision 11) |
| `0007_secure_allowance_resets` | `reset_weekly_allowances` / `reset_monthly_allowances` service_role only; monthly Boost only when the wallet is due | anyone could refill everyone's allowances; Boost re-granted on every run |
| `0008_restrict_privileged_maintenance_rpcs` | `cleanup_expired_otps`, `purge_old_telemetry` service_role only; `get_admin_users()` returns rows only to staff or service_role (EXECUTE authenticated) | public RPC abuse, staff directory leak (decision 13) |
| `0009_protect_support_ticket_staff_fields` | trigger `isexy_support_ticket_staff_fields_guard`: members may change only `message`, `attachments`, `updated_at` of their ticket | members could resolve tickets, forge staff replies (decision 16) |
| `0010_support_ticket_rls_uses_verified_claims` | ticket SELECT/UPDATE policies use `(SELECT auth.uid())` / `auth.jwt() ->> 'email'`, never `auth.users` | members cannot read auth.users: their own ticket queries failed |
| `0011_atomic_credit_checkout` | `fulfill_stripe_credit_purchase(uuid,text,text) → boolean`, service_role only (grant + `auth.role()` check), session `cs_%` validated, advisory lock, idempotent per `credit_transactions.stripe_session_id` | non-atomic, racy credit/minute grants (decision 25) |
| `0012_atomic_boost_checkout` | `fulfill_stripe_boost_purchase(uuid,text,text) → boolean`, same protections, per `boost_transactions.stripe_session_id` | same for Boosts/Super Likes (decision 32) |

### Edge functions (deployed from main; versions per main's docs)

| Function | Change | Why |
|---|---|---|
| `isexy-stripe-webhook` (v6) | identity only from server-written `metadata.user_id` + Stripe customer tag (`_shared/stripe-identity.ts checkoutOwnerId`), never by email; duplicate of an unprocessed event answers 503 (never acknowledged); event log write failures throw; one-time payments only when `payment_status = paid`, `async_payment_succeeded` handled; Premium only for `active`/`trialing` (`_shared/subscription-entitlement.ts`); every write checked; credits/minutes via `fulfill_stripe_credit_purchase`, boosts via `fulfill_stripe_boost_purchase` | decisions 22, 29, 31, 32 |
| `isexy-create-one-time-payment` (v3) | client metadata reduced to recipient fields (`_shared/checkout-metadata.ts safeCheckoutMetadata`), payer/product set by the server | cross-member fulfilment (decision 21) |
| checkout x4, `isexy-customer-portal`, `isexy-check-subscription` (v2) | SMS-only members accepted (`user.id`, no email needed); return URLs from `ISEXY_APP_URL` only (`_shared/app-url.ts isexyAppUrl`), never the request Origin; `_shared/stripe-customer.ts` never reuses or relabels a customer found by email unless tagged with the same `isexy_user_id` | decisions 17, 18 |
| `isexy-payments-gate-status` (v2) | `blocked = !isTestKey && !(liveEnabled && isLiveKey)` | flag alone with a bad key must not open sales (decision 23) |
| `isexy-reset-allowances` (v3, verify_jwt=true) | POST only, secret ≥ 16 chars compared in full, HTTP 500 when a task fails | false success for the scheduler (decisions 15, 26) |
| `isexy-send-ticket-confirmation` (v2) | POST only; signed-in ticket owner, staff or service role (`_shared/ticket-confirmation-auth.ts`); marked sent only after Resend answers; no address logging | a ticket number is not proof of ownership (decision 30) |
| `isexy-verify-iap-receipt` (v2) | HTTP 501 until a real Apple/Google validator exists | no entitlement from unverified receipts (decision 12) |
| quarantine | `isexy-seed-profiles`, `isexy-subscription-resets` never deployed (CI skips them) | fake members; unreviewed global reset (decision 14) |

### Client and CI

- `usePaymentsGate`: unknown/failed gate status = blocked (fail closed).
- `Premium.tsx`: 50 % countdown banner removed (no server discount, decision
  19), checkout only when the gate is known and open, redirect only to
  `https://checkout.stripe.com`.
- `MySubscription.tsx`: a failed check shows "status unavailable" + retry,
  never "Free plan".
- `RestorePurchase.tsx`: creates a real support ticket (`RP-…`) for staff
  review instead of a fake toast.
- `ContactUs.tsx`: "confirmation email sent" only when the function says so.
- `CubanSignup.tsx` (Cuba on hold, bug fix): no profile with a fake
  `2000-01-01` birth date; verification refused when an upload failed.
- `scripts/generate-seo.mjs`: `dist/release.json` with the build SHA.
- CI: Deno tests for the five `_shared` helpers; SQL assertions after
  `--apply` (`adult-profiles`, `allowance-rpc-permissions`,
  `privileged-rpc-permissions`, `support-ticket-staff-fields`,
  `atomic-credit-checkout`, `atomic-boost-checkout`); quarantine in the deploy
  step; smoke test checks the live SHA and the isexy Data API.
  New `.github/workflows/isexy-allowance-cron.yml` (daily POST with the anon
  JWT + `ISEXY_CRON_SECRET`).

### Still open on main (from its TASK_QUEUE, not this merge's job)

GitHub → Supabase deploy secrets missing (`ISEXY_DB_URL`,
`SUPABASE_ACCESS_TOKEN`), Cron secret not confirmed, Coolify / isexy.ca not
verified, Stripe sandbox not run, gifts/donations not atomic, IAP 501.

## Overlap with this branch

Both sides changed: the Stripe webhook and the four checkout functions,
customer portal, check-subscription, payments gate (function + hook),
reset-allowances, Premium / MySubscription / RestorePurchase / CubanSignup,
CI, WORKLOG, DEPLOYMENT. SQL overlap: our 0004 R (Stripe fulfilment, plans,
scheduler) and 0005 (get_admin_users, maintenance RPCs, FK indexes,
normalize_gender, RLS initplan rewrite of the ticket policies) against main's
0004-0012. Our `0004_*`/`0005_*` file names collide with main's numbers:
ours become 0013/0014.

## 2. Merge decisions

(filled in during the merge)
