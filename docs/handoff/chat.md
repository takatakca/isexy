# Handoff: chat, messages and notifications (branch wf/chat)

Running notes, updated with every commit. SQL for the database is in
`docs/handoff/chat.sql` (idempotent, isexy schema only, tested on a local
Postgres 16 with `scripts/isexy/test/v1-mock.sql` + migrations 0001-0003).

## Database (docs/handoff/chat.sql, not applied anywhere)

- `isexy.mark_messages_read(p_match_id)`: SECURITY DEFINER, only flips `is_read`
  on messages the other participant sent to the caller; outsiders get 42501,
  anon has no EXECUTE. The client uses it instead of `UPDATE messages`.
- Trigger `messages_touch_match`: keeps `matches.last_message_at` current, so
  the browser no longer UPDATEs `isexy.matches` after each send.
- `isexy.get_my_badge_counts()`: unread messages + pending likes received for
  the bottom-nav badges (members cannot read swipes made on them).
- Group chat RLS: the `group_chat_members` SELECT policy referenced itself
  ("infinite recursion detected in policy", reproduced locally), so every group
  chat query failed. Replaced with `isexy.is_group_chat_member()`; sending now
  also checks `sender_id` is the caller.
- Index for the translation cache lookup.
- `user_preferences.notification_settings jsonb` (email + push choices).

## Fixed

(see git log on wf/chat; each entry lists files and how it was verified)

- Chat page (`src/pages/Chat.tsx`): read state via `mark_messages_read` RPC
  (on open, on incoming messages while visible, when the tab becomes visible;
  stops quietly if the RPC is not deployed yet); failed sends stay in the
  thread with "Not sent · Retry · Delete" (auto-retry when back online);
  history pages of 50 with "load earlier" on scroll-up keeping the reader's
  place; own scroll container (100dvh) so the composer and header stay put and
  the newest message stays in view when the keyboard opens; "N new messages"
  pill when reading older messages; day separators; multi-line composer
  (Enter sends, Shift+Enter new line); read receipts visible on the blue bubble
  (they were blue on blue); no more client UPDATE of `matches.last_message_at`
  (trigger does it); translation reads cached rows first and re-translates
  when the language changes (before, a language switch kept the old language);
  translation failures (404/503 or 3 errors) stop calls and say so in the
  banner instead of failing silently per message; presence: "In this chat now"
  and no push/email when the other person is looking at the chat; push
  notification on new message (no message text on the lock screen).
- `isexy-translate-message`: optional `messageId` → checks the caller is in
  that conversation, serves/stores `message_translations` (one Claude call per
  message and language).

- `ContactMethodModal`: the two eslint `any` errors (typed `UnlockResult`,
  plain `catch`), sheet raised to `z-[60]` (the bottom nav at z-50 covered its
  bottom on /matches), Escape closes, dialog role/labels, safe-area padding,
  icons in brand blue instead of green/blue. Messages safety dialog also z-[60].

- Bottom-nav badges (`useNotificationCounts`, `BottomNav`): the Likes badge
  counted new matches of the last 24 h; it now shows likes received and not
  answered yet (`get_my_badge_counts`). Unread uses the same rules as the inbox
  (inactive/blocked matches no longer inflate it); fallback to the inbox RPC
  until the new RPC is deployed. Refetch is debounced and also runs when the
  tab becomes visible. aria-labels with counts.
- Realtime topics: BottomNav used the fixed topic `notification-counts`; it
  remounts on every page, and `supabase.channel()` returns a still-closing
  channel with the same topic, so the new listeners died silently. Badge and
  inbox channels now use a per-mount topic; the chat (shared topic for typing
  and presence) waits for a stale channel to close before re-joining.

- Push notifications were never delivered: the browser subscription was only
  `console.log`ged (never stored in `push_subscriptions`) and the edge function
  only logged "would send". Now `usePushNotifications` upserts the
  subscription (and re-syncs an existing one on load), and
  `isexy-send-push-notification` sends with `npm:web-push@3.6.7` (TTL 1 h,
  same-site `data.url` only, 404/410 counted as expired, rows kept: no deletes).
  The hook also waited on `navigator.serviceWorker.ready`, which never resolves
  without a registered worker, so `loading` stayed true and the opt-in prompt
  never appeared.
