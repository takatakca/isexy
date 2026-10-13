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

## Left to do

(filled in as work progresses)
