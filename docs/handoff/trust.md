# Trust area: safety, moderation, support, staff tools, assistant, app shell (branch wf/trust)

Running notes so the work survives a stop. Branch `wf/trust` (local, not
pushed). History: started on b9f1815, then **PR #2's head 30caf62 was merged
in** (main's production work 0001-0012, our 0013/0014 and the merge-review
fixes) before finishing. Conflicts were only `WORKLOG.md` (both kept) and
`ContactUs.tsx` (trust's success panel + main's "confirmation only when the
function says so"). Then PR #2's head **092107f** (isexy.ca on Coolify: docs
and WORKLOG only) was merged (WORKLOG conflict, both kept), the tests were
run for real (the WIP commit c3a65d1 had written "pass" before running them)
and an adversarial pass closed 9 more hole classes ([below](#adversarial-review-2026-10-22)).

All SQL is in **`supabase/isexy-migrations/0015_trust_and_moderation.sql`**
(runs after 0014; not applied anywhere). `docs/handoff/trust.sql` is the
branch history only (marked FOLDED, do not apply). Tests:
`scripts/isexy/test/trust-smoke.sql` (253 checks, T1-T10, in the CI smoke loop;
T10 = the privacy follow-ups, [0015 K](#privacy-follow-ups-0015-k-wffollowups-2026-10-23))
and `e2e/trust-e2e.mjs` (97 checks, A-D).

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
| A | `is_staff()` (admin or moderator, **not suspended**), `is_admin()`, `staff_profile_ids()` (staff only); `staff_actions` audit table (admins read, only the staff RPCs write, through `log_staff_action`); staff read every profile (suspended ones too) and every report (reports about a staff account: admins only) | banned members vanished from staff lists; reports reached nobody |
| B | `reports.source/reviewed_by/reviewed_at/resolution_note`; profiles SELECT hides the profile of anyone who blocked you (`my_blocker_ids()`, once per statement) and always shows your own; `get_my_hidden_member_ids`, `block_member` (idempotent), `report_member` (reasons checked, no self-report, one pending report per pair, 20 a day); direct report inserts must be pending, unreviewed, not about yourself | defects 3-5, security.md "reporter can set status" |
| C | `user_warnings.lifted_at/lifted_by/lift_reason`; `active_restriction`, `get_my_moderation_status`, `record_contact_sharing` (24 h, 7 days, permanent; one strike at a time, advisory lock; strikes lifted as "mistake…" do not count) | defects 1-2 |
| D | `validate_message_allowed` (0001 body) also refuses restricted senders and suspended accounts; 0014 B3 grants restated | restriction and suspension were browser-only |
| E | staff RPCs (admin or moderator; a staff account only by an admin; never on yourself): `staff_issue_warning`, `staff_lift_restrictions`, `staff_set_shadow_ban`, `staff_set_account_active` (reason required to suspend), `staff_resolve_report` (same rules on the reported member), `staff_update_profile` (name/bio, reason required); admin only: `staff_list_roles`, `staff_grant_role` (no role removal from the app: no deletion) | defect 14; 0014 blocks direct writes of the protected profile columns and staff have no UPDATE policy on profiles/reports |
| F | `get_ticket_status(number, email)` (guests and members); `staff_update_ticket`, `staff_bulk_update_tickets` **admin only** (main's 0009 trigger lets only admins/service role change staff fields: a moderator RPC would fail inside it); assignees must be admins. Main's 0010 SELECT/UPDATE policies and 0009/0014 D2 triggers untouched (the branch notes' policy rewrites were dropped) | defects 6-7 |
| G | staff read the live chat queue and messages; `staff_accept_live_chat`, `staff_close_live_chat`, `staff_get_live_chat_transcript`, `end_my_live_chat`; 0014 D5's policies tightened **in place** (same names): sender is always the caller, members post "user" only in their own waiting/active chat, agents "agent" only in an active chat assigned to them, nobody posts "system" lines directly; direct session writes admins only; a member opens a chat only as "waiting", with no ticket and at most their own assistant chat | defects 8, 11, 17; T9 |
| H | `staff_dashboard_stats()`: staff home numbers in one call (members, queues; open tickets and revenue for admins) | the page loaded every profile row and summed tables admins could not read |
| I | admins read `credit_transactions`, `boost_transactions`, `gift_transactions`, `subscriptions`, `chat_subscriptions` (SELECT only) | payment pages counted only the admin's own purchases |
| J | adversarial review: direct warning writes admins only (J1); a reporter reads their report only while pending (J2); photos (signed-in only), Phone Line profiles and greetings hidden from the members their owner blocked (J3); 0013's `staff_set_profile_verified`, `review_photo_verification`, `review_voice_greeting` follow E's rules and write the audit log (J4); 0014's protected profile columns: direct writes by active admins only (J5) | [below](#adversarial-review-2026-10-22) |

Three `security-smoke.sql` expectations changed on purpose (0015 behaviour):
a suspended member now reads their own row (the filtered UPDATE then reaches
the trigger and is refused, instead of touching 0 rows); a member can no
longer post a "system" line in their own support chat; a moderator can no
longer write protected columns of their own profile (J5). One `trust-smoke`
T5 expectation changed: a moderator sees the 2 reports about members, not the
20 about themselves (admins see all 22, T9e).

## Adversarial review (2026-10-22)

Run as a malicious member and a malicious moderator against the final schema
(0001-0015) on a throwaway Postgres: `trust-smoke.sql` T9 (78 checks). Before
the fixes **33 of the first 77 failed** on the WIP 0015 (proof; the 78th, a
suspended moderator still posting in their open chat, was found while fixing);
after, all pass. Then the client: `trust-e2e.mjs` D1-D5 (10 checks).

| Hole (proven) | Fix | Check |
|---|---|---|
| A moderator wrote warnings directly: a permanent restriction on an admin (no rule, no audit), lifted their own restriction, rewrote evidence/issuer of others' warnings (0001 policies) | J1: direct warning writes admins only; moderators use the RPCs | T9d |
| A moderator read the reports about themselves (who reported them) and about other staff, and dismissed them through `staff_resolve_report` | A3 policy: reports about staff for admins only; `staff_resolve_report` runs `assert_staff_may_act_on(reported)` (nobody on themselves, staff targets admin only) | T9d, T9e, T5 |
| A moderator verified themselves, unverified an admin, approved their own photo check and their own voice greeting (0013 RPCs checked the role only) | J4: same rules as E + audit log | T9d |
| A moderator gave themselves Platinum / unlimited likes / the badge: 0014's trigger exempted staff, and staff can only update their own row | J5: exemption for active admins only | T9d, security-smoke A |
| An assigned moderator moved a live chat to another member (then wrote "agent" lines to them), reopened an ended chat, swapped the transcript staff read | G: direct session writes admins only | T9d |
| A member attached another member's assistant chat to their live chat (staff would read it as theirs), or opened a chat already "active" | G: own assistant chat only, "waiting", no ticket | T9b |
| A suspended moderator kept every staff tool (roles are never deleted from the app, so an admin had no way to stop one) | `is_staff()`/`is_admin()` require an active account; all staff RPCs, staff policies and the agent branch of the live chat message policy use them | T9e |
| A reporter read the outcome, the reviewer's id and the staff note of reviewed reports (others' moderation state) | J2: own reports readable while pending only (no page reads them) | T9b |
| A blocked member read the blocker's photos, Phone Line profile and greeting by profile id; anyone signed out listed every member's photos | J3 | T9a |

Checked and already closed (regression cases in T9): a blocked member cannot
delete or rewrite the block or file one in someone else's name; members get
`42501` from every staff RPC (19 listed) and `not_authorized` from
`review_voice_greeting`, no staff directory, no warnings/violations/audit
rows, no one else's assistant chat (members or guests); moderators cannot
grant roles (no self-promotion), list roles, bulk-update tickets, insert a
role row; ticket tracking takes no wildcards.

Client (React escapes text; `trust-e2e.mjs` D1-D4 seed `<img onerror>`,
`<script>`, `<svg onload>` and `onmouseover` payloads in a report, a blocked
chat attempt, the audit log and a ticket's name/subject/message: they render
as text on `/admin/moderation`, the audit log and `/support`, nothing runs,
no element is created). Ticket e-mails escape every field (both functions).
The assistant (`isexy-ai-chat`) checks conversation ownership (member id, or
the guest session id for guest rows), reads published KB articles only and
no member data; members/anon cannot read `chatbot_*` rows of others (T9b).
`AdminVerifications` (Cuba on hold, bug fix): the stored ID images are paths
in a private bucket, so the old links opened an app 404; they now open a
10-minute signed URL, and a member-supplied value with any other scheme
(`javascript:`) is never opened (D5; in current Chromium the old
`rel="noopener"` link ran such a value in a null-origin blank window, so this
is defence in depth rather than a proven exploit).

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
- [x] 0015 + tests, run on 2026-10-22 after merging 092107f: migrations from
      scratch (dry run, apply, main's 6 assertions, re-run "up to date", 15
      rows), production simulations 0001-0012 → 0013-0015 and 0001-0014 →
      0015, 0014 and 0015 re-run on themselves (C2 "already applied"); smoke
      0013 34, calls 101, rewards 95, security 135, live-functions-compat 54,
      trust 203, all PASS; typecheck clean; build OK; lint 98 errors, none new
      (116 on PR #2's head); every e2e (trust 79, rewards 95, calls 62 (one
      timing flake on the first run, passes on re-run), …); deno check of the
      27 functions + main's 14 Deno tests
- [x] adversarial pass (above): T9 78 checks, trust-e2e D1-D5
- [x] privacy follow-ups (0015 K, wf/followups, 2026-10-23; [above](#privacy-follow-ups-0015-k-wffollowups-2026-10-23)):
      T10 failed 27 of 50 without K, all pass with it; migrations from
      scratch (0001-0016: dry run, apply, re-run "up to date", guard silent,
      16 rows) and production simulation (0001-0012, then only 0013-0016
      pending); main's 6 assertions, smoke 0013 34, calls 101, rewards 95,
      security 135, live-functions-compat 54, trust 253, ads 33 in both;
      typecheck clean, build OK, lint 98 errors / 32 warnings (none new);
      deno check of the 27 functions + the 5 Deno test files (16 tests); every
      e2e: accounts 28/33/24/54/26, ads 106 + 26, calls 62, phone line pages
      53, Twilio 43, chat 38 + 20, discover 36, rewards 96, trust 97, smokes
      clean, no request the database would refuse. The same trust and rewards
      e2e on the previous client (0c3f5c0) stop at the first page: its
      `select("*")` profile read is refused

## Privacy follow-ups (0015 K, wf/followups, 2026-10-23)

The three privacy holes left open above, closed in a new part **K appended to
`0015_trust_and_moderation.sql`** (0015 is not applied anywhere, so the
deploy stays 4 migrations; 0013, 0014 and 0016 are byte-identical; 0016 needs
nothing from K and K needs nothing from 0016). Proven first:
`trust-smoke.sql` **T10** (50 checks) failed **27** on 0001-0016 without K
(log of that run in the commit message of `ca46c55`); all pass with K.

| Hole (proven) | Design chosen | Why this one | Checks |
|---|---|---|---|
| A ticket's owner read `support_tickets.admin_notes` (REST, realtime payload), filtered on it, and confirmed a guess with a no-op `UPDATE` (or `SET admin_notes = NULL`: "has staff written a note?") | **K1 column privileges**: `anon`/`authenticated` keep `SELECT` and `UPDATE` on every other column, not on `admin_notes`; admins read notes through **`staff_list_tickets(limit)`** (SECURITY DEFINER, `is_admin()`); `staff_update_ticket` still writes them | RLS cannot hide a column; column privileges also cover GraphQL and, as far as Supabase Realtime filters payload columns by the subscriber's privileges, realtime (to confirm after deploying, Left). No data moves and no row changes (moving the notes to a staff table would have meant clearing the old column). Only three client reads used `*` (Support Portal, Admin Tickets, Admin Dashboard): now the RPC or named columns. Members' Ticket Tracking already named its columns | T10 K1 (13), T3 (notes now read through the RPC); trust-e2e C2 |
| A signed-in member filed a ticket under someone else's e-mail (with or without their user id): it showed in the victim's list and the confirmation e-mail went to the victim | **K2 BEFORE INSERT guard** `isexy_support_tickets_sender_email_guard` (fires after 0014 D2's): a signed-in member's ticket uses their JWT e-mail (stored lower-case); a phone-only account (no e-mail claim) may not use an e-mail address (Delete Account files with the phone); admins and the service role may file for anyone. `isexy-send-ticket-confirmation` also sends only to the caller's own sign-in e-mail (`mayEmailTicketAddress`, covers older tickets) | Smallest rule matching the account's verified identity (main's 0010 already trusts the JWT e-mail). Contact Us shows the account e-mail read-only; Restore Purchase puts the other account's e-mail in the message | T10 K2 (9), security-smoke D2; Deno `ticket-confirmation-auth` (+2); trust-e2e A10; rewards-e2e restore |
| A guest read someone else's ticket with its number + e-mail (`get_ticket_status` returned subject, message and the staff reply): e.g. plant a ticket under a member's e-mail, wait for staff to answer it, read the answer; or read a member's ticket whose number leaked | **K2 `get_ticket_status`** (same signature): subject, message and reply only to the ticket's owner or someone signed in with its e-mail; anyone else with number + e-mail gets a **guest** ticket's status, category, priority and dates; a **member's** ticket (user id set) answers its owner only. Ticket Tracking shows "We replied by e-mail on …, sign in with that address to read it" | Guests cannot be verified, and guest confirmation e-mails stay staff-only (main's decision, `mayConfirmTicket`), so the e-mail inbox is the only proof: staff replies already go there (status-update function). Guest support keeps working: file, track the status, read the reply in the inbox or after signing in | T10 K2 (8), T3; trust-e2e A8, A11, A12 |
| Every member read `profiles.shadow_banned`, `_at`, `_reason` of anyone (their own status too) and could probe their own status with a no-op `UPDATE` (0014's trigger refused it or not) | **K3 column privileges**: `anon`/`authenticated` keep `SELECT` and `UPDATE` on every other profiles column; staff read bans through **`staff_get_shadow_bans(ids or NULL)`** (`is_staff()`); Discover, likes, badges, referrals (SECURITY DEFINER) and the Phone Line by phone (service role) keep filtering | No UI shows members their status (only the staff sheet and member search). Every member read path was checked: `useAuth` and Cuban signup read `MEMBER_PROFILE_COLUMNS` (`src/lib/profileStatus.ts`, equals the grants), Profile setup / Tourist signup return `id`, Admin Analytics names its columns, staff search and sheet use the RPC; no edge function reads profiles with a member token; the invoker triggers read only id/user_id/first_name/birth_date. The legacy Discover query (`.neq("shadow_banned")`) only runs without 0013 | T10 K3 (17), T6; trust-e2e B3; every e2e suite (privilege watch) |

Since K, `select *` on `profiles` and `support_tickets` is refused for
members (`42501`) and **a column added to either table later is not readable
or writable by members until granted** (`GRANT SELECT (col), UPDATE (col) ON
isexy.<table> TO anon, authenticated;`; T10 lists the hidden columns and fails
on any other). The e2e mocks now answer like the database: `accounts-mockdb`
(accounts, rewards, trust suites) refuses `*`, hidden columns and other-address
tickets, and `offline-browser.mjs` reports such requests from every suite as a
FAIL line.

Expected test changes: T3 (Ben's JWT carries his e-mail; notes read through
`staff_list_tickets`), T6 (ban fields through `staff_get_shadow_bans`),
security-smoke D2 (the member's JWT carries `a@sec.test`).

## Owner decisions taken here (easy to revert)

- Moderators answer live chats (accept through `staff_accept_live_chat`).
  Revert: make the RPC admin only.
- Tickets stay admin only (main's 0009). If moderators should answer
  tickets, main's 0009 trigger function must allow them first (owner call).
- Role removal is not in the app (no row deletion): remove a role in the
  database. In the app, an admin stops a staff member by suspending the
  account: a suspended account keeps its role row but loses every staff tool.
- Reports about a staff account are reviewed by admins only (moderators do
  not see them); a reporter does not see the outcome of a reviewed report.
- Direct writes of warnings, live chat sessions and protected profile columns
  are admin only (moderators go through the audited RPCs).

## Left

| What | Next step |
|---|---|
| Ticket e-mails now send from `ISEXY_RESEND_FROM` (default `notifications@isexy.ca`) | Owner: verify the domain in Resend before deploying the two ticket functions (with Resend's sandbox sender they only reached the account owner) |
| Account deletion is still a ticket; staff delete by hand | Owner process |
| Cuban ID review (on hold): admin only, direct writes under the existing admin policy | Untouched except the evidence links (bug fix, D5) |
| Knowledge base / categories admin pages delete rows (admin content tools) | Owner: keep, or switch to unpublish |
| Staff UI is English only | i18n pass (HANDOFF Left #26) |
| A blocked member can work out who blocked them (`get_my_hidden_member_ids` minus their own blocks; the same signal as 0014's `blocked_with_me` and as probing a profile id) | Accepted for now: pages filter people in the browser. A server-side filter in each list RPC would remove the need for the id list |
| ~~A ticket's owner can read its `admin_notes`~~ | Done: 0015 K1 (above) |
| ~~Anyone can file a ticket under someone else's e-mail~~ | Done for members (0015 K2). A **guest** can still send a ticket from any address (it cannot be checked): it shows, marked "Sent without signing in", in the list of the member who owns that e-mail, and its content and our reply open only to that member or in that inbox. Owner call: keep, or list only `user_id` tickets for members |
| ~~`shadow_banned` and `shadow_banned_reason` readable by every member~~ | Done: 0015 K3. The rest of the profile row stays readable by every member (`blocked_contacts`, coarse location, plan: security.md › Left) |
| Since 0015 K a new column of `profiles` or `support_tickets` is hidden from members until granted | Add `GRANT SELECT (col), UPDATE (col) ON isexy.<table> TO anon, authenticated;` in the migration that adds it (T10 fails otherwise) |
| Realtime column filtering (K1: a ticket's realtime payload without `admin_notes`) relies on Supabase Realtime honouring column privileges; the local Postgres has no Realtime | After deploying: update a ticket as an admin while its owner has Ticket Tracking open, and check the payload in the browser has no `admin_notes` |
| A shadow-banned member can still notice the ban from a second account (they are missing from Discover/Phone Line; their referral code reads as invalid) | Inherent to shadow bans; nothing on the member's own account reveals it |
| The status-update e-mail of a phone-only member's ticket has no address (the function answers 500, the Support Portal logs it) | Low: the reply is in their Ticket Tracking; skip the e-mail when the contact has no `@` |
| A suspended **admin** keeps the reads gated by `has_role(admin)` policies (payment ledgers, audit log, tickets); the 0015 staff RPCs refuse (`is_staff()`/`is_admin()`) | Only an admin can suspend an admin; switch those policies to `is_admin()` if the owner wants suspension to cut reads too |
| Members can add "assistant" lines to their own assistant chat (direct insert); staff read them in the handoff transcript | Low: only misleads staff about that member's own chat; a role check on `chatbot_messages` INSERT would close it |
| Cuban ID video/audio are stored as bucket paths, so they do not play in `AdminVerifications` (Cuba on hold) | Sign the two paths when a case is opened, as the ID images now are |