- Opt-in prompt (`PushNotificationPrompt`): only for signed-in members with a
  profile on in-app pages (/discover, /explore, /likes, /matches, /profile),
  never on public pages, setup or mid-chat; asked once (closes after the
  browser answer); brand colours and social-network wording.
- Push settings page: the save effect ran before the load effect and wrote the
  defaults over the member's choices on every visit; settings now load first.
  New "Notifications on this device" switch (subscribe / unsubscribe, explains
  when the browser blocks it). `any` icon type fixed.
- `public/sw.js`: notification icon uses the app icon.

- Incoming-call push (`isexy-send-whatsapp-call-notification`, which
  VideoCall calls for every call): the push went out only to members with a
  verified WhatsApp number (Cuba flow); it now goes to everyone first, says
  "call" or "video call", and opens the chat (the old `/video-call/:id` link
  would have started a new outgoing call instead of answering). WhatsApp part
  unchanged (Cuba on hold).
- Missed calls (`isexy-send-missed-call-notification`, `MissedCallBanner`):
  the function links the rung-out call session (`call_session_id`) and uses
  the call type (phone vs video) in email/push; phone-only accounts get no
  email to their placeholder address; sender defaults to
  notifications@isexy.ca (the resend.dev sandbox sender only reaches the
  Resend account owner); push opens the chat; email in brand colours. The
  banner: call back with the right type (it always started a video call),
  Message button, live updates (realtime on `missed_calls`), dismissals
  remembered on the device, destructive/primary tokens instead of red/green.
- Notification emails (`isexy-send-notification-email`): brand colours (navy
  header, #1565D8 buttons), links follow `ISEXY_APP_URL` (default isexy.ca),
  "Reply" opens the conversation, `RESEND_FROM` respected.

- Group chat page (`src/pages/GroupChat.tsx`): 2 queries per member/message
  (N+1) → 3 queries + 2 for people; loading, error ("couldn't load" with
  Retry) and "not available / not a member" states (with the old RLS every
  query failed and the page sat empty); the Info button was dead → members
  sheet; brand colours (was pink/orange); own scroll container that follows
  new messages only when at the bottom; sent message shown from the insert
  result (no dependence on realtime echo); unique realtime topic.

- Matches list (`/matches-list`, `src/pages/Matches.tsx`): 4 queries per
  match → the inbox RPC + one profiles query; unlocked conversations open the
  chat directly (it always showed the contact sheet, even for open chats);
  error state with Retry; inactive/blocked handled by the inbox; "messages"
  icon pointed at the /messages redirect; tick shown only on my own last
  message; refreshes on new messages too; `any` removed.

- Email settings page saved nothing (switches were local state), showed
  "user@example.com" / "Verified" for everyone and had a dead "send
  verification email" button. Now loads/saves
  `user_preferences.notification_settings.email` (rollback + toast on
  failure), shows the real address and verification state, explains
  phone-only accounts. Push settings are also saved to the account
  (`notification_settings.push`, debounced) and loaded from it.
  `isexy-send-notification-email` skips new-message emails when
  `email.new_messages` is off; `isexy-send-push-notification` skips message /
  match pushes when `push.messages` / `push.newMatches` is off (calls always
  go through). Helper: `src/lib/notificationSettings.ts`.
- Scheduled-call push showed the recipient's own name ("Bea wants to video
  call you" sent to Bea); now the scheduler's name, and it opens the chat.

- `ScheduledCallsList` (shown on the Chat tab): its realtime cleanup was never
  returned from the effect, so each visit leaked a channel on the fixed topic
  and later visits got no live updates; now cleaned up, per-mount topic.
- Chat typing indicator re-announced every 2 s while typing (it vanished after
  3.5 s of continuous typing).

- Chat page applies the inbox's unlock rule (premium or a `chat` unlock for
  this match): direct links (push, match celebration "Chat now", missed-call
  "Message", video call "Open chat") skipped the contact sheet. Locked → the
  same contact sheet over the chat, composer disabled; closing it without
  unlocking returns to /matches (not when the sheet itself navigated to a
  call). Server-side enforcement is still missing (see below).

## Verification

- `npm run typecheck`, `npm run build`: pass. ESLint: every changed src file
  clean (incl. the two ContactMethodModal `any` errors).
