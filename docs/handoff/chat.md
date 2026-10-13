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

(see git log on wf/chat; each entry below lists files and how it was verified)

## Left to do

(filled in as work progresses)
