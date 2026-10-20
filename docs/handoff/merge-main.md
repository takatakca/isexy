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
- [x] 2. `git merge origin/main`, conflicts resolved, decisions below (typecheck clean; `deno check` of every function and main's 5 Deno tests pass: Deno 2.5.6 from npm in the scratchpad)
- [x] 3. Our migrations renumbered 0013/0014 and reconciled with main's 0004-0012
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

Conflicts: `WORKLOG.md`, `usePaymentsGate.ts`, `CubanSignup.tsx`,
`MySubscription.tsx`, `Premium.tsx`, `RestorePurchase.tsx`, the webhook, the
four checkout functions, customer portal, check-subscription, gate status,
reset-allowances. Auto-merged: CI workflow (main's Deno tests, SQL assertions,
quarantine, live checks + our smoke step and TURN/phone build vars),
`docs/DEPLOYMENT.md`, everything else main added.

| Area | Kept from main | Kept from this branch | Combined decision |
|---|---|---|---|
| `isexy-stripe-webhook` | identity = server-written `metadata.user_id` checked by `checkoutOwnerId` against the customer tag and an existing profile (no email); customer deleted → error; subscription customer must equal checkout customer; tier metadata required; payment mode credited only when `paid`; chat checkout only when paid / no payment required; in-flight duplicate (insert 23505, or a `received` row younger than 5 min) answers 503, never 200; log insert/finalise failures are errors; unknown one-time product logged and acknowledged (as v6) | all effects through the atomic, idempotent SQL functions (`fulfill_stripe_payment`, `apply_stripe_subscription`, `apply_chat_subscription`); subscription state fetched again from Stripe, so a late or retried event never applies an old state | a **failed** event is processed again on the next delivery instead of answering 503 forever: safe because every effect is one idempotent SQL transaction (main's decision 22 asked for exactly this atomic recovery path). A paid session the SQL could not credit (bad gift details) fails the event. Subscription events without a member id in their metadata only update an existing row (other products' subscriptions are ignored) |
| checkout x4 | return URLs only from `ISEXY_APP_URL` (`_shared/app-url.ts isexyAppUrl`, default Render); `safeCheckoutMetadata` for one-time payments | `_shared/payments.ts` (gate refusal, SMS-only `signedInMember`, JSON), CAD catalog, gift recipient checks, chat subscription, first-week coupon path in create-checkout | our `appBaseUrl(req)` (Origin fallback) removed; `returnPath` cannot start with `//` |
| `isexy-customer-portal` | return URL from `ISEXY_APP_URL` | gate, 404 `no_customer`, returns to `/my-subscription` | `isexyAppUrl("/my-subscription")` |
| `isexy-check-subscription` | SMS-only members, identity never by email | restore of subscriptions and paid one-time purchases through the SQL functions, DB plan answer | a Stripe subscription/session is applied only when its metadata names this member (`checkoutOwnerId`); a purchase the SQL refuses is skipped and logged |
| gate (function + hook) | malformed or missing key never opens sales; client fails closed (unknown status = blocked) | `configured` also needs the webhook secret, `reason`, `firstWeekPromo`, shared cache | only `sk_test_`/`sk_live_` keys count (we had also accepted `rk_`); `blockedLabel(null)` = "Checking payments…" (buttons disabled while loading); unreadable/malformed answer = blocked, reason `unavailable` (not cached) |
| client checkout | only `https://checkout.stripe.com` | `startCheckout` (same-tab, error words) | `startCheckout` refuses any URL that is not `checkout.stripe.com` / `billing.stripe.com` |
| `isexy-reset-allowances` | POST only, secret ≥ 16 chars compared in full, HTTP 500 with task names only | `expire_member_plans` first | three RPCs + promotions, failures reported by task name, details only in the log |
| `Premium.tsx` | countdown banner removed (decision 19), checkout blocked while the gate is unknown | wallet plan, Stripe payers sent to My Subscription, `startCheckout` | no countdown; the create-checkout coupon path stays server-side (no UI offers it any more: owner decision) |
| `MySubscription.tsx` | a failed check never shows "Free plan": "status unavailable" + retry | plan from the wallet (Stripe, code, reward, staff), Stripe catch-up | the unavailable card shows when the wallet cannot be read, or the Stripe check failed and the wallet says free; retry re-runs both |
| `RestorePurchase.tsx` | ticket for a purchase made on another account (`RP-…`, staff review) | automatic restore on the same account | both on one page |
| `CubanSignup.tsx` (Cuba on hold, bug fixes only) | no profile with a fake birth date (go to profile setup); refuse when an upload failed | `set_my_cuban_flag` RPC (is_cuban is protected) | RPC, with main's error check |
| WORKLOG | main's lines | ours | both, newest first; main's three 2026-10-09 lines are older statuses of our PR #1 lines (kept ours) |

## 3. Migrations: renumbered and reconciled

`git mv` 0004_app_completion → **0013_app_completion**, 0005_security_and_performance
→ **0014_security_and_performance**, `scripts/isexy/test/0004-smoke.sql` →
`0013-smoke.sql`; references updated in CI, `gen-rls-initplan.*`, the smoke
files, e2e/README, src comments, docs/handoff notes (WORKLOG history lines left
as written). Main's 0001-0012 are byte-identical to main (sha256 = the
checksums recorded on V1).