- `docs/handoff/chat.sql` applied twice (idempotent) on a local Postgres 16 with
  `scripts/isexy/test/v1-mock.sql` + 0001-0003; behaviour test: read RPC flips
  only the other person's messages (2), outsider gets 42501, anon has no
  EXECUTE, badge counts (2 unread → 0 after read, 1 pending like), group chat
  member sees group/members/messages, outsider sees nothing, spoofed sender
  rejected; the original recursion error reproduced on a DB without the fix.
- Edge functions: no Deno here; type-checked with tsc + shims (Deno, std
  server, npm modules as any): no errors in the five changed functions.
- Playwright, 390x844, `vite preview` with REST/RPC/functions **and the
  realtime websocket** mocked (no backend reached):
  `e2e/chat-e2e.mjs` (38 checks: open at newest, paging + position kept,
  read RPC, cached + live translation, optimistic send, failed send + Retry,
  push/email payloads, realtime receive, typing, read receipt, new-message
  pill, presence suppresses push, locked chat sheet) and
  `e2e/chat-notifications-e2e.mjs` (21 checks: badges, missed call banner,
  contact sheet above nav, push opt-in stores the subscription, push/email
  settings saved + survive reload, group chat, matches list). Both pass.

## Left to do

1. **Deploy** (integrator/owner): fold `docs/handoff/chat.sql` into the next
   isexy migration; deploy `isexy-translate-message`,
   `isexy-send-push-notification`, `isexy-send-notification-email`,
   `isexy-send-missed-call-notification`,
   `isexy-send-whatsapp-call-notification`. Until then the client degrades:
   read RPC stops quietly (unread stays), badges fall back to the inbox,
   translation says "unavailable".
2. **VAPID keys** (owner): `npx web-push generate-vapid-keys`; set function
   secrets `ISEXY_VAPID_PUBLIC_KEY`, `ISEXY_VAPID_PRIVATE_KEY` (optional
   `ISEXY_VAPID_SUBJECT`, e.g. `mailto:` or the site URL) and build env
   `VITE_VAPID_PUBLIC_KEY` (same public key). The hard-coded fallback public
   key's private half is unknown, so pushes cannot be signed until this is done.
   Then send a test push: `npm:web-push` on the Supabase edge runtime has not
   been run here (if it fails on `crypto.createECDH`, switch to
   `jsr:@negrel/webpush`).
3. **Security pass**: once the read RPC is live, drop policy "Users can update
   message read status" (no client code UPDATEs `isexy.messages` now);
   restrict `missed_calls` INSERT to service_role (only the edge function
   inserts); enforce the chat unlock server-side (messages INSERT policy or
   trigger: premium, chat unlock or chat subscription) — today only the UI
   gates it; `matches` UPDATE policy still lets a member change any column of
   their match (e.g. `is_active`), the client no longer needs it.
4. **Group chats are never created**: nothing inserts `group_chats` /
   `group_chat_members` (no INSERT policies, no RPC); DoubleDate links to them.
   Next step: SECURITY DEFINER RPC creating the group when a double-date match
   forms (Double Date area).
5. **Images / voice messages**: not supported by the schema (messages has only
   `content`, no chat bucket). Needs a `isexy-chat-media` bucket with
   match-member RLS + `messages.attachment_url/attachment_type`, then UI.
6. **New-match notifications**: nothing sends push/email when a match forms
   (`new_match` email type exists for service-role callers only). Next step:
   DB webhook or `perform_like` caller (Discover area) invoking the functions.
7. Push categories other than messages/matches (super likes, top picks, swipe
   surge, boost expiring, likes frequency) are stored but nothing sends them.
8. Stale push endpoints (404/410) are kept (no-delete rule); owner may allow
   pruning them.
9. Brand: the global theme primary is still coral pink (`index.css` tokens);
   BRAND.md wants electric blue on navy. Global change, not done here.
10. `/matches-list` is linked from nowhere; consider redirecting it to
    `/matches` in App.tsx (shared file).
11. Likes badge counts all pending likes; a "seen" marker would make it "new
    since last visit".
12. `isexy-send-notification-email` throttles in memory (per instance); a DB
    timestamp per conversation would survive cold starts.
