# Trust area: safety, moderation, support, staff tools, assistant, app shell (branch wf/trust)

Running notes so the work survives a stop. Branch `wf/trust` (local, not
pushed). History: started on b9f1815, then **PR #2's head 30caf62 was merged
in** (main's production work 0001-0012, our 0013/0014 and the merge-review
fixes) before finishing. Conflicts were only `WORKLOG.md` (both kept) and
`ContactUs.tsx` (trust's success panel + main's "confirmation only when the
function says so").

All SQL is in **`supabase/isexy-migrations/0015_trust_and_moderation.sql`**
(runs after 0014; not applied anywhere). `docs/handoff/trust.sql` is the
branch history only (marked FOLDED, do not apply). Tests:
`scripts/isexy/test/trust-smoke.sql` (125 checks, in the CI smoke loop) and
`e2e/trust-e2e.mjs` (69 checks).

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

## SQL: 0015_trust_and_moderation.sql

Deduplicated against 0013/0014 and main's 0009/0010 (the file header lists
each part). Every function is SECURITY DEFINER with a pinned search_path,
REVOKE ALL FROM PUBLIC (and anon unless guests need it), explicit GRANTs;
every policy is written in the `(select auth.uid())` form, so 0014's C2
guard stays quiet (0014 re-run after 0015: "already applied"). No row is
deleted.

| Part | What | Why |
|---|---|---|
| A | `is_staff()`; `staff_actions` audit table (admins read, only the staff RPCs write, through `log_staff_action`); staff read every profile (suspended ones too) and every report | banned members vanished from staff lists; reports reached nobody |
| B | `reports.source/reviewed_by/reviewed_at/resolution_note`; profiles SELECT hides the profile of anyone who blocked you (`my_blocker_ids()`, once per statement) and always shows your own; `get_my_hidden_member_ids`, `block_member` (idempotent), `report_member` (reasons checked, no self-report, one pending report per pair, 20 a day); direct report inserts must be pending, unreviewed, not about yourself | defects 3-5, security.md "reporter can set status" |
| C | `user_warnings.lifted_at/lifted_by/lift_reason`; `active_restriction`, `get_my_moderation_status`, `record_contact_sharing` (24 h, 7 days, permanent; one strike at a time, advisory lock; strikes lifted as "mistake…" do not count) | defects 1-2 |
| D | `validate_message_allowed` (0001 body) also refuses restricted senders and suspended accounts; 0014 B3 grants restated | restriction and suspension were browser-only |
| E | staff RPCs (admin or moderator; a staff account only by an admin; never on yourself): `staff_issue_warning`, `staff_lift_restrictions`, `staff_set_shadow_ban`, `staff_set_account_active` (reason required to suspend), `staff_resolve_report`, `staff_update_profile` (name/bio, reason required); admin only: `staff_list_roles`, `staff_grant_role` (no role removal from the app: no deletion) | defect 14; 0014 blocks direct writes of the protected profile columns and staff have no UPDATE policy on profiles/reports |
| F | `get_ticket_status(number, email)` (guests and members); `staff_update_ticket`, `staff_bulk_update_tickets` **admin only** (main's 0009 trigger lets only admins/service role change staff fields: a moderator RPC would fail inside it); assignees must be admins. Main's 0010 SELECT/UPDATE policies and 0009/0014 D2 triggers untouched (the branch notes' policy rewrites were dropped) | defects 6-7 |
| G | staff read the live chat queue and messages; `staff_accept_live_chat`, `staff_close_live_chat`, `staff_get_live_chat_transcript`, `end_my_live_chat`; 0014 D5's message policy tightened **in place** (same name): sender is always the caller, members post "user" only in their own waiting/active chat, agents "agent" only in an active chat assigned to them, nobody posts "system" lines directly | defects 8, 11, 17 |
| H | `staff_dashboard_stats()`: staff home numbers in one call (members, queues; open tickets and revenue for admins) | the page loaded every profile row and summed tables admins could not read |
| I | admins read `credit_transactions`, `boost_transactions`, `gift_transactions`, `subscriptions`, `chat_subscriptions` (SELECT only) | payment pages counted only the admin's own purchases |

Two `security-smoke.sql` expectations changed on purpose (0015 behaviour):
a suspended member now reads their own row (the filtered UPDATE then reaches
the trigger and is refused, instead of touching 0 rows); a member can no
longer post a "system" line in their own support chat.

## Progress

- [x] defect list (above)
- [x] #1 + #2 contact-details guard (word boundaries) + server strikes (C, D)
- [x] #3 + #4 blocks and reports through RPCs, hidden both ways (Likes sent,
      group chat, chat links, web profile, forum posts/replies, Phone Line
      voice inbox); Block/Report behind sign-in
- [x] #5 + #14 + #15 staff: reports, warnings/restrictions, shadow ban,
      suspend/reinstate, verify, name/bio edits, all through RPCs
      (`src/lib/staff.ts`, `src/components/admin/*`); suspended members listed
- [x] #6 + #7 tickets: tracking by number + e-mail, staff RPCs (admin only),
      e-mails from `ISEXY_RESEND_FROM`; status e-mail function admin only
- [x] #8 assistant: members reach a person in the widget (live view, unread
      badge, end chat); guests get sign-in or a ticket; stream reads the last
      line without a newline
- [x] #9 EN/FR button shows EN/FR and has a name; #10 branded EN/FR 404
- [x] #11 + #12 + #13 moderators: `/admin`, `/admin/moderation`,
      `/admin/verifications`, `/admin/agent`, `/support`; photo verification
      queue; voice greeting queue on `/admin/moderation` (Voice tab)
- [x] #16 admin pages: role checks (`AdminRoute`; a moderator on an
      admin-only page lands on `/admin`), Support Portal tabs instead of
      dead links, saved replies, audit log, no member billing page;
      Settings shows "Staff tools" to staff
- [x] #17 live chat agent side (RPCs, names, transcript, phone layout)
- [x] 0015 + tests (from scratch, production simulations), typecheck, build,
      lint, e2e, deno check

## Owner decisions taken here (easy to revert)

- Moderators answer live chats (accept through `staff_accept_live_chat`).
  Revert: make the RPC admin only.
- Tickets stay admin only (main's 0009). If moderators should answer
  tickets, main's 0009 trigger function must allow them first (owner call).
- Role removal is not in the app (no row deletion): remove a role in the
  database.

## Left

| What | Next step |
|---|---|
| Ticket e-mails now send from `ISEXY_RESEND_FROM` (default `notifications@isexy.ca`) | Owner: verify the domain in Resend before deploying the two ticket functions (with Resend's sandbox sender they only reached the account owner) |
| Account deletion is still a ticket; staff delete by hand | Owner process |
| Cuban ID review (on hold): admin only, direct writes under the existing admin policy | Untouched (Cuba on hold) |
| Knowledge base / categories admin pages delete rows (admin content tools) | Owner: keep, or switch to unpublish |
| Staff UI is English only | i18n pass (HANDOFF Left #26) |
| A blocked member can work out who blocked them (`get_my_hidden_member_ids` minus their own blocks; the same signal as 0014's `blocked_with_me` and as probing a profile id) | Accepted for now: pages filter people in the browser. A server-side filter in each list RPC would remove the need for the id list |