| Overlap with main | Decision |
|---|---|
| 0004 `normalize_gender` search_path | ours (0014 C3, `isexy, extensions`) removed: main's `''` stays |
| 0005 FK indexes | 10 of our 51 C1 indexes are the same columns as main's `idx_isexy_*`: removed (41 left). Main's `idx_isexy_swipes_swiped_id` and `idx_isexy_message_translations_message_id` are covered by our composite `swipes_swiped_created_idx` / `message_translations_lookup_idx`: left in place (dropping a live index is the owner's call) |
| 0006 adult trigger | untouched; nothing of ours writes `birth_date` around it. `calls-smoke` inserts its under-18 member with the trigger disabled inside the rolled-back test (a pre-0006 legacy row), so the call RPCs' own minor check stays tested |
| 0007 allowance resets | 0013 R8 replaces the `reset_monthly_allowances` body (same "only when due" rule, service role only) and adds active plan required, permanent plans, missing wallets; our duplicate weekly REVOKE/GRANT removed (0007 has it) |
| 0008 maintenance RPCs, `get_admin_users` | our 0014 B3 copies removed: main's definition (staff **or service_role**, EXECUTE authenticated) is the one |
| 0009/0010 tickets | untouched by ours. **C2 regenerated** on a 0001-0013 database: 131 policies (was 133); the old C2 would have rewritten main's two 0010 ticket policies back to `auth.users` reads (its guard would have stopped it). The generator and the security-smoke C2 check now also skip `auth.*()` already inside a scalar subquery (`( SELECT (auth.jwt() ->> 'email'))`) |
| 0011/0012 Stripe RPCs | `fulfill_stripe_payment` gets their protections: `auth.role()` must be service_role, session id `cs_…` 8-255 chars, same advisory locks. `fulfill_stripe_credit_purchase` / `fulfill_stripe_boost_purchase` (live webhook v6) keep signature, boolean answer, checks, product lists and 22023 errors, and credit through `fulfill_stripe_payment`: one crediting rule and one idempotency ledger per session whichever function a delivery reaches. Deliberate change: Super Likes bought through them go to `profiles.super_likes_remaining` (spendable), not `allowances.weekly_super_likes_max` (refilled every week, reset by `sync_entitlements`); main's `atomic-boost-checkout.sql` assertion updated to the balance. Main's duplicate unique session indexes (same columns as the baseline's) left in place |
| subscriptions | our unique `subscriptions (profile_id)` index (0013 R3) makes the live v6 webhook's `upsert(..., onConflict: profile_id)` work (it fails today without it) |

Main's functions against the final schema (checked on the migrated database):
every RPC they call exists with the same signature and privileges:
`sync_entitlements(uuid)` (service role passes `assert_profile_owner`),
`fulfill_stripe_credit_purchase` / `fulfill_stripe_boost_purchase(uuid,text,text) → boolean`,
`reset_weekly_allowances()` / `reset_monthly_allowances() → integer`,
`verify_otp`, `has_role`; no table or column they use was dropped; the new
member-write closures (0014 B) do not affect them (service-role clients).
`src/integrations/supabase/types.ts`: + the two 0011/0012 RPCs.

Tests (local PostgreSQL 16, throwaway cluster `/var/tmp/isexy-merge-pg`, port
55613: the postgres user cannot enter the scratchpad, `/tmp/claude-0` is
forced back to mode 700):

1. From scratch (as CI): v1-mock, dry run (14 pending, OK), `--apply` (guard
   "V1 objects unchanged" for each), main's six SQL assertions pass, re-run
   "up to date"; smoke 0013-smoke 34, calls-smoke 101, rewards-smoke 95
   (+7 R4b: main's RPCs share the ledger, session id check), security-smoke
   105: all PASS. 0013 and 0014 each re-applied on themselves: no error (C2
   "already applied").
2. Production simulation: fresh database with v1-mock + 0001-0012 only (our
   files moved aside; main's six assertions pass there except the updated
   boost one, which describes 0013), files put back: dry run lists **only
   0013 and 0014**, `--apply` OK, re-run "up to date", all SQL tests above pass.
