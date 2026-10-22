# ISEXY handoff (2026-10-20, after merging main)

Branch `claude/zealous-brown-kv2hmx`: wf/discover, wf/accounts, wf/chat,
wf/calls and wf/rewards are merged, the security + DB performance pass added
`0014_security_and_performance.sql`, and **origin/main (ChatGPT's 47 commits,
what production runs) is merged in** (`docs/handoff/merge-main.md`: map of
main's changes and every merge decision). Our migrations were renumbered
**0013_app_completion** and **0014_security_and_performance** (they were 0004
and 0005 on this branch; main's 0004-0012 are applied on V1). **The trust
area is done on `wf/trust`** (local, not pushed, on top of this branch's
head 30caf62: `0015_trust_and_moderation.sql` + 3 functions + client; see
[Trust area](#trust-area-wftrust)); it goes out **after** this PR. **Nothing
of this branch is deployed**: see [Production state and deploy plan](#production-state-and-deploy-plan).
Details per area: the tables below, [docs/handoff/accounts.md](handoff/accounts.md),
[docs/handoff/chat.md](handoff/chat.md), [docs/handoff/calls.md](handoff/calls.md),
[docs/handoff/rewards.md](handoff/rewards.md), [docs/handoff/security.md](handoff/security.md),
integration notes [docs/handoff/integration-a.md](handoff/integration-a.md),
[docs/handoff/integration-b.md](handoff/integration-b.md),
[docs/handoff/merge-main.md](handoff/merge-main.md). Main's own records (French):
`docs/AGENT_HANDOFF.md`, `docs/PROJECT_STATUS.md`, `docs/TASK_QUEUE.md`,
`docs/DECISIONS.md` (permanent decisions: they apply to this branch too).

Contents: [Production state and deploy plan](#production-state-and-deploy-plan) ·
[Done](#done) · [Trust area](#trust-area-wftrust) · [Left](#left-ordered-by-member-impact) ·
[Needs the owner](#needs-the-owner) · [How to run](#how-to-run-the-checks) ·
[Security and DB performance (0014)](#security-and-db-performance-0014)

## Production state and deploy plan

**Production = main** (baseline; everything below is checked against it):

- Render serves `main` (main's docs: `445fc829` live, CI run 38951304397
  green; main head `a188694` is a docs commit). Coolify / isexy.ca not verified.
- TAKATAK V1 (`pcjfahhlozsseqqevimi`), schema `isexy`: migrations
  **0001-0012 applied with checksums** (0004 normalize_gender search_path,
  0005 FK indexes, 0006 adult profiles, 0007 allowance resets, 0008
  privileged RPCs, 0009/0010 support tickets, 0011/0012 atomic Stripe
  credits/boosts). Never edit those files (their sha256 in this branch equal
  the recorded checksums).
- Edge functions deployed from main: 25 of 27 `isexy-*` (webhook v6,
  one-time payment v3, gate v2, checkouts/portal/check-subscription v2,
  ticket confirmation v2, reset-allowances v3 with verify_jwt=true, IAP 501
  v2). `isexy-seed-profiles` and `isexy-subscription-resets` are
  **quarantined** (never deployed; CI skips them): keep it that way.

**What this branch adds on top** (none of it deployed): the Done tables below
(Discover, Accounts, Chat, Calls + Phone Line + Twilio, Rewards/payments
economy) in `0013_app_completion.sql`, the security + DB performance pass in
`0014_security_and_performance.sql`, and the functions listed in step 2.
Main's live fixes are all kept (merge-main.md §2, §3): identity of Stripe
payers from server metadata only, paid-only fulfilment, 503 for in-flight
duplicates, ISEXY_APP_URL return URLs, safe checkout metadata, fail-closed
gate (server and client), POST + strong secret for the scheduler, ticket
confirmation owner/staff only, IAP 501, adult-only profiles, ticket staff
fields, service-only maintenance RPCs.

**Deploy plan** (main session / owner, in this order; nothing here was run
against V1):

1. **Migrations.** `ISEXY_DB_URL=<V1 session pooler> scripts/isexy/migrate.sh`
   (dry run): it must list exactly `0013_app_completion.sql` then
   `0014_security_and_performance.sql`, end with "isexy guard: V1 objects
   unchanged" and "Dry run OK: 2 migration(s)". Anything else (a checksum
   error, more pending files, a "C2: ... fingerprint" error) = stop and
   investigate. Then `scripts/isexy/migrate.sh --apply` (one transaction per
   file, both in one run), then `scripts/isexy/migrate.sh` → "up to date".
   Checks: `isexy.schema_migrations` has 14 rows;
   `has_function_privilege('anon'|'authenticated', 'isexy.fulfill_stripe_payment(text,uuid,text,integer,text,jsonb)', 'EXECUTE')`
   false, `service_role` true; the live webhook v6 keeps working in the gap
   (its two RPCs keep their signatures; see merge-main.md §3).
2. **Functions** (after step 1: the new webhook and checkouts need 0013's
   SQL). `supabase functions deploy <name> --project-ref pcjfahhlozsseqqevimi`
   one by one, `verify_jwt` as in `supabase/config.toml`:

   | Function | verify_jwt | Why (differs from main) |
   |---|---|---|
   | `isexy-stripe-webhook` | false | atomic SQL fulfilment + main's identity/503 rules (merge-main.md §2) |
   | `isexy-create-checkout` | false | gate, wallet plan, coupon path, ISEXY_APP_URL |
   | `isexy-create-credit-purchase` | false | CAD catalog, gate |
   | `isexy-create-minute-purchase` | false | CAD catalog, chat subscription, gate |
   | `isexy-create-one-time-payment` | false | CAD catalog, gift checks + safeCheckoutMetadata |
   | `isexy-check-subscription` | false | restore through SQL, identity-checked |
   | `isexy-customer-portal` | false | gate, return to /my-subscription |
   | `isexy-payments-gate-status` | false | `configured`/`reason`/`firstWeekPromo`, webhook secret required |
   | `isexy-reset-allowances` | **true** (default) | + `expire_member_plans`; keep POST + secret |
   | `isexy-translate-message` | false | translation cache, caller checks |
   | `isexy-send-push-notification` | false | real web-push, settings honoured |
   | `isexy-send-notification-email` | false | settings honoured, throttle |
   | `isexy-send-missed-call-notification` | false | only after `record_missed_call` |
   | `isexy-send-whatsapp-call-notification` | false | caller/match checks |
   | `isexy-twilio-inbound-phone-line` | false | signature, one session per CallSid |
   | `isexy-twilio-phone-line-menu` | false | signature, escaped TwiML, menu |
   | `isexy-twilio-call-status` | false | `apply_twilio_call_status` |
   | `isexy-get-voice-greeting-url` | **true** (default) | staff review queue access |
   | `isexy-ai-chat`, `isexy-send-ticket-confirmation`, `isexy-send-ticket-status-update`, `isexy-send-verification-notification`, `isexy-send-whatsapp-otp` | false | only `_shared/env.ts` differs (`ISEXY_TWILIO_WEBHOOK_BASE` is ISEXY-only): no behaviour change, redeploy to keep the bundle equal to the repo |

   Not to deploy: `isexy-seed-profiles`, `isexy-subscription-resets`
   (quarantined by main; our edits to the latter stay in the repo for a later
   review). Unchanged from main: `isexy-get-voice-reply-url`,
   `isexy-verify-iap-receipt`.
3. **Client, right after 1-2**: open a PR `claude/zealous-brown-kv2hmx` →
   `main` and merge it (Render publishes `main`; check `/release.json`
   shows the merge SHA). Do 1-3 in one window: once 0013/0014 are applied,
   the client still served from main loses the writes they close (checked
   by a scan of main's `src/`): in-app video calls (`video_call_sessions`
   insert/update), chat read state and `matches` update after a send,
   "Who liked you" like-back (`swipes` insert) and the First Impression
   update, Referrals code, My Stars cash-out, Cuban signup flag, staff
   verified flag / Cuban review, scheduled calls, Double Hangout, forum
   posts. V1 has 0 member profiles (main's last count), so nobody is hit
   if the three steps follow each other.
4. **Owner secrets** (see [Needs the owner](#needs-the-owner)): Stripe
   (test mode first) + `ISEXY_STRIPE_PRICE_CHAT_1MO`, `ISEXY_APP_URL`,
   VAPID, Resend, Anthropic, Twilio, `ISEXY_CRON_SECRET` (≥ 16 characters,
   the same value as the GitHub secret of `isexy-allowance-cron.yml`).
5. **After deploying**: one Stripe test purchase per kind (plan, Boost, Super
   Likes, credits, minutes), resend one event (`stripe events resend`) and
   check nothing changes; a call between two members; a push; the scheduler
   run answering 200.

## Done

Every item was checked on a mocked backend (Playwright, 390x844) and, for SQL,
on a throwaway Postgres 16. After the last merge: typecheck clean, build OK, no
new lint errors (120 errors, all pre-existing; 148 at 336099c, 168 before the
first pass), every e2e below passes.

### Discover, likes, matches, sharing (wf/discover)

| Fix | Verified by |
|---|---|
| "Show me" filter no longer empties the deck (`women`/`men`/`everyone` values) | `e2e/discover-e2e.mjs` A9, A10 |
| Who liked you + Likes tab list real likers (new RPC `get_likes_received`); Gold/Platinum see who, others see a count and locked tiles (no identity sent) | discover-e2e C3-C5, D1, D2; `0013-smoke.sql` A1 |
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

- `supabase/isexy-migrations/0013_app_completion.sql` (0004 on this branch before the main merge): all SQL of the five
  branches in one idempotent isexy migration (parts A discover, B accounts,
  C chat, D calls, R rewards; the header lists each part and why; one CHECK
  widening block for `spend` + `referral_bonus`; one definition per function).
  Tested exactly like the CI `migrations` job: `v1-mock.sql`, `migrate.sh`
  dry run, `--apply`, re-run "up to date", guard silent; 0013 re-applied on
  top of itself. Smoke tests (allowed and forbidden calls per RPC/policy):
  `0013-smoke.sql` 34, `calls-smoke.sql` 101, `rewards-smoke.sql` 88 (95 after the main merge), all
  pass. **Not applied anywhere.** `docs/handoff/{accounts,chat,calls,rewards}.sql`
  are kept as branch notes only (marked FOLDED).
- Pass B (calls + rewards): merges conflicted only in `WORKLOG.md` and
  `e2e/README.md`; `isexy-send-missed-call-notification` now needs the call
  `record_missed_call` marked missed (same match and caller, under 5 minutes)
  and never notifies twice; `types.ts` also lists the service_role RPCs the
  functions call; `_shared/payments.ts` lint fix.
- Pass A (discover + accounts + chat): see `integration-a.md` (Matches.tsx,
  ContactMethodModal, push files, `pb-40` on member pages, live-chat topic).

## Trust area (wf/trust)

Branch `wf/trust` (worktree `.claude/worktrees/trust`), local and not
pushed: PR #2's head 30caf62 merged in, then the trust work finished and
tested. Details, defect list, decisions: [docs/handoff/trust.md](handoff/trust.md).

| Fix | Verified by |
|---|---|
| Chat no longer refuses ordinary messages (contact-details patterns with word boundaries); contact-sharing strikes recorded on the server (24 h, 7 days, permanent) and enforced by the messages trigger, which also refuses suspended accounts | `trust-smoke.sql` T1, T6 |
| Block and report through RPCs (idempotent block, one pending report per pair, 20 a day, no self-report); blocked members hidden both ways (profile rows of people who blocked you, Likes sent, group chat, chat links, web profile, forum, Phone Line voice inbox) | trust-smoke T2, T5; `e2e/trust-e2e.mjs` A1-A4 |
| Every staff action is a SECURITY DEFINER RPC checking has_role and writing the audit log: warnings + messaging restriction, lift, shadow ban, suspend/reinstate, verify (`staff_set_profile_verified`), name/bio edit, report review, roles (grant/list, admin only), tickets (admin only, main's 0009 rule), live chat accept/close | trust-smoke T3-T6; trust-e2e B3-B9, C2-C4 (no direct write of profiles/reports/warnings/tickets/roles/blocks) |
| Staff pages: `/admin` (one stats RPC, revenue/tickets admin only), `/admin/moderation` (reports, restrictions, attempts, photo checks, voice greetings), `/admin/verifications` (photo checks; Cuban ID on hold, admin only), `/admin/agent` (live chat, phone layout), `/support` (real tabs, saved replies, audit log); moderators admitted where the RPCs allow them; a moderator on an admin-only page lands on `/admin` | trust-e2e B1-B8, C1-C4 |
| Tickets: guests track by number + e-mail (`get_ticket_status`); ticket e-mails from `ISEXY_RESEND_FROM`; status e-mail function admin only | trust-smoke T3; trust-e2e A8, C2 |
| Assistant: streamed answers (last line read without a newline); members reach a person inside the widget; guests are offered sign-in or a ticket | trust-e2e A9 |
| 404 branded EN/FR with in-app links; EN/FR button shows EN/FR and has a name; Help search opens the Help Centre; back buttons stay in ISEXY; bottom-nav tab stays highlighted on nested pages | trust-e2e A5-A7 |

**Deploy (after this PR's steps 1-3, in this order):**

1. `scripts/isexy/migrate.sh` dry run must list exactly
   `0015_trust_and_moderation.sql`, end with "isexy guard: V1 objects
   unchanged" and "Dry run OK: 1 migration(s)"; then `--apply`, then a
   re-run says "up to date" (`schema_migrations`: 15 rows). Tested locally
   on 0001-0014 (and on 0001-0012 → 0013-0015, and from scratch).
2. Functions (`verify_jwt = false` for all three, as in `supabase/config.toml`):
   `isexy-ai-chat` (handoff for members only, one open chat per member),
   `isexy-send-ticket-confirmation` and `isexy-send-ticket-status-update`
   (sender `ISEXY_RESEND_FROM`; status e-mail reads the ticket from the
   database, admins only). **Before** the two ticket functions: the owner
   verifies the sending domain in Resend (default `notifications@isexy.ca`).
3. Client: merge `wf/trust` (after PR #2 is merged). 0015 does not break
   PR #2's client meanwhile (its admin ticket updates still pass main's
   0009 rule; the policies 0015 tightens are not used by it except the
   old Agent Dashboard's "system" lines, staff only).

Still open in the area: account deletion stays a ticket (staff delete by
hand); Cuban ID review untouched (on hold); staff pages English only.

## Left (ordered by member impact)

| # | What | Exact next step |
|---|---|---|
| 1 | Nothing new works on V1 until 0013 + 0014 and the functions are deployed (Who liked you "on their way", unread never clears, settings "saved on this device", translation "unavailable", calls cannot start, wallet falls back to table reads, Loyalty "not switched on yet") | [Deploy plan](#production-state-and-deploy-plan) steps 1-2 |
| 2 | `deno check` ran locally for the first time in the merge stage (Deno 2.5.6 from npm, scratchpad): every `isexy-*` function and main's five Deno tests pass | Confirm on CI for this push |
| 3 | Calls between two phones on mobile data often never connect without TURN | Owner: TURN server + `VITE_TURN_URL`/`VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL` (see Needs the owner) |
| 4 | Push cannot be signed (no VAPID private key) | Owner: see Needs the owner; then a real-device test push (if `crypto.createECDH` fails on the edge runtime, switch to `jsr:@negrel/webpush`) |
| 5 | Payments say "not open yet" until Stripe is configured | Owner: Stripe secrets, prices, webhook (see Needs the owner); one test purchase per kind, resend one event and confirm nothing changes, then `ISEXY_PAYMENTS_LIVE_ENABLED=true` |
| 6 | Chat needs Premium or a chat unlock, and nothing can be bought pre-launch | Owner decides the rule; if relaxed, change the unlock check in `src/pages/Chat.tsx` and `src/lib/inbox.ts` together |
| 7 | Theme is still coral pink, BRAND.md says electric blue on deep navy | Change `--primary`/`--secondary` (and the `to-pink-500` gradients, e.g. `AIChatWidget.tsx`) in `src/index.css` per BRAND.md, then re-run `accounts-layout.mjs` |
| 8 | Greetings and replies recorded before wf/calls are WebM/MP4: Twilio cannot play them (browse by phone reads name + headline) and Safari cannot play WebM | Owner: ask those members to re-record, or add a server-side transcode to WAV |
| 9 | No push/email when a match forms | Call the push/email functions with `type: "new_match"` from a DB webhook on `matches` INSERT (service role) |
| 10 | Distance slider and Go Global do nothing | After the owner picks a default: add `AND (me.distance_preference IS NULL OR dist IS NULL OR dist <= me.distance_preference)` to `get_discover_feed` (in 0013 while unapplied, else a new migration); save Go Global as `distance_preference = NULL` in `DiscoverFilters.handleApply` |
| 11 | First Impression text skips moderation | Run `useContentModeration` in Discover before `sendFirstImpression` (or check in `set_first_impression`) |
| 12 | Saved but not honoured: Active Status, Send Read Receipts, distance unit, "who I'd like to see" filters | Active Status: SECURITY DEFINER RPC returning `last_active_at` NULL for members with `showActive = false`, used by `src/lib/inbox.ts`; read receipts: hide ticks for readers who turned them off |
| 13 | Double Hangout half-built; group chats are never created | Pair deck + RPC writing `double_date_swipes`, creating `double_date_matches`, `group_chats` and 4 `group_chat_members` on a mutual like; or hide the entry |
| 14 | No photos or voice messages in chat | `isexy-chat-media` bucket with match-member RLS, `messages.attachment_url/attachment_type`, upload + render in `Chat.tsx` |
| 15 | The phone menu (IVR) speaks English only | Owner's French wording, then a language choice in `mainMenu` (`supabase/functions/_shared/twilio.ts`) with a fr-CA Polly voice (e.g. `Polly.Chantal`) |
| 16 | The floating assistant button (`AIChatWidget`, right-4 bottom-20) covers the right end of sticky bottom bars on phones | Phone Line and buy pages are handled (`pb-40`/`pr-20`, `HIDDEN_ON`); check other pages with a sticky action bar the same way |
| 17 | An error toast sits over the Discover action row for ~4 s (toasts are lifted 96 px above the nav) | Use `position="top-center"` on phones for `<Sonner>` in `App.tsx`, or a smaller offset on `/discover` |
| 18 | Main removed the Premium countdown (decision 19: no offer the payment server does not enforce); create-checkout still applies `ISEXY_STRIPE_COUPON_FIRST_WEEK` when asked with `promo: true`, but no page asks any more | Owner: show the first-week offer without a timer (the coupon is real in Stripe), or drop the coupon path; delete the dead `PromoOfferBanner.tsx` / `PromoCountdownBanner.tsx` |
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
| `ISEXY_APP_URL` | links in emails/pushes, Stripe return URLs | set it: HTTPS, no credentials (`_shared/app-url.ts` refuses others); Stripe return URLs default to `https://isexy.onrender.com`, emails to isexy.ca |
| `ISEXY_ANTHROPIC_API_KEY` | chat translation, assistant | |
| `ISEXY_STRIPE_SECRET_KEY`, `ISEXY_STRIPE_WEBHOOK_SECRET` | payments | test mode first; without both the pages say "Payments are not open yet" |
| `ISEXY_STRIPE_PRICE_{PLUS,GOLD,PLATINUM}_{WEEK,MONTH,SIX_MONTHS}` | plans | 9 recurring prices in CAD |
| `ISEXY_STRIPE_PRICE_CHAT_1MO` | chat subscription | recurring CAD price; without it "not available yet" |
| `ISEXY_STRIPE_COUPON_FIRST_WEEK` | first-week offer | optional 50 % "once" coupon; no page offers it since the main merge (Left #18) |
| `ISEXY_PAYMENTS_LIVE_ENABLED` | payments | `true` only after the test purchases |
| `ISEXY_TWILIO_ACCOUNT_SID`, `ISEXY_TWILIO_AUTH_TOKEN` | phone line by phone | `ISEXY_TWILIO_WEBHOOK_BASE` only behind a custom domain |
| `ISEXY_CRON_SECRET` | `isexy-reset-allowances` | at least 16 characters; the same value as the GitHub Actions secret `ISEXY_CRON_SECRET` used by `.github/workflows/isexy-allowance-cron.yml` (daily POST with the anon JWT: the function keeps verify_jwt=true) |

**GitHub Actions** (from main's task queue, still open): secrets
`ISEXY_DB_URL` and `SUPABASE_ACCESS_TOKEN` are missing, so the deploy jobs
skip themselves (migrations and functions were deployed by hand so far);
`ISEXY_CRON_SECRET` for the daily allowance workflow.

**Stripe account shared with other TAKATAK products?** The webhook fails
(500, retried by Stripe) any checkout without ISEXY's server-written
`metadata.user_id`, as main's v6 does; a shared account would then keep
failing other products' events on the ISEXY endpoint. If the account is
shared, give ISEXY its own endpoint scope or account before going live.

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

**Dashboard**: none new for 0013 (the `isexy-photo-verifications` bucket and its
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
9. Moderators review voice greetings and photo checks and answer live chats on wf/trust (`/admin/moderation`, `/admin/agent`); tickets stay admin only (main's 0009). Keep or narrow?
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
for t in adult-profiles allowance-rpc-permissions privileged-rpc-permissions support-ticket-staff-fields atomic-credit-checkout atomic-boost-checkout; do
  psql "$ISEXY_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/isexy/test/$t.sql   # main's assertions (each rolls back)
done
for t in 0013-smoke calls-smoke rewards-smoke security-smoke live-functions-compat trust-smoke; do
  printf 'BEGIN;\n\\i scripts/isexy/test/%s.sql\nROLLBACK;\n' $t | psql "$ISEXY_DB_URL" -X -q -v ON_ERROR_STOP=1
done   # -v ON_ERROR_STOP=1: without it psql exits 0 even when a smoke file fails (CI runs the same loop)
```

Production simulation (what V1 will see): a fresh database with v1-mock and
only 0001-0012 applied (move 0013/0014 aside, `--apply`, put them back), then
the dry run must list only 0013 and 0014; `--apply`, re-run, all SQL tests
(see merge-main.md §3).

The sandbox does not let the `postgres` user into the scratchpad: the data
directory has to live elsewhere (e.g. a new folder under `/var/tmp`).

Edge functions: CI runs `deno check` and main's Deno tests. Deno is not
installed here, but `npm install deno@2.5.6` in a scratch folder gives a
working binary (`DENO_CERT=/root/.ccr/ca-bundle.crt DENO_NO_PACKAGE_JSON=1`,
`deno check supabase/functions/isexy-*/index.ts`, `deno test scripts/isexy/test/<name>.test.ts`).

## Security and DB performance (0014)

`supabase/isexy-migrations/0014_security_and_performance.sql` (0005 on this
branch before the main merge; not applied anywhere; the header lists each
part and what main's 0004/0005/0008 already did). Audit, reasons and what was left alone:
[docs/handoff/security.md](handoff/security.md).

| Closed | How | Verified by |
|---|---|---|
| Members could UPDATE their own plan, limits, verified flag, shadow ban, promo, `is_cuban`, `referral_code`, ids, `created_at`, `is_active` (ban) on `profiles`, or INSERT a profile with them | BEFORE INSERT OR UPDATE trigger `profiles_protect_columns`: refused (42501) for `authenticated`/`anon` unless staff; RPCs (SECURITY DEFINER) and the service role unaffected. grep of src/: no member write sets one | `security-smoke.sql` A (refused writes, plus profile edit, settings save, signup insert, `set_my_cuban_flag`, `get_my_referral_code`, staff, service role) |
| Member INSERT/UPDATE on `credit_transactions`, `boost_transactions`, `boost_wallets`, `allowances`, `star_transactions`, `gift_transactions`, `coupon_redemptions`; INSERT `missed_calls` for anyone; UPDATE of any message column in own matches | Policies dropped (SELECT kept); writes go through the RPCs/functions | security-smoke B1 (+ wallet, boost, credits, mark_messages_read, call RPCs, record_missed_call still work) |
| Same class found by the audit: swap the other member of a match; direct swipes (skip like limits); fake completed referrals; star cash-out with any amount; planted translations; violations filed against others; forum posts as someone else / self-pinned; scheduled calls with strangers; Double Hangout pairs forced active or swapped; self-approved Cuban verification; photo uploads into another member's folder | Policies dropped or tightened, guard triggers on `scheduled_calls` and `double_date_pairs` | security-smoke B2 |
| `get_admin_users` listed every staff member to anyone; anyone could run `purge_old_telemetry`/`cleanup_expired_otps`/`calculate_profile_score`; anon EXECUTE on member RPCs; TRUNCATE/TRIGGER/REFERENCES and `setval` for anon/authenticated | Staff only / service_role only (the first three by main's 0008, live) / anon revoked / grants revoked (also for future isexy tables) | security-smoke B3, B4 |
| 51 unindexed foreign keys; 133 policies calling `auth.uid()`/`has_role(auth.uid())` per row; `normalize_gender` without search_path; redundant `swipes_swiper_idx` | 41 covering indexes (10 more are main's 0005); static ALTER POLICY to `(select auth.uid())` / `(select isexy.has_role(...))` (same logic, checked policy by policy) behind a fingerprint guard, generated by `scripts/isexy/gen-rls-initplan.sh`: 131 policies after the main merge (main's 0010 ticket policies already evaluate once); search_path: main's 0004; index dropped (duplicate UNIQUE constraints kept) | security-smoke C; migration test |

Migration test (as CI, local Postgres 16): mock, dry run, `--apply`, re-run "up
to date", guard silent; 0014 re-applied on itself is a no-op. After the main
merge (0001-0014, and the production simulation 0001-0012 → 0013, 0014): main's
six SQL assertions pass, smoke 0013 34, calls 101, rewards 95, security 105,
all PASS. CI's `migrations` job runs main's assertions after the apply and the
four smoke files after the re-run. Before this pass the security smoke file
failed 60 checks on 0001-0004 (the holes were real).

Left (not changed here; details in security.md › Looked at and left alone):

| What | Next step |
|---|---|
| Staff ban button (`AdminDashboardFull` → `profiles.is_active`) changes nothing: no staff UPDATE policy on `profiles` | Done on wf/trust: `staff_set_account_active` (0015 E) |
| `useContentModeration` inserts `user_warnings` as the member (staff-only policy): progressive bans never record | Done on wf/trust: `record_contact_sharing` + messages trigger (0015 C, D) |
| Reporter can set `reports.status` on INSERT | Done on wf/trust: INSERT check pending/unreviewed/not self (0015 B4) |
| Every member reads every column of every active profile (`blocked_contacts`, coarse location, plan, shadow ban) | Owner/next pass: a member-facing view or RPC with the public columns |
| Chat unlock and Plus-only settings (Incognito, Recently Active) enforced in the UI only | After owner decision #1: `messages` INSERT check / settings RPC |
| A policy added or changed later makes 0014 C2 stop | Only if 0014 itself is edited: later migrations (0015) write policies in the `(select auth.uid())` form, and 0014 re-run after 0015 says "already applied" |

(Fixed by main meanwhile, live: members could change `status`/`priority`/
`assigned_to`/`response` of their own ticket, and the ticket policies read
`auth.users`: main's 0009 trigger and 0010 policies.)
