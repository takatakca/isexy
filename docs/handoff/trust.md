# Trust area: safety, moderation, support, staff tools, assistant, app shell (branch wf/trust)

Running notes so the work survives a stop. Base: b9f1815 (the pushed
`claude/zealous-brown-kv2hmx` head: discover, accounts, chat, calls, rewards).
New SQL goes into `docs/handoff/trust.sql` (not a migration file); it was
tested on a throwaway Postgres 16 with 0001-0004 applied
(`/var/tmp/isexy-trust-pg`, port 55520: the postgres user cannot enter the
scratchpad).

## Defect list (found by reading every page/function in the area and the
## 0001-0004 schema on the local copy), most member-visible first

### Members

1. **Chat refuses ordinary messages.** `useContentModeration` flags "personal
   information" with patterns that have no word boundaries: `wa`, `ig`, `x`,
   `snap`... match inside "want", "tonight", "next", "was"; any two numbers
   ("2024 2025") count as a phone number. The message is not sent and the
   member is told a 24-hour restriction was applied.
2. **The contact-sharing restriction is fake.** The hook inserts
   `user_warnings` (staff-only INSERT policy: silently refused) after reading
   the member's own warnings (staff-only SELECT: always 0), so the "24 h / 7 d /
   permanent" steps never happen and `checkUserBanStatus` never sees a ban.
   Nothing on the server refuses a message from a restricted member.
3. **Blocked members still show up**: Likes > Sent lists people who blocked you
   or whom you blocked; a web profile link opens the profile of someone who
   blocked you; group chat shows a blocked member's messages; a direct chat
   link to someone who blocked you opens the chat (sending fails with a vague
   error). Any member can read the profile row of someone who blocked them.
   (Discover, Top Picks, Matches/Messages inbox, Likes received, badges and calls
   already filter blocks both ways on the server.)
4. **Block/Report flow**: `/block-report/:id` is not behind sign-in (signed out
   = buttons silently do nothing); blocking someone already blocked shows
   "Failed to block user"; a report that also blocks ignores the block result;
   the match stays active after a block (the chat still opens for the blocker
   until the inbox refreshes); nothing stops reporting yourself or flooding
   reports.
5. **Reports reach nobody**: `isexy.reports` has no staff SELECT/UPDATE policy,
   so every staff screen lists 0 reports and "Resolve"/"Dismiss" do nothing.
6. **Support tickets cannot be tracked by guests**: `/ticket-tracking` searches
   `support_tickets` directly; RLS shows only the signed-in member's own
   tickets, so a guest (or a member who used another email) always gets
   "Ticket not found". Members can also UPDATE any column of their own
   ticket (status, response, admin notes, assignee).
7. **Ticket emails never reach members**: both ticket functions send from
   `onboarding@resend.dev` (Resend's sandbox sender, only delivers to the
   Resend account owner) instead of `ISEXY_RESEND_FROM`. The status-update
   function trusts the browser for the address and wording; replying from the
   Support Portal sends no email at all.
8. **"Talk to a human" leads nowhere**: the assistant queues a live chat
   session but the widget never shows the agent's replies (no live chat view);
   a guest's session has no owner, so no agent reply can ever reach them; the
   "queued" text promises a reply "here".
9. **EN/FR switch**: English and French both show the 🇨🇦 flag, so the header
   button cannot tell which language is on; the button has no accessible name.
10. **404 page**: plain unbranded page, full page reload on "Return to Home",
   English only.

### Staff (admin / moderator)

11. **Moderators are locked out of their own tools**: `/admin/moderation` and
    `/admin/verifications` are admin-only routes; tickets are admin-only in RLS
    (Support Portal and Agent Dashboard show moderators no tickets); live chat
    sessions waiting in the queue are invisible to moderators (policy: admin or
    the assigned agent) and they cannot accept one.
12. **Photo verification requests wait forever**: no staff screen lists
    `photo_verifications` (`review_photo_verification` exists in 0004).
13. **Voice greetings**: the review queue only exists on the admin-only
    `/admin/call-tests`; moderators (allowed by the RPCs) cannot reach it.
14. **Every staff action is a client write that RLS refuses or the Security
    stage will block**: ban/unban (`profiles.is_active`: no staff UPDATE
    policy on profiles, the toast says "User banned" while nothing changed),
    report resolve/dismiss (no policy), issue ban (`warning_type =
    'manual_ban'` violates the CHECK, always fails), unban (updates every
    warning of the member), ticket status/response/assignee and bulk updates,
    role grant/revoke (`user_roles` has no staff INSERT/DELETE policy), live
    chat accept/close, Cuban ID review (on hold: bug fix only). No shadow-ban
    control exists although Discover honours `shadow_banned`.
15. **Staff cannot see banned members**: the profiles SELECT policy is
    `is_active = true`, so a banned member disappears from every staff list
    (and from report/warning joins).
16. **Admin pages**: `/admin` checks roles with `.single()` (a member with
    both admin and moderator is sent away); internal role checks duplicate
    `AdminRoute` and send moderators to /settings or /; `/support` is not
    behind `AdminRoute`; Support Portal sidebar items Bans & Appeals, Saved
    Replies, Audit Log, Settings are dead `#` links; "Users" and "Admin" send
    moderators to admin-only pages; "Payments" opens the member billing page.
17. **Live chat (agent side)**: agents can post as the member and members can
    post as "agent"/"system" in their own session (insert policy checks only
    the session).

## SQL (docs/handoff/trust.sql)

Parts (all SECURITY DEFINER with `SET search_path = isexy, extensions`,
REVOKE ALL FROM PUBLIC/anon, GRANT to authenticated; every staff RPC checks
`has_role` admin or moderator, admin-only where noted):

- T1 moderation: `user_warnings.lifted_at/lifted_by/lift_reason`,
  `is_staff()`, `active_restriction(profile)` (internal),
  `get_my_moderation_status()`, `record_contact_sharing(types, excerpt, match)`
  (strikes 24 h / 7 days / permanent, no new strike while restricted),
  `validate_message_allowed` refuses a restricted sender.
- T2 blocks and reports: `reports.source`; profiles SELECT policy hides the
  profile of anyone who blocked the caller (`my_blocker_ids()`, evaluated once
  per statement) and a new "Members view own profile" policy (a suspended
  member keeps their own row); `get_my_hidden_member_ids()`,
  `block_member(id)` (idempotent), `report_member(id, reason, details, block,
  source)` (reasons checked, no self-report, one pending report per pair, 20 a
  day).

## Progress

- [x] defect list (this file)
- [x] #1 + #2 chat contact-details guard: word-boundary patterns
      (`src/hooks/useContentModeration.ts`; 30 sample sentences: no false positive,
      no miss), strikes and restriction on the server (T1), Chat shows the server's
      status and refuses on "restricted"; trust-smoke T1 13/13
- [x] #3 + #4 blocks and reports: `src/lib/blocks.ts` (RPCs, old table writes as
      fallback), Block/Report page behind sign-in, idempotent block, name in the
      header, honest copy, back to the inbox after blocking from a chat; hidden
      either way in Likes > Sent, group chat messages, chat links (Chat uses the
      hidden ids), web profile (RLS); suspended members see a "suspended" screen
      instead of profile setup; trust-smoke T2 20/20
