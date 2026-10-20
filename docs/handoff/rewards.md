# Handoff: points, credits, loyalty, boosts and payments (branch wf/rewards)

Running notes, updated with every commit so nothing is lost if the run stops.
New SQL is in `docs/handoff/rewards.sql` (idempotent, isexy schema only, not a
migration file: the integrator appends it to `0013_app_completion.sql`).
Nothing here is deployed.

Status: [ ] open · [~] code written, type-checked only (Edge Functions are
not run here: no Deno, no Stripe) · [x] fixed and verified (SQL smoke tests,
typecheck, e2e on a mocked backend).

## Defects (audit of 336099c, most member-visible first)

### Money and security (browser decides amounts, purchases lost)

1. [~] `isexy-create-one-time-payment` merges client `metadata` into the Stripe
   session; the webhook checks `metadata.package_id` first, so paying for
   `boost_1` (CA$6.49) with `metadata.package_id = "credits_100"` credits 140
   credits; `metadata.profile_id` picks whose account is credited.
2. [x] Stripe webhook: `subscriptions` upsert uses `onConflict: profile_id` but
   there is no unique constraint, so the row is never written; renewals,
   cancellations and failed payments (looked up by `stripe_subscription_id`)
   then never reach the member (Premium forever, or never renewed).
3. [~] Stripe webhook: balances are read-modify-write in JS (two events race),
   balance written before the ledger row (a crash between them re-credits on
   retry), supabase errors are ignored and the event is marked `processed`;
   a failed event is never retried (the retry hits the unique
   `stripe_event_id` and is logged `skipped_duplicate`).
4. [x] Purchased Super Likes raise `allowances.weekly_super_likes_max`
   (+N every week, forever, and none right away) instead of adding N Super
   Likes; Super Boost hours can be bought but never used; primetime/super
   boosts not shown anywhere a member can use them.
5. [x] `credit_transactions_type_check` allows purchase/video_call/bonus/refund
   only: `apply_referral_code` ('referral_bonus') always fails, and call
   minute charging ('spend') fails (calls area fixes 'spend' too).
6. [x] `referrals.referral_code` is UNIQUE: a member's code works for the
   first friend only; codes can be used in a cycle (A↔B) and by old accounts.
7. [x] Client writes of protected data (to be switched to RPCs so the Security
   stage can drop the policies): `Referrals.tsx` UPDATE `profiles.referral_code`;
   `CubanSignup.tsx` UPDATE `profiles.is_cuban`; `AdminVerifications.tsx`
   UPDATE `profiles.is_verified`; `MyStars.tsx` INSERT `star_cashout_requests`
   with a browser-computed `usd_amount` and no balance check;
   `useStreakTracker.ts` badges awarded on a browser-computed streak.
8. [x] Redeem code: `discount` codes are "redeemed" (use counted) and nothing
   is applied, the page says "Welcome to Platinum"; a code overwrites a paid
   plan (a Platinum subscriber redeeming a 7-day Gold trial is downgraded and
   loses Premium after 7 days while Stripe keeps charging); `max_uses` race.
9. [x] Plan limits disagree everywhere: `perform_like` gives unlimited Super
   Likes to every paid tier (Plus too); `sync_entitlements` gives Gold 2 /
   Platinum 3 Super Likes a week, `isexy-subscription-resets` 5 / 99, the
   pages 5 / unlimited; the reset job overwrites purchased Super Likes;
   `reset_monthly_allowances` refills the monthly Boost on every run (not
   monthly) and skips permanent plans; the expiry job leaves entitlements on
   the old tier.
10. [x] Promo banner promises "50% OFF first week" but checkout charges full
    price (no discount anywhere).
11. [~] Members who signed in by SMS (no email) cannot buy anything: every
    payment function requires `user.email`.
12. [x] Prices: credits charged in USD, minutes from hard-coded Lovable-era
    Stripe price ids, pages mix "$" and "CAD".

### Member-visible

13. [x] Loyalty Rewards is fake: 650 points hard-coded, invented history,
    random "CUBA…" referral code on every render, Redeem only changes the
    number on screen.
