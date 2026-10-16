# ISEXY handoff (2026-10-16)

Branch `claude/zealous-brown-kv2hmx`: wf/discover, wf/accounts, wf/chat,
wf/calls and wf/rewards are merged and pushed; the security + DB performance
pass added `0005_security_and_performance.sql` (see
[the section below](#security-and-db-performance-0005) and
[docs/handoff/security.md](handoff/security.md)). **The trust area (wf/trust:
moderation, reports, staff tools) is still to do.** **Nothing from this pass is
deployed**: the app on V1 still runs `main` 0a0c6be. Details per area: the
tables below, [docs/handoff/accounts.md](handoff/accounts.md),
[docs/handoff/chat.md](handoff/chat.md), [docs/handoff/calls.md](handoff/calls.md),
[docs/handoff/rewards.md](handoff/rewards.md), integration notes
[docs/handoff/integration-a.md](handoff/integration-a.md) and
[docs/handoff/integration-b.md](handoff/integration-b.md).

Contents: [Done](#done) · [Still to do](#still-to-do-trust-area) · [Left](#left-ordered-by-member-impact) ·
[Needs the owner](#needs-the-owner) · [How to run](#how-to-run-the-checks) ·
[Production state](#production-state) · [Security and DB performance (0005)](#security-and-db-performance-0005)

## Done

Every item was checked on a mocked backend (Playwright, 390x844) and, for SQL,
on a throwaway Postgres 16. After the last merge: typecheck clean, build OK, no
new lint errors (120 errors, all pre-existing; 148 at 336099c, 168 before the
first pass), every e2e below passes.

### Discover, likes, matches, sharing (wf/discover)

| Fix | Verified by |
|---|---|
| "Show me" filter no longer empties the deck (`women`/`men`/`everyone` values) | `e2e/discover-e2e.mjs` A9, A10 |
| Who liked you + Likes tab list real likers (new RPC `get_likes_received`); Gold/Platinum see who, others see a count and locked tiles (no identity sent) | discover-e2e C3-C5, D1, D2; `0004-smoke.sql` A1 |
| Platinum First Impression is really delivered (RPC `set_first_impression`, weekly allowance) | discover-e2e B1, B2; smoke A2 |
| Top Picks come from the member's own ranked feed (no liked/blocked people), Gold tap opens the profile | discover-e2e C1, C2, C2b |
| Phone layout of Discover (card no longer squeezed, sheets above the nav) | screenshots, discover-e2e |
| "It's a Match" opens chat the same way everywhere (`useChatOpener`) | discover-e2e A3, A4, C5, G3 |
| Drag / buttons / keys / undo | discover-e2e A1-A8, `e2e/smoke-swipe.mjs` |
| Share: real web-profile link, News and Community Stories deep links, `lib/share.ts` | discover-e2e E1-E4, F1-F3 |
| Honest copy (no fake "47 people nearby", no invented counts), Double Hangout settings save, Matches list in one RPC | discover-e2e G1-G4 |

### Accounts, profile, settings (wf/accounts, stopped by the usage limit after 14 commits, all verified)

| Fix | Verified by |
|---|---|
| Returning members never bounce to profile setup on a failed read; retry screen; "/" opens Discover | `e2e/accounts-auth-setup.mjs` (28 PASS) |
| Profile setup/edit, photos, bio, interests save and survive a failed refresh | `accounts-profile.mjs` (24 PASS) |
| Settings persist server-side (`user_preferences.settings`) and take effect in Discover: Discovery off, Incognito, min photos, has a bio, recently active, Block Contacts (both ways) | `accounts-settings.mjs` (54 PASS); smoke B1, B3 |
| Photo verification request (private bucket, one pending request, staff-only approval RPC) | accounts-settings; smoke B2 |
| Passport (Canada first, no dead buttons), delete-account dialog, sign-in code timer | accounts-settings, `accounts-signups.mjs` (26 PASS) |
| No horizontal scroll or covered control on any area page at 390x844 | `accounts-layout.mjs` (33 PASS) |

### Chat, messages, notifications (wf/chat)

| Fix | Verified by |
|---|---|
| Read state through RPC `mark_messages_read` (no client UPDATE of messages) | `e2e/chat-e2e.mjs` (39 PASS); smoke C1 |
| Optimistic send, failed message stays with Retry, auto-resend when back online | chat-e2e, `smoke-chat.mjs` |
| History in pages of 50, keeps your place, "N new messages" pill, day separators | chat-e2e |
| Translation cache (Claude called once per message and language) | chat-e2e |
| Presence ("In this chat now"), no push/email while the other member is watching; `last_message_at` by trigger | chat-e2e; smoke C2 |
| Realtime channels no longer die when the nav remounts (topic per mount) | chat-e2e websocket mock |
| Bottom-nav badges: Likes = pending likes, Chat = unread (RPC `get_my_badge_counts`) | `chat-notifications-e2e.mjs` (21 PASS); smoke C3 |
| Push really sent (`web-push`), opt-in prompt, notification settings saved and honoured by the email/push functions | chat-notifications-e2e (sending itself not run: no VAPID keys) |
| Group chat loads (RLS recursion fixed), no posting as someone else | chat-notifications-e2e; smoke C4 |
| Missed-call banner, call notifications open the chat, locked chats show the contact sheet | chat-notifications-e2e |

### Video and phone calls, Phone Line, Twilio (wf/calls)

| Fix | Verified by |
|---|---|
| Connected calls were cut off at once ("out of minutes": `credit_transactions` CHECK refused `spend`) | `calls-smoke.sql` 1 |
| In-app calls run on session RPCs (`start_call` → `answer_call` → `mark_call_connected` → `charge_call_minute` on the server clock → `end_call` with settlement); members no longer write `video_call_sessions` | `e2e/calls-e2e.mjs` (61 PASS, two browsers, real WebRTC with fake devices); calls-smoke 2 |
| ICE restart with a visible "Reconnecting", give-up after 25 s, connect timeout, per-call signaling topic, hang-up on tab close | calls-e2e |
| Camera blocked → audio only; mic blocked → clear screen, nobody rings; speaker on/off, switch camera, "Tap to hear" when autoplay is blocked; every track stopped on hang-up | calls-e2e |
| Ring timeout → `record_missed_call` (caller only, once per call); the callee opened from a push sees a call already ringing | calls-e2e; calls-smoke 3 |
| Phone Line calls really ring the receiver, billing starts only when media connects; TURN relay for strangers when configured | calls-e2e sections 8-9; calls-smoke 4 |
| Twilio IVR: signature over the public URL (constant-time), escaped TwiML, caller = verified number + 18+ from the birth date, one session per CallSid, menu and browse keys, statuses only move forward | `e2e/calls-twilio-test.mjs` (43 PASS); calls-smoke 5 |
| One voice recorder (WAV 16 kHz, so Safari and Twilio can play it; mic released on stop/leave/90 s) for greetings and replies | `e2e/calls-phone-line-pages.mjs` (52 PASS) |
| Voice profile: banned stays banned, owners cannot self-approve, a greeting goes only on your own voice profile; hub statuses; "Use the phone line by phone" + link my phone | calls-phone-line-pages; calls-smoke 6 |
| Staff review queue for voice greetings (Browse voices was always empty) and in-app calls list in `/admin/call-tests` | calls-phone-line-pages |
| TURN/STUN/phone number variables documented (`docs/DEPLOYMENT.md`, `V1-MIGRATION.md` 3.6, 3.9) and passed by the CI build | review |

### Points, credits, loyalty, boosts, payments (wf/rewards)

| Fix | Verified by |
|---|---|
| Stripe webhook through atomic, idempotent SQL (`fulfill_stripe_payment`, `apply_stripe_subscription`, `apply_chat_subscription`); browser metadata no longer decides what is credited or to whom; CAD everywhere; SMS-only members can pay | `rewards-smoke.sql` (88 PASS); functions type-checked (not run against Stripe) |
| One plan table (Gold 5 Super Likes a week + 1 Boost a month, Platinum unlimited Super Likes + 3 First Impressions a week); `refresh_member_plan` picks the best active source (Stripe, code, reward, staff) | rewards-smoke R3; `e2e/rewards-e2e.mjs` (86 PASS) |
| Purchased Super Likes and Boosts land in the wallet (`get_my_wallet`, `use_boost`); credits convert to call minutes (`convert_credits_to_minutes`) | rewards-e2e; smoke R5, R6, R10 |
| Payments not configured / paused: pages say so, buttons disabled; same-tab checkout (no blocked popup) and a real return screen; promo only when the Stripe coupon exists | rewards-e2e |
| Restore Purchase replays missed one-time purchases (idempotent); Redeem code shows the tier really granted and never downgrades a paid plan | rewards-e2e; smoke R7 |
| Loyalty Rewards real (points, streak, history, server-side redeem); streak counted on the server with its rewards; referral codes work for every friend | rewards-e2e; smoke R2, R9 |
| Every browser write of protected data goes through an RPC/function (referral code, Cuban flag, verified flag, star cash-out, streak badges) | rewards-e2e last check (no protected write during the whole run) |
| Reward pages behind sign-in; Profile/Settings show Boosts from the wallet; `check_promo_eligibility` and the allowance resets are service_role only | rewards-e2e; smoke R8, R11 |

### Integration

- `supabase/isexy-migrations/0004_app_completion.sql`: all SQL of the five
  branches in one idempotent isexy migration (parts A discover, B accounts,
  C chat, D calls, R rewards; the header lists each part and why; one CHECK
  widening block for `spend` + `referral_bonus`; one definition per function).
  Tested exactly like the CI `migrations` job: `v1-mock.sql`, `migrate.sh`
  dry run, `--apply`, re-run "up to date", guard silent; 0004 re-applied on
  top of itself. Smoke tests (allowed and forbidden calls per RPC/policy):
  `0004-smoke.sql` 34, `calls-smoke.sql` 101, `rewards-smoke.sql` 88, all
  pass. **Not applied anywhere.** `docs/handoff/{accounts,chat,calls,rewards}.sql`
  are kept as branch notes only (marked FOLDED).
- Pass B (calls + rewards): merges conflicted only in `WORKLOG.md` and
  `e2e/README.md`; `isexy-send-missed-call-notification` now needs the call
  `record_missed_call` marked missed (same match and caller, under 5 minutes)
  and never notifies twice; `types.ts` also lists the service_role RPCs the
  functions call; `_shared/payments.ts` lint fix.
- Pass A (discover + accounts + chat): see `integration-a.md` (Matches.tsx,
  ContactMethodModal, push files, `pb-40` on member pages, live-chat topic).

## Still to do: trust area

`wf/trust` (moderation, reports, blocks, staff tools) has not been merged. Its
agent should start from this branch and append to `0004_app_completion.sql`
(not applied yet); keep SECURITY DEFINER + `SET search_path = isexy, extensions`
+ REVOKE/GRANT, write new policies with `(select auth.uid())`, and re-run the
four smoke files. **If it changes or adds any isexy policy, 0005 part C2 stops
on purpose** ("C2: ... fingerprint"): regenerate it with
`ISEXY_DB_URL=<throwaway 0001-0004 db> scripts/isexy/gen-rls-initplan.sh`,
review the diff, re-run the migration test (`docs/handoff/security.md` › C2).
0005 B2 also alters the `content_violations` INSERT policy and adds guards on
`scheduled_calls`/`double_date_pairs`: reconcile if trust touches those. Waiting for it:

- Photo verification requests wait forever (no staff screen). The RPC
  `review_photo_verification` and the staff RLS are in 0004: list
  `photo_verifications` where `status='pending'`, selfie via
  `storage.from("isexy-photo-verifications").createSignedUrl(path, 600)`,
  approve/reject with `rpc("review_photo_verification", { p_request_id, p_approve, p_reason })`.
- Voice greetings can only be reviewed by admins (`/admin/call-tests`); the
  RPCs `get_voice_greetings_for_review` / `review_voice_greeting` already
  accept moderators. If moderators review voices, add the same queue (plus
  `isexy-get-voice-greeting-url`) to the moderator dashboard.
- Account deletion is a support ticket; staff delete by hand.
- `AdminDashboardFull.tsx` has 4 old `no-explicit-any` lint errors and
  updates `profiles.is_active` directly (staff RLS, not a protected column).

## Left (ordered by member impact)

| # | What | Exact next step |
|---|---|---|
| 1 | Nothing new works on V1 until 0004 (+ 0005) and the functions are deployed (Who liked you "on their way", unread never clears, settings "saved on this device", translation "unavailable", calls cannot start, wallet falls back to table reads, Loyalty "not switched on yet") | Main session: `ISEXY_DB_URL=... scripts/isexy/migrate.sh` (dry run: 0004 and 0005 pending) then `--apply`; then deploy by name: chat `isexy-translate-message`, `isexy-send-push-notification`, `isexy-send-notification-email`, `isexy-send-missed-call-notification`, `isexy-send-whatsapp-call-notification`; calls `isexy-twilio-inbound-phone-line`, `isexy-twilio-phone-line-menu`, `isexy-twilio-call-status`, `isexy-get-voice-greeting-url`; rewards `isexy-stripe-webhook`, `isexy-create-checkout`, `isexy-create-credit-purchase`, `isexy-create-minute-purchase`, `isexy-create-one-time-payment`, `isexy-check-subscription`, `isexy-customer-portal`, `isexy-payments-gate-status` (redeploy: the live one is old), `isexy-reset-allowances`, `isexy-subscription-resets` |
| 2 | `deno check` has not run on the changed functions (no Deno here; tsc + Deno shims + Stripe 18.5 types are clean) | Let CI run `deno check supabase/functions/isexy-*/index.ts` on this push; fix what it reports (most likely `_shared/twilio.ts`: `node:crypto`, type-only import) |
| 3 | Calls between two phones on mobile data often never connect without TURN | Owner: TURN server + `VITE_TURN_URL`/`VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL` (see Needs the owner) |
| 4 | Push cannot be signed (no VAPID private key) | Owner: see Needs the owner; then a real-device test push (if `crypto.createECDH` fails on the edge runtime, switch to `jsr:@negrel/webpush`) |
| 5 | Payments say "not open yet" until Stripe is configured | Owner: Stripe secrets, prices, webhook (see Needs the owner); one test purchase per kind, resend one event and confirm nothing changes, then `ISEXY_PAYMENTS_LIVE_ENABLED=true` |
| 6 | Chat needs Premium or a chat unlock, and nothing can be bought pre-launch | Owner decides the rule; if relaxed, change the unlock check in `src/pages/Chat.tsx` and `src/lib/inbox.ts` together |
| 7 | Theme is still coral pink, BRAND.md says electric blue on deep navy | Change `--primary`/`--secondary` (and the `to-pink-500` gradients, e.g. `AIChatWidget.tsx`) in `src/index.css` per BRAND.md, then re-run `accounts-layout.mjs` |
| 8 | Greetings and replies recorded before wf/calls are WebM/MP4: Twilio cannot play them (browse by phone reads name + headline) and Safari cannot play WebM | Owner: ask those members to re-record, or add a server-side transcode to WAV |
| 9 | No push/email when a match forms | Call the push/email functions with `type: "new_match"` from a DB webhook on `matches` INSERT (service role) |
| 10 | Distance slider and Go Global do nothing | After the owner picks a default: add `AND (me.distance_preference IS NULL OR dist IS NULL OR dist <= me.distance_preference)` to `get_discover_feed` (append to 0004); save Go Global as `distance_preference = NULL` in `DiscoverFilters.handleApply` |
| 11 | First Impression text skips moderation | Run `useContentModeration` in Discover before `sendFirstImpression` (or check in `set_first_impression`) |
| 12 | Saved but not honoured: Active Status, Send Read Receipts, distance unit, "who I'd like to see" filters | Active Status: SECURITY DEFINER RPC returning `last_active_at` NULL for members with `showActive = false`, used by `src/lib/inbox.ts`; read receipts: hide ticks for readers who turned them off |
| 13 | Double Hangout half-built; group chats are never created | Pair deck + RPC writing `double_date_swipes`, creating `double_date_matches`, `group_chats` and 4 `group_chat_members` on a mutual like; or hide the entry |
| 14 | No photos or voice messages in chat | `isexy-chat-media` bucket with match-member RLS, `messages.attachment_url/attachment_type`, upload + render in `Chat.tsx` |
| 15 | The phone menu (IVR) speaks English only | Owner's French wording, then a language choice in `mainMenu` (`supabase/functions/_shared/twilio.ts`) with a fr-CA Polly voice (e.g. `Polly.Chantal`) |
| 16 | The floating assistant button (`AIChatWidget`, right-4 bottom-20) covers the right end of sticky bottom bars on phones | Phone Line and buy pages are handled (`pb-40`/`pr-20`, `HIDDEN_ON`); check other pages with a sticky action bar the same way |
| 17 | An error toast sits over the Discover action row for ~4 s (toasts are lifted 96 px above the nav) | Use `position="top-center"` on phones for `<Sonner>` in `App.tsx`, or a smaller offset on `/discover` |
| 18 | Premium 30-minute promo countdown lives only on the device (sessionStorage); the server applies the coupon whenever the member is eligible | Owner keeps it or drops the timer; delete the dead `src/components/PromoOfferBanner.tsx` (nothing imports it; it calls the now service_role-only `check_promo_eligibility`) |
| 19 | Settings screens with no backend (Top Picks visibility, Q&A Events, Friends in Common, Introductions, Swipe Surge) | Owner keeps or removes them; if kept, a jsonb column in `user_preferences` replaces `useDeviceSetting` |
| 20 | Undo is free on every plan and does not refund the like | Owner decision; if gated, check `entitlements_cache.unlimited_rewinds` before `deck.undo()` and refund through an RPC |
| 21 | Web profile links need sign-in; direct `/web-profile/:id` links ignore Incognito/Discovery off | If the owner wants public links: `profiles.web_profile_enabled` + SECURITY DEFINER `get_web_profile(id)`; apply the privacy settings there |
| 22 | `/matches-list` is linked from nowhere | Redirect it to `/matches` in `App.tsx`, or link it from Likes |
| 23 | Likes badge counts every pending like, not "new since last visit" | `likes_seen_at` in `user_preferences`, filter in `get_my_badge_counts` |
| 24 | Push categories with no sender (super likes, top picks, swipe surge, boost expiring, likes frequency) | Wire each when its feature emits an event, using the keys in `notification_settings.push` |
| 25 | Email throttle is per function instance | Store `last_notified_at` per (match, recipient) |
| 26 | English-only strings on every page touched in these passes (calls, Phone Line, rewards pages, payment notices too); UI text has no FR layer (`useLanguage` only sets the chat translation language) | Move them into the i18n mechanism the language owner picks (EN + Canadian FR) |
| 27 | Explore labels "Just for Fun" / "Free Tonight" may read as dating | Owner reviews `categoryTitles`/`categoryInterests` in `CategorySwipe.tsx` and `Explore.tsx` |
| 28 | Swipe drag only tested with mouse pointer events; calls only with Chromium fake devices | Real iOS Safari + Android Chrome check (swipe, a call on mobile data with TURN) |
| 29 | `public/og-image.png` says "Premium dating between Canada & Cuba"; Discover empty state mentions Cuba; Cuban Rewards has no backend (`cuban_points*` tables do not exist in isexy; the page says "not available yet") | Waiting on the owner's hero image decision and the Cuba hold |

## Needs the owner

**Function secrets on V1** (ISEXY_ prefix; `_shared/env.ts` reads them first):

| Secret | For | Note |
|---|---|---|
| `ISEXY_VAPID_PUBLIC_KEY`, `ISEXY_VAPID_PRIVATE_KEY` | push | generate with `npx web-push generate-vapid-keys` |
| `ISEXY_VAPID_SUBJECT` | push | optional, `mailto:` address or site URL |
| `ISEXY_RESEND_API_KEY` | message / missed-call emails | |
| `ISEXY_RESEND_FROM` | emails | optional, default `notifications@isexy.ca` (verify the domain in Resend) |
| `ISEXY_APP_URL` | links in emails/pushes, Stripe return URLs | set it (emails default to isexy.ca, missed-call emails to isexy.onrender.com) |
| `ISEXY_ANTHROPIC_API_KEY` | chat translation, assistant | |
| `ISEXY_STRIPE_SECRET_KEY`, `ISEXY_STRIPE_WEBHOOK_SECRET` | payments | test mode first; without both the pages say "Payments are not open yet" |
| `ISEXY_STRIPE_PRICE_{PLUS,GOLD,PLATINUM}_{WEEK,MONTH,SIX_MONTHS}` | plans | 9 recurring prices in CAD |
| `ISEXY_STRIPE_COUPON_FIRST_WEEK` | first-week offer | optional 50 % "once" coupon; no coupon = no banner |
| `ISEXY_PAYMENTS_LIVE_ENABLED` | payments | `true` only after the test purchases |
| `ISEXY_TWILIO_ACCOUNT_SID`, `ISEXY_TWILIO_AUTH_TOKEN` | phone line by phone | `ISEXY_TWILIO_WEBHOOK_BASE` only behind a custom domain |

Stripe webhook endpoint `.../functions/v1/isexy-stripe-webhook` with events
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`customer.subscription.created|updated|deleted`. Twilio number: Voice
webhooks to the inbound and status functions (`docs/V1-MIGRATION.md` 3.6).
WhatsApp secrets: unchanged, see `docs/V1-MIGRATION.md` §3.

**Build env (Render/Coolify)**: `VITE_VAPID_PUBLIC_KEY` = the same public key
(the hard-coded fallback key has no known private half);
`VITE_TURN_URL` (older name `VITE_TURN_URLS`), `VITE_TURN_USERNAME`,
`VITE_TURN_CREDENTIAL` (a TURN server is needed for calls on mobile data);
optional `VITE_STUN_URL`, `VITE_PHONE_LINE_NUMBER` (the Twilio number shown in
the app). Existing: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SITE_URL`. See `docs/DEPLOYMENT.md` › Variables.

**Dashboard**: none new for 0004 (the `isexy-photo-verifications` bucket and its
policies come with the migration; `call_sessions` joins Realtime through the
migration; the `isexy` schema is already exposed). Resend: verify the sending
domain for `ISEXY_RESEND_FROM`.

**Decisions**:
1. Chat rule pre-launch: Premium or a chat unlock (current) or relaxed?
2. Default Discover distance before the distance filter is enforced (all profiles default to 80 km).
3. Undo/rewind: free or Plus-only ("Unlimited Rewinds" in the plans)?
4. Keep or remove Top Picks visibility, Q&A Events, Friends in Common, Introductions, Swipe Surge screens.
5. Public profile links (opt-in) or members-only (current)?
6. May the push function delete subscriptions whose endpoint answers 404/410 (kept today: no-delete rule)?
7. Old WebM/MP4 voice greetings and replies: ask members to re-record, or transcode server-side?
8. French wording for the phone menu (IVR).
9. Should moderators (not only admins) review voice greetings, and in which dashboard?
10. Keep the Premium 30-minute promo countdown (device only)? Delete `PromoOfferBanner.tsx`?
11. Explore category wording; hero/OG image; Cuba items stay on hold (Cuban Rewards has no backend).

## How to run the checks

```bash
npm run typecheck
NODE_OPTIONS="--import=./e2e/no-network.mjs" npm run build   # add VITE_PHONE_LINE_NUMBER="+1 514 555 0100" for calls-phone-line-pages
npm run lint                          # 119 errors, all pre-existing (148 at 336099c)
npx vite preview --port 4173 --strictPort --host 127.0.0.1 &
node --import ./e2e/offline-browser.mjs e2e/<file>.mjs [args]   # see e2e/README.md
node --experimental-strip-types --no-warnings --import ./e2e/calls-twilio-loader.mjs e2e/calls-twilio-test.mjs
```

Database, on a throwaway local Postgres 16 only (never V1), as CI does:

```bash
export ISEXY_DB_URL=postgresql://postgres@localhost:<port>/postgres
psql "$ISEXY_DB_URL" -X -q -v ON_ERROR_STOP=1 -f scripts/isexy/test/v1-mock.sql
scripts/isexy/migrate.sh && scripts/isexy/migrate.sh --apply && scripts/isexy/migrate.sh   # last one: "up to date"
for t in 0004-smoke calls-smoke rewards-smoke security-smoke; do
  printf 'BEGIN;\n\\i scripts/isexy/test/%s.sql\nROLLBACK;\n' $t | psql "$ISEXY_DB_URL" -X -q -v ON_ERROR_STOP=1
done   # -v ON_ERROR_STOP=1: without it psql exits 0 even when a smoke file fails (CI runs the same loop)
```

The sandbox does not let the `postgres` user into the scratchpad: the data
directory has to live elsewhere (e.g. a new folder under `/var/tmp`).

Edge functions: CI runs `deno check` (Deno is not installed here; the changed
functions were type-checked with tsc, Deno shims and Stripe 18.5 types).

## Production state

- TAKATAK V1 (Supabase, shared): migrations 0001-0003 applied and checksummed,
  schema `isexy` exposed, 0 ISEXY member profiles (pre-launch).
- Only `isexy-payments-gate-status` is deployed (an older version).
- **0004, 0005 and every other isexy-* function are NOT deployed.** Apply
  0004 and 0005 together (one `migrate.sh --apply` run applies both, one
  transaction each).
- Render serves `main` at 0a0c6be. This branch is not merged to `main`.
- The client degrades without 0004 (quiet fallbacks listed in Left #1), but
  calls and payments need 0004 and their functions to work at all: ship them
  together.

## Security and DB performance (0005)

`supabase/isexy-migrations/0005_security_and_performance.sql` (not applied
anywhere; the header lists each part). Audit, reasons and what was left alone:
[docs/handoff/security.md](handoff/security.md).

| Closed | How | Verified by |
|---|---|---|
| Members could UPDATE their own plan, limits, verified flag, shadow ban, promo, `is_cuban`, `referral_code`, ids, `created_at`, `is_active` (ban) on `profiles`, or INSERT a profile with them | BEFORE INSERT OR UPDATE trigger `profiles_protect_columns`: refused (42501) for `authenticated`/`anon` unless staff; RPCs (SECURITY DEFINER) and the service role unaffected. grep of src/: no member write sets one | `security-smoke.sql` A (refused writes, plus profile edit, settings save, signup insert, `set_my_cuban_flag`, `get_my_referral_code`, staff, service role) |
| Member INSERT/UPDATE on `credit_transactions`, `boost_transactions`, `boost_wallets`, `allowances`, `star_transactions`, `gift_transactions`, `coupon_redemptions`; INSERT `missed_calls` for anyone; UPDATE of any message column in own matches | Policies dropped (SELECT kept); writes go through the RPCs/functions | security-smoke B1 (+ wallet, boost, credits, mark_messages_read, call RPCs, record_missed_call still work) |
| Same class found by the audit: swap the other member of a match; direct swipes (skip like limits); fake completed referrals; star cash-out with any amount; planted translations; violations filed against others; forum posts as someone else / self-pinned; scheduled calls with strangers; Double Hangout pairs forced active or swapped; self-approved Cuban verification; photo uploads into another member's folder | Policies dropped or tightened, guard triggers on `scheduled_calls` and `double_date_pairs` | security-smoke B2 |
| `get_admin_users` listed every staff member to anyone; anyone could run `purge_old_telemetry`/`cleanup_expired_otps`/`calculate_profile_score`; anon EXECUTE on member RPCs; TRUNCATE/TRIGGER/REFERENCES and `setval` for anon/authenticated | Staff only / service_role only / anon revoked / grants revoked (also for future isexy tables) | security-smoke B3, B4 |
| 51 unindexed foreign keys; 133 policies calling `auth.uid()`/`has_role(auth.uid())` per row; `normalize_gender` without search_path; redundant `swipes_swiper_idx` | Covering indexes; static ALTER POLICY to `(select auth.uid())` / `(select isexy.has_role(...))` (same logic, checked policy by policy) behind a fingerprint guard, generated by `scripts/isexy/gen-rls-initplan.sh`; search_path set; index dropped (duplicate UNIQUE constraints kept) | security-smoke C; migration test |

Migration test (as CI, local Postgres 16): mock, dry run, `--apply`, re-run "up
to date", guard silent; 0005 re-applied on itself is a no-op. Smoke: 0004 34,
calls 101, rewards 88, security 105, all PASS. CI's `migrations` job now runs
the four smoke files after the apply. The security smoke file run on
0001-0004 fails 60 checks (the holes were real).

Left (not changed here; details in security.md › Looked at and left alone):

| What | Next step |
|---|---|
| Staff ban button (`AdminDashboardFull` → `profiles.is_active`) changes nothing: no staff UPDATE policy on `profiles` | Trust stage: staff RPC (the trigger already lets staff change protected columns) |
| `useContentModeration` inserts `user_warnings` as the member (staff-only policy): progressive bans never record | Trust stage: move the warning/ban to an RPC or the server |
| Reporter can set `reports.status` on INSERT | Trust stage: `AND coalesce(status, 'pending') = 'pending'` in the INSERT check |
| Member can change `status`/`priority`/`assigned_to`/`response` of own support ticket; that policy reads `auth.users` (not readable by members on Supabase) | Restrict to the member's reply fields through an RPC |
| Every member reads every column of every active profile (`blocked_contacts`, coarse location, plan, shadow ban) | Owner/next pass: a member-facing view or RPC with the public columns |
| Chat unlock and Plus-only settings (Incognito, Recently Active) enforced in the UI only | After owner decision #1: `messages` INSERT check / settings RPC |
| A policy added or changed later (trust work in 0004) makes 0005 C2 stop | Regenerate C2 (`scripts/isexy/gen-rls-initplan.sh`), review, re-test |
