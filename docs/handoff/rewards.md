# Handoff: points, credits, loyalty, boosts and payments (branch wf/rewards)

Running notes, updated with every commit so nothing is lost if the run stops.
New SQL is in `docs/handoff/rewards.sql` (idempotent, isexy schema only, not a
migration file: the integrator appends it to `0004_app_completion.sql`).
Nothing here is deployed.

Status: [ ] open · [~] code written, not verified · [x] fixed and verified.

## Defects (audit of 336099c, most member-visible first)

### Money and security (browser decides amounts, purchases lost)

1. [~] `isexy-create-one-time-payment` merges client `metadata` into the Stripe
   session; the webhook checks `metadata.package_id` first, so paying for
   `boost_1` (CA$6.49) with `metadata.package_id = "credits_100"` credits 140
   credits; `metadata.profile_id` picks whose account is credited.
2. [~] Stripe webhook: `subscriptions` upsert uses `onConflict: profile_id` but
   there is no unique constraint, so the row is never written; renewals,
   cancellations and failed payments (looked up by `stripe_subscription_id`)
   then never reach the member (Premium forever, or never renewed).
3. [~] Stripe webhook: balances are read-modify-write in JS (two events race),
   balance written before the ledger row (a crash between them re-credits on
   retry), supabase errors are ignored and the event is marked `processed`;
   a failed event is never retried (the retry hits the unique
   `stripe_event_id` and is logged `skipped_duplicate`).
4. [ ] Purchased Super Likes raise `allowances.weekly_super_likes_max`
   (+N every week, forever, and none right away) instead of adding N Super
   Likes; Super Boost hours can be bought but never used; primetime/super
   boosts not shown anywhere a member can use them.
5. [~] `credit_transactions_type_check` allows purchase/video_call/bonus/refund
   only: `apply_referral_code` ('referral_bonus') always fails, and call
   minute charging ('spend') fails (calls area fixes 'spend' too).
6. [~] `referrals.referral_code` is UNIQUE: a member's code works for the
   first friend only; codes can be used in a cycle (A↔B) and by old accounts.
7. [ ] Client writes of protected data (to be switched to RPCs so the Security
   stage can drop the policies): `Referrals.tsx` UPDATE `profiles.referral_code`;
   `CubanSignup.tsx` UPDATE `profiles.is_cuban`; `AdminVerifications.tsx`
   UPDATE `profiles.is_verified`; `MyStars.tsx` INSERT `star_cashout_requests`
   with a browser-computed `usd_amount` and no balance check;
   `useStreakTracker.ts` badges awarded on a browser-computed streak.
8. [~] Redeem code: `discount` codes are "redeemed" (use counted) and nothing
   is applied, the page says "Welcome to Platinum"; a code overwrites a paid
   plan (a Platinum subscriber redeeming a 7-day Gold trial is downgraded and
   loses Premium after 7 days while Stripe keeps charging); `max_uses` race.
9. [~] Plan limits disagree everywhere: `perform_like` gives unlimited Super
   Likes to every paid tier (Plus too); `sync_entitlements` gives Gold 2 /
   Platinum 3 Super Likes a week, `isexy-subscription-resets` 5 / 99, the
   pages 5 / unlimited; the reset job overwrites purchased Super Likes;
   `reset_monthly_allowances` refills the monthly Boost on every run (not
   monthly) and skips permanent plans; the expiry job leaves entitlements on
   the old tier.
10. [ ] Promo banner promises "50% OFF first week" but checkout charges full
    price (no discount anywhere).
11. [~] Members who signed in by SMS (no email) cannot buy anything: every
    payment function requires `user.email`.
12. [~] Prices: credits charged in USD, minutes from hard-coded Lovable-era
    Stripe price ids, pages mix "$" and "CAD".

### Member-visible

13. [ ] Loyalty Rewards is fake: 650 points hard-coded, invented history,
    random "CUBA…" referral code on every render, Redeem only changes the
    number on screen.
14. [ ] Get Boosts reads table `boost_wallet` (does not exist): balances never
    show; Get Super Likes reads `user_credits.super_likes` (does not exist).
    Profile/Settings show `profiles.boosts_remaining` (never filled; Boosts
    live in `boost_wallets`).
15. [ ] Restore Purchase is fake ("request submitted", nothing sent).
16. [ ] Payments not configured / disabled: buttons stay active, a small amber
    note "Live payments disabled during testing", then an error toast.
17. [ ] Checkout opens with `window.open` after an await (blocked as a popup
    on iOS Safari: nothing happens); coming back after paying shows nothing
    (Premium returns to /discover, boosts to /discover?purchase=success).
18. [ ] Credits (bought or from referrals) cannot be spent anywhere (calls use
    video/phone minutes only), although Buy Credits says "1 credit = 1 minute
    of video chat".
19. [ ] My Subscription only asks Stripe: plans from codes or rewards show
    "Free plan"; "renews soon" whatever the date; check-subscription may pick
    the chat subscription and return no tier.
20. [~] Chat subscription renewals are never recorded (expires after 30 days
    while Stripe keeps charging).
21. [ ] Streak lives in localStorage (another device = streak 1); milestone
    rewards (Super Likes, Boosts) are promised and never given.
22. [ ] Loyalty, Referrals, Redeem code, My Stars, Restore purchase are not
    behind sign-in (blank or silent pages when signed out).
23. [~] Gift of a Stars package: the receiver's Stars balance is never
    credited (Cuba on hold: bug fix only).
24. [ ] Cuba pages: `CubanRewards` reads `cuban_points*` tables that do not
    exist in the isexy schema (bug fix only: show an honest empty state).

## Fixed

(each entry: files, how verified)

- SQL (`docs/handoff/rewards.sql`, R1-R11) for items 2-9, 13 (server side),
  18, 20, 21, 23 and the protected writes of item 7: 85 checks in
  `scripts/isexy/test/rewards-smoke.sql` pass on Postgres 16, also with the
  file folded into 0004 and run the CI way (v1-mock, dry run, apply, re-run
  "up to date", 0004 re-applied on itself, 0004-smoke 34/34).
  Extra holes closed on the way: any member could call
  `reset_weekly_allowances()` / `reset_monthly_allowances()` (refill everyone's
  Super Likes / monthly Boost on demand): now service_role only.
- Payment functions (commit 993d8ac): webhook, checkout x4, check-subscription
  (restore), customer-portal, gate status, both scheduler jobs. Type-checked
  with tsc + Stripe 18.5.0 types and Deno shims (no Deno here); not run
  against Stripe.

## Verification

(commands and results)

## Left to do

(exact next steps)