14. [x] Get Boosts reads table `boost_wallet` (does not exist): balances never
    show; Get Super Likes reads `user_credits.super_likes` (does not exist).
    Profile/Settings show `profiles.boosts_remaining` (never filled; Boosts
    live in `boost_wallets`).
15. [~] Restore Purchase is fake ("request submitted", nothing sent).
16. [x] Payments not configured / disabled: buttons stay active, a small amber
    note "Live payments disabled during testing", then an error toast.
17. [x] Checkout opens with `window.open` after an await (blocked as a popup
    on iOS Safari: nothing happens); coming back after paying shows nothing
    (Premium returns to /discover, boosts to /discover?purchase=success).
18. [x] Credits (bought or from referrals) cannot be spent anywhere (calls use
    video/phone minutes only), although Buy Credits says "1 credit = 1 minute
    of video chat".
19. [x] My Subscription only asks Stripe: plans from codes or rewards show
    "Free plan"; "renews soon" whatever the date; check-subscription may pick
    the chat subscription and return no tier.
20. [~] Chat subscription renewals are never recorded (expires after 30 days
    while Stripe keeps charging).
21. [x] Streak lives in localStorage (another device = streak 1); milestone
    rewards (Super Likes, Boosts) are promised and never given.
22. [x] Loyalty, Referrals, Redeem code, My Stars, Restore purchase are not
    behind sign-in (blank or silent pages when signed out).
23. [x] Gift of a Stars package: the receiver's Stars balance is never
    credited (Cuba on hold: bug fix only).
24. [x] Cuba pages: `CubanRewards` reads `cuban_points*` tables that do not
    exist in the isexy schema (bug fix only: show an honest empty state).

## Fixed

(each entry: files, how verified)

- SQL (`docs/handoff/rewards.sql`, R1-R11) for items 2-9, 13 (server side),
  18, 20, 21, 23 and the protected writes of item 7. Verified on a throwaway
  Postgres 16 the CI way with the file folded into 0004 (v1-mock, migrate.sh
  dry run, `--apply`, re-run "up to date", guard silent): `0013-smoke.sql`
  34/34, `scripts/isexy/test/rewards-smoke.sql` 88/88 (allowed + forbidden
  call per RPC), rewards.sql re-applied on itself: no change.
  Extra holes closed on the way: any member could call
  `reset_weekly_allowances()` / `reset_monthly_allowances()` (refill everyone's
  Super Likes / monthly Boost on demand): now service_role only;
  `check_promo_eligibility(p_profile_id, tier)` (anon too, no caller check,
  creates "50% off" promotion rows for anyone): now service_role only (no
  client calls it; `PromoOfferBanner.tsx` is dead code).
- Payment functions (993d8ac + this pass): webhook, checkout x4,
  check-subscription (restore, now also replays missed one-time purchases with
  `{ restore: true }`), customer-portal, gate status, both scheduler jobs.
  Type-checked with tsc + Stripe 18.5.0 types and Deno shims (no Deno here);
  not run against Stripe.
- Items 1-3, 11, 12, 20: functions (993d8ac).
- Items 14, 16, 17, 18: purchase pages from the wallet (df881a9).
- Items 9, 10, 19 (client): Premium / Compare Plans / My Subscription show the
  DB plan, one plan table, CAD, honest promo (shown only when the Stripe coupon
  exists), Stripe payers sent to the billing page instead of a second checkout
  (a72421f verified + d70d227).
- Item 7 + 21: protected writes switched (1c9cf07), see "Switched call sites".
- Items 13, 15, 22, 24, rest of 14 (22f4a9b): Loyalty Rewards real, Restore
  Purchase real, Redeem code shows the tier really granted, Profile/Settings
  Boosts from the wallet, reward pages behind sign-in, CubanRewards no endless
  spinner.

## Switched call sites (browser writes of protected data -> server)

