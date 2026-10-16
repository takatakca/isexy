# ISEXY handoff (2026-10-16)

Branch `claude/zealous-brown-kv2hmx`: wf/discover, wf/accounts and wf/chat are
merged and pushed. **Nothing from this pass is deployed**: the app on V1 still
runs `main` 0a0c6be. Details per area: [discover report](#done) below,
[docs/handoff/accounts.md](handoff/accounts.md), [docs/handoff/chat.md](handoff/chat.md),
integration notes [docs/handoff/integration-a.md](handoff/integration-a.md).

Contents: [Done](#done) · [In progress](#in-progress) · [Left](#left-ordered-by-member-impact) ·
[Needs the owner](#needs-the-owner) · [How to run](#how-to-run-the-checks) ·
[Production state](#production-state) · [Next pass](#next-pass-security-and-db-performance)

## Done

Every item was checked on a mocked backend (Playwright, 390x844) and, for SQL,
on a throwaway Postgres 16. After the merge: typecheck clean, build OK, no new
lint errors (148 pre-existing errors, 20 fewer than before), all e2e below pass.

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
| Missed-call banner, call notifications open the chat, locked chats show the contact sheet | chat-notifications-e2e, `smoke-call.mjs` |

### Integration (this pass)

- `supabase/isexy-migrations/0004_app_completion.sql`: all SQL of the three
  branches in one idempotent isexy migration (parts A discover, B accounts,
  C chat; header lists each part and why). Tested exactly like the CI
  `migrations` job: `v1-mock.sql`, `migrate.sh` dry run, `--apply`, re-run
  "up to date", guard silent; 0004 also re-applied on top of itself. RPC smoke
  test `scripts/isexy/test/0004-smoke.sql`: 34 checks (allowed and forbidden
  call per RPC), all pass. **Not applied anywhere; integrator B appends to it.**
- Merge conflicts: `Matches.tsx` (discover's `useChatOpener` + chat's tick and
  realtime rules), `ContactMethodModal.tsx` (chat's), push hook/prompt and
  email/push settings (chat's), `types.ts` (all entries kept, plus
  `review_photo_verification`, `is_group_chat_member`).
- Cross-area: member pages with the bottom nav use `pb-40` so the last row
  scrolls clear of the assistant button; Likes badge counts the same likers as
  Who liked you; live-chat channel renamed `live-chat-<id>`; ESLint ignores
  `.claude/` worktrees.
- `e2e/`: one README, `offline-browser.mjs` network guard, discover e2e and the
  earlier smoke scripts kept in the repo.

## In progress

Other agents are working right now on `wf/calls`, `wf/rewards` and `wf/trust`
(not merged here). Things they should know:

- **Calls**: an incoming call only rings if the callee's app is open when the
  call starts (`IncomingCallNotification` listens for realtime inserts only).
  Next step: on mount, read `video_call_sessions` still `ringing` for me and
  younger than ~45 s.
- **Rewards**: `src/pages/GetBoosts.tsx` reads table `boost_wallet`, which does
  not exist in the isexy schema (`boost_wallets` does). Cuba rewards pages read
  `cuban_points*` (Cuba on hold: plain bug fixes only).
- **Trust**: photo verification has no staff screen yet (see Left #5). The
  RPC `review_photo_verification` and the staff RLS are in 0004.
- All three: append SQL to `0004_app_completion.sql` (not applied yet) rather
  than adding 0005; keep SECURITY DEFINER + `SET search_path = isexy, extensions`
  + REVOKE/GRANT, and run `scripts/isexy/test/0004-smoke.sql` after.

## Left (ordered by member impact)

| # | What | Exact next step |
|---|---|---|
| 1 | Nothing new works on V1 until 0004 and the functions are deployed (Who liked you shows "on their way", unread never clears, badges fall back, settings say "saved on this device", translation "unavailable", verification requests fail) | Main session: `ISEXY_DB_URL=... scripts/isexy/migrate.sh` (dry run) then `--apply`; deploy by name `isexy-translate-message`, `isexy-send-push-notification`, `isexy-send-notification-email`, `isexy-send-missed-call-notification`, `isexy-send-whatsapp-call-notification` |
| 2 | Push cannot be signed (no VAPID private key) | Owner: see Needs the owner; then a real-device test push (if `crypto.createECDH` fails on the edge runtime, switch to `jsr:@negrel/webpush`) |
| 3 | Chat needs Premium or a chat unlock, and nothing can be bought pre-launch | Owner decides the rule; if relaxed, change the unlock check in `src/pages/Chat.tsx` and `src/lib/inbox.ts` together |
| 4 | Theme is still coral pink, BRAND.md says electric blue on deep navy | Change `--primary`/`--secondary` (and the `to-pink-500` gradients, e.g. `AIChatWidget.tsx`) in `src/index.css` per BRAND.md, then re-run `accounts-layout.mjs` |
| 5 | Photo verification requests wait forever (no staff screen) | Trust area: list `photo_verifications` where `status='pending'`, selfie via `storage.from("isexy-photo-verifications").createSignedUrl(path, 600)`, approve/reject with `rpc("review_photo_verification", { p_request_id, p_approve, p_reason })` |
| 6 | No push/email when a match forms | Call the push/email functions with `type: "new_match"` from a DB webhook on `matches` INSERT (service role) |
| 7 | Distance slider and Go Global do nothing | After the owner picks a default: add `AND (me.distance_preference IS NULL OR dist IS NULL OR dist <= me.distance_preference)` to `get_discover_feed` (append to 0004); save Go Global as `distance_preference = NULL` in `DiscoverFilters.handleApply` |
| 8 | First Impression text skips moderation | Run `useContentModeration` in Discover before `sendFirstImpression` (or check in `set_first_impression`) |
| 9 | Saved but not honoured: Active Status, Send Read Receipts, distance unit, "who I'd like to see" filters | Active Status: SECURITY DEFINER RPC returning `last_active_at` NULL for members with `showActive = false`, used by `src/lib/inbox.ts`; read receipts: hide ticks for readers who turned them off |
| 10 | Double Hangout half-built; group chats are never created | Pair deck + RPC writing `double_date_swipes`, creating `double_date_matches`, `group_chats` and 4 `group_chat_members` on a mutual like; or hide the entry |
| 11 | No photos or voice messages in chat | `isexy-chat-media` bucket with match-member RLS, `messages.attachment_url/attachment_type`, upload + render in `Chat.tsx` |
| 12 | An error toast sits over the Discover action row for ~4 s (toasts are lifted 96 px above the nav) | Use `position="top-center"` on phones for `<Sonner>` in `App.tsx`, or a smaller offset on `/discover` |
| 13 | Settings screens with no backend (Top Picks visibility, Q&A Events, Friends in Common, Introductions, Swipe Surge) | Owner keeps or removes them; if kept, a jsonb column in `user_preferences` replaces `useDeviceSetting` |
| 14 | Undo is free on every plan and does not refund the like | Owner decision; if gated, check `entitlements_cache.unlimited_rewinds` before `deck.undo()` and refund through an RPC |
| 15 | Web profile links need sign-in; direct `/web-profile/:id` links ignore Incognito/Discovery off | If the owner wants public links: `profiles.web_profile_enabled` + SECURITY DEFINER `get_web_profile(id)`; apply the privacy settings there |
| 16 | `/matches-list` is linked from nowhere | Redirect it to `/matches` in `App.tsx`, or link it from Likes |
| 17 | Likes badge counts every pending like, not "new since last visit" | `likes_seen_at` in `user_preferences`, filter in `get_my_badge_counts` |
| 18 | Push categories with no sender (super likes, top picks, swipe surge, boost expiring, likes frequency) | Wire each when its feature emits an event, using the keys in `notification_settings.push` |
| 19 | Email throttle is per function instance | Store `last_notified_at` per (match, recipient) |
| 20 | Account deletion is a support ticket; staff delete by hand | Staff flow in the trust/admin area |
| 21 | English-only strings on the pages touched in this pass | Move them into the i18n mechanism the language owner picks (EN + Canadian FR) |
| 22 | Explore labels "Just for Fun" / "Free Tonight" may read as dating | Owner reviews `categoryTitles`/`categoryInterests` in `CategorySwipe.tsx` and `Explore.tsx` |
| 23 | Swipe drag only tested with mouse pointer events | Real iOS Safari + Android Chrome check |
| 24 | `public/og-image.png` says "Premium dating between Canada & Cuba"; Discover empty state mentions Cuba | Waiting on the owner's hero image decision and the Cuba hold |

## Needs the owner

**Function secrets on V1** (ISEXY_ prefix; `_shared/env.ts` reads them first):

| Secret | For | Note |
|---|---|---|
| `ISEXY_VAPID_PUBLIC_KEY`, `ISEXY_VAPID_PRIVATE_KEY` | push | generate with `npx web-push generate-vapid-keys` |
| `ISEXY_VAPID_SUBJECT` | push | optional, `mailto:` address or site URL |
| `ISEXY_RESEND_API_KEY` | message / missed-call emails | |
| `ISEXY_RESEND_FROM` | emails | optional, default `notifications@isexy.ca` (verify the domain in Resend) |
| `ISEXY_APP_URL` | links in emails/pushes | optional; emails default to isexy.ca, missed-call emails to isexy.onrender.com, so set it |
| `ISEXY_ANTHROPIC_API_KEY` | chat translation, assistant | |

Payments, Stripe, Twilio and WhatsApp secrets: unchanged, see `docs/V1-MIGRATION.md` §3.

**Build env (Render/Coolify)**: `VITE_VAPID_PUBLIC_KEY` = the same public key
(the hard-coded fallback key has no known private half). Existing:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`,
`VITE_TURN_URLS`/`VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL` (calls).

**Dashboard**: none new for 0004 (the `isexy-photo-verifications` bucket and its
policies come with the migration; the `isexy` schema is already exposed).
Resend: verify the sending domain for `ISEXY_RESEND_FROM`.

**Decisions**:
1. Chat rule pre-launch: Premium or a chat unlock (current) or relaxed?
2. Default Discover distance before the distance filter is enforced (all profiles default to 80 km).
3. Undo/rewind: free or Plus-only ("Unlimited Rewinds" in the plans)?
4. Keep or remove Top Picks visibility, Q&A Events, Friends in Common, Introductions, Swipe Surge screens.
5. Public profile links (opt-in) or members-only (current)?
6. May the push function delete subscriptions whose endpoint answers 404/410 (kept today: no-delete rule)?
7. Explore category wording; hero/OG image; Cuba items stay on hold.

## How to run the checks

```bash
npm run typecheck
npm run build                         # local e2e: NODE_OPTIONS="--import=./e2e/no-network.mjs" npm run build
npm run lint                          # 148 errors are pre-existing (base had 168)
npx vite preview --port 4173 --strictPort --host 127.0.0.1 &
node --import ./e2e/offline-browser.mjs e2e/<file>.mjs [args]   # see e2e/README.md
```

Database, on a throwaway local Postgres 16 only (never V1), as CI does:

```bash
export ISEXY_DB_URL=postgresql://postgres@localhost:<port>/postgres
psql "$ISEXY_DB_URL" -X -q -v ON_ERROR_STOP=1 -f scripts/isexy/test/v1-mock.sql
scripts/isexy/migrate.sh && scripts/isexy/migrate.sh --apply && scripts/isexy/migrate.sh   # last one: "up to date"
printf 'BEGIN;\n\\i scripts/isexy/test/0004-smoke.sql\nROLLBACK;\n' | psql "$ISEXY_DB_URL" -X -q
```

Edge functions: CI runs `deno check` (Deno is not installed here; the changed
functions were type-checked with tsc and Deno shims).

## Production state

- TAKATAK V1 (Supabase, shared): migrations 0001-0003 applied and checksummed,
  schema `isexy` exposed, 0 ISEXY member profiles (pre-launch).
- Only `isexy-payments-gate-status` is deployed.
- **0004 and every other isexy-* function are NOT deployed.**
- Render serves `main` at 0a0c6be. This branch is not merged to `main`.
- The client degrades without 0004 (quiet fallbacks listed in Left #1).

## Next pass: security and DB performance

Close the known holes (SECURITY DEFINER RPCs with `SET search_path = isexy, extensions`
that check `auth.uid()`, or edge functions):

- Members can UPDATE any column of their own `profiles` row (plan, limits,
  `is_verified`, shadow ban, promo, `is_cuban`...). Until fixed,
  `get_likes_received` / `set_first_impression` trust a member-writable
  `subscription_tier`, and photo verification approval means little.
- Members can INSERT their own credit/boost/star/gift transactions and coupon
  redemptions, and INSERT/UPDATE their own `boost_wallets` and `allowances`.
- Any signed-in member can INSERT `missed_calls` for anyone: limit INSERT to
  service_role (only `isexy-send-missed-call-notification` inserts).
- "Users can update message read status" lets a member UPDATE any column of any
  message in their matches: drop it once 0004 is live (no client code updates
  `messages`).
- "Users can update own matches" lets a member change any column (e.g.
  `is_active`); the client no longer needs it.
- Chat unlock is enforced only in the UI: add a `messages` INSERT check
  (premium, chat unlock or chat subscription).
- Default privileges grant ALL (including TRUNCATE) on isexy tables to `anon`
  and `authenticated`: revoke what PostgREST does not need.

DB performance: 58 missing FK indexes; 138 policies to rewrite with
`(select auth.uid())`; `isexy.normalize_gender` needs a fixed `search_path`;
duplicate unique indexes on `matches` and `swipes` (`swipes` has both
`UNIQUE(swiper_id, swiped_id)` and `swipes_swiper_swiped_unique`).