How it was found: a scan of every `.insert/.update/.upsert/.delete` in `src/`
with the nearest preceding `.from("table")` (casts like `as any` included),
plus every `supabase.rpc(` and `functions.invoke(` call. After this pass **no browser code
writes** `credit_transactions`, `boost_transactions`, `boost_wallets`,
`star_transactions`, `gift_transactions`, `coupon_redemptions`, `allowances`,
`user_credits`, `user_stars`, `subscriptions`, `star_cashout_requests` or a
protected `profiles` column. The Security stage can drop the member
INSERT/UPDATE policies on those tables and lock the protected profile columns.

| Call site | Before | Now |
|---|---|---|
| `src/pages/Referrals.tsx` | UPDATE `profiles.referral_code` (browser-made code) | `rpc("get_my_referral_code")` |
| `src/pages/LoyaltyRewards.tsx` | fake points, random code, Redeem changed a number on screen | `rpc("get_my_loyalty")`, `rpc("redeem_loyalty_reward")`, `rpc("get_my_referral_code")` |
| `src/pages/CubanSignup.tsx` (2 places) | INSERT profile with `is_cuban: true`; UPDATE `profiles.is_cuban` | `rpc("set_my_cuban_flag", { p_is_cuban: true })` |
| `src/pages/TouristSignup.tsx` | UPDATE / INSERT with `is_cuban: false` | column not sent; `rpc("set_my_cuban_flag", { p_is_cuban: false })` only if the profile was Cuban |
| `src/pages/AdminVerifications.tsx` | UPDATE `profiles.is_verified` | `rpc("staff_set_profile_verified")` (admin/moderator only) |
| `src/pages/MyStars.tsx` | INSERT `star_cashout_requests` with browser `usd_amount`, no balance check | `rpc("request_star_cashout")` |
| `src/hooks/useStreakTracker.ts` | streak in localStorage, `award_streak_badge(type, browser streak)` | `rpc("record_daily_visit")` (server streak, points, badges and their rewards) |
| `src/pages/CubanRewards.tsx` | INSERT `cuban_points` row from the browser | removed (no row = 0 points) |
| Purchase pages (df881a9 / a72421f) | balances from missing tables, `window.open` | `rpc("get_my_wallet")`, `rpc("use_boost")`, `rpc("convert_credits_to_minutes")`, checkout functions |
| `src/pages/RedeemCode.tsx` | (already an RPC) | `redeem_coupon` -> `redeem_coupon_unchecked` rewritten server-side (R7) |
| `src/pages/RestorePurchase.tsx` | fake "request submitted" | `functions.invoke("isexy-check-subscription", { body: { restore: true } })` |

Still writing `profiles` from the browser (allowed columns only, for the
Security stage's column list): `EditProfile`, `EditBio`, `Interests`,
`ProfileSetup`, `TouristSignup`, `PassportMode`, `DiscoverFilters`, `Settings`
(distance/age/show-me), `useStreakTracker` (`last_active_at`) and the admin
`AdminDashboardFull` (`is_active`, staff RLS). None sends a protected column.

Still member-callable and writing balances, owned by the calls area (they
check the caller and only spend): `deduct_call_minute`,
`charge_call_session_minute`, `deduct_video_credit`. `deduct_call_minute` and
`charge_call_session_minute` keep the default anon EXECUTE grant (harmless:
they refuse without auth.uid()), the Security stage may revoke it.

## Verification

- `npm run typecheck`: clean. `npm run build` (offline, `e2e/no-network.mjs`): OK.
- ESLint on every changed file: no new errors (pre-existing `any` errors in
  CubanSignup, AdminVerifications, MyStars, CubanRewards, GiftModal unchanged
  or fewer). `npm run lint`: 124 errors in total, all pre-existing (148 at
  336099c).
- Functions: `tsc` with Deno shims + Stripe 18.5.0 types (scratchpad
  `rewards/denocheck`): clean. CI runs the real `deno check`.
- SQL: rewards.sql folded into 0004 and run the CI way on Postgres 16
  (`/var/tmp/isexy-rewards-pg2`, port 55452: the postgres user cannot enter the
  scratchpad, as integrator A noted): v1-mock, `migrate.sh` dry run,
  `--apply`, re-run "up to date", guard silent; `0013-smoke.sql` 34/34,
  `rewards-smoke.sql` 88/88; rewards.sql re-applied on top: no change.
- e2e (mocked backend, 390x844, `vite preview` on 4305):
  `e2e/rewards-e2e.mjs` 86/86 (see the file header for what it covers; the
  last check asserts that no browser request wrote a protected table or a
  protected profile column during the whole run). Regression:
  `accounts-signups` 26, `accounts-settings` 54, `accounts-profile` 24,
  `accounts-layout` 33, `accounts-auth-setup` 28, `discover-e2e` 36 PASS (no FAIL).
  Final SQL re-run on a fresh database the same way: same results, 0004 (with
  part R) re-applied on itself without error; `check_promo_eligibility` no
  longer executable by anon/authenticated.

Run it:

```bash
NODE_OPTIONS="--import=./e2e/no-network.mjs" npm run build
npx vite preview --port 4305 --strictPort --host 127.0.0.1 &
E2E_BASE=http://127.0.0.1:4305 node --import ./e2e/offline-browser.mjs e2e/rewards-e2e.mjs
```

## Left to do

1. **Integrator**: append `docs/handoff/rewards.sql` to
   `supabase/isexy-migrations/0013_app_completion.sql` as part R (it is
   idempotent and was tested folded in exactly that way), add R to the 0004
   header, then run `rewards-smoke.sql` without the first `\i` (see its
   header). Merge `src/integrations/supabase/types.ts` (new RPCs/tables are
   already in it).
2. **Deploy (main session, after 0004)**: `isexy-stripe-webhook`,
   `isexy-create-checkout`, `isexy-create-credit-purchase`,
   `isexy-create-minute-purchase`, `isexy-create-one-time-payment`,
   `isexy-check-subscription`, `isexy-customer-portal`,
   `isexy-payments-gate-status`, `isexy-reset-allowances`,
   `isexy-subscription-resets`. Until then the pages degrade: wallet falls back
   to table reads, Loyalty says "not switched on yet", streak is counted on the
   device with no rewards.
3. **Owner (Stripe, test mode first)**: secrets `ISEXY_STRIPE_SECRET_KEY`,
   `ISEXY_STRIPE_WEBHOOK_SECRET` (without both the pages say "Payments are not
   open yet"), the 9 plan prices `ISEXY_STRIPE_PRICE_{PLUS,GOLD,PLATINUM}_{WEEK,MONTH,SIX_MONTHS}`
   (CAD, recurring), optional `ISEXY_STRIPE_COUPON_FIRST_WEEK` (a 50 %
   "once" coupon: the banner says 50 %; no coupon = no banner),
   `ISEXY_APP_URL`, and `ISEXY_PAYMENTS_LIVE_ENABLED=true` only after a test
   run. Webhook endpoint `.../functions/v1/isexy-stripe-webhook` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created|updated|deleted`. Then one test purchase per
   kind (plan, Boost, Super Likes, credits, minutes) and `stripe events resend`
   of one event to see it change nothing.
4. **Security stage**: drop the member INSERT/UPDATE policies on
   `credit_transactions`, `boost_transactions`, `boost_wallets`,
   `star_transactions`, `gift_transactions`, `coupon_redemptions`,
   `allowances` (no client code needs them: see "Switched call sites");
   protect the profile columns with a BEFORE INSERT OR UPDATE trigger that,
   when `current_user` is `authenticated` or `anon`, puts back OLD values
   (UPDATE) or the defaults (INSERT): the SECURITY DEFINER RPCs above run as
   the owner and are not affected, and a member could otherwise still INSERT a
   profile row with privileged values; revoke anon
   EXECUTE on `deduct_call_minute`, `charge_call_session_minute`.
5. **Owner decisions**: the Premium promo countdown (30 min, kept per device in
   sessionStorage) is not enforced by the server: keep, or drop the timer and
   keep the offer; `src/components/PromoOfferBanner.tsx` is dead code (calls the
   now service_role-only `check_promo_eligibility`): delete it.
6. **Language owner**: the strings added on the reward pages are English only.
7. **Cuba (on hold)**: Cuban Rewards has no backend (`cuban_points*` tables do
   not exist in isexy); the page now says so instead of spinning.
