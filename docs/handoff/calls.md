# Calls handoff (wf/calls)

Area: in-app WebRTC video and audio calls (VideoCall, useCallConnection,
IncomingCallNotification), the Phone Line (PhoneLine, PhoneLineSetup,
PhoneLineBrowse, PhoneLineInbox, PhoneLineCall), AdminCallTests and the Twilio
functions (isexy-twilio-inbound-phone-line, isexy-twilio-phone-line-menu,
isexy-twilio-call-status, isexy-get-voice-greeting-url,
isexy-get-voice-reply-url).

New SQL lives in `docs/handoff/calls.sql` (idempotent, never edits 0001-0003).
The client in this branch needs that SQL: deploy them together.

## Defects found (audit, before fixes)

Status: [ ] open, [x] fixed in this branch (see "Fixed" below for how it was verified).

### In-app calls (VideoCall, useCallConnection, IncomingCallNotification)

0. [ ] Every connected call is cut off at once with "Out of minutes":
   `deduct_call_minute` inserts `credit_transactions.type = 'spend'`, which
   the CHECK (purchase/video_call/bonus/refund) rejects, so the RPC errors and
   VideoCall ends the call. Same bug in `charge_call_session_minute` (Phone
   Line) and `unlock_conversation` (contact unlock with credits).
1. [ ] TURN is read from `VITE_TURN_URLS` only; the documented name for this
   run is `VITE_TURN_URL` (accept both). No `.env.example` entry.
2. [ ] ICE recovery: only the caller restarts, only on `failed`, only once;
   `disconnected` shows "Reconnecting" forever (no restart, no timeout, no
   message); the callee never asks for a restart; no give-up timer.
3. [ ] Camera/mic denied or missing: the call hangs up at once with a toast.
   No audio-only fallback when only the camera fails, no "allow access /
   retry" screen, and the other side keeps ringing.
4. [ ] Missing controls: speaker (audio output) and switch camera on mobile.
5. [ ] Ring timeout inserts nothing itself: it calls the missed-call edge
   function, which inserts `missed_calls` with the service role. Members can
   also INSERT `missed_calls` for anyone (known hole). Needs a SECURITY
   DEFINER RPC that only lets the caller record a missed call to the person
   they rang in an active match.
6. [ ] Billing is client-driven: the caller calls `deduct_call_minute` every
   60 s (not tied to a session, no server time gate, skipping it = free
   calls); the caller writes `duration_seconds` / `credits_used` / `status`
   straight into `video_call_sessions` (UPDATE policy lets either member
   change any column). Needs session RPCs: start, answer, decline, connected,
   charge (time-gated), end (server duration + settlement).
7. [ ] Signaling topic `call-<matchId>` is shared by every call of the match
   (a stale tab can inject offers); channel errors/timeouts are ignored (the
   call sits on "Ringing" forever if Realtime is unreachable).
8. [ ] Repeated "ready" from the callee makes the caller create a new offer
   each time (offer/answer mismatch risk).
9. [ ] Callee opened from a push notification never sees the ringing call
   (only realtime INSERTs are watched, nothing checks for a call that is
   already ringing).
10. [ ] Answering a call that already ended (caller hung up while the sheet
    was open) starts a dead call screen.
11. [ ] "Open chat" button during a call unmounts the call screen, which
    silently hangs up.
12. [ ] End states navigate away after 0.9 s with a toast; failures (no
    answer, declined, connection lost, no permission) need a clear screen
    with "Call again" / "Message".
13. [ ] Peer camera off / audio-only peer shows a black video; no indicator.
14. [ ] Remote audio `play()` rejection (autoplay policy) is swallowed: the
    call is silent with no way to start sound.
15. [ ] Closing the tab mid-call leaves the session `connected`; the peer
    waits for ICE to fail.
16. [ ] Brand: answer button green, hang-up `bg-red-500`, minutes pill amber;
    "No minutes" dialog Cancel does `navigate(-1)` (can leave the app).

### Phone Line

17. [ ] `start_phone_line_call_session` reads `profiles.age`, a column that
    does not exist: every "Call" on Browse voices fails at runtime.
18. [ ] Even when it worked, Phone Line calls were fake: the session is
    created `connected`, the receiver is never told, no audio flows, yet the
    caller is charged a phone minute per minute.
19. [ ] Twilio IVR: inbound and menu select `profiles.age` / `profiles.status`
    (do not exist) so every verified caller is treated as unknown.
20. [ ] TwiML: `&` in Gather/Redirect URLs is not XML-escaped (browse is a
    parse error), names are not escaped, browse ignores the digits (2 =
    repeat and 9 = main menu do nothing), the unused `repeatUrl`.
21. [ ] Greetings are recorded as WebM/Opus; Twilio `<Play>` cannot play WebM,
    so browse by phone plays nothing.
22. [ ] Twilio signature: checked against `req.url` (internal URL inside
    Supabase, not the public URL Twilio signed), non constant-time compare;
    menu builds its own URL from `req.url` origin.
23. [ ] Call status callback: `ringing` maps to `initiating`, late callbacks
    can move a finished call back to `connected`, `answered_at` is
    overwritten on every `in-progress`.
24. [ ] Inbound inserts a new `call_sessions` row on every webhook retry
    (no check by CallSid).
25. [ ] `link_my_phone_line_number` (AdminCallTests "Link & verify") uses a
    `verified_at` column and an `ON CONFLICT (profile_id)` target that do not
    exist, so it always fails; it is granted to every member (anyone can mark
    any number verified) and it DELETEs rows.
26. [ ] No way for a member to link their phone to the IVR (only the broken
    admin RPC).
27. [ ] PhoneLineSetup: a banned voice profile un-bans itself on "Save draft" /
    "Go live" (client writes `status`); owners can self-approve greetings
    (`moderation_status` is writable). Recorder: forced `audio/webm` label
    (Safari records mp4), no MediaRecorder support check, mic never released
    when leaving the page while recording, timer stops the recorder inside a
    state updater.
28. [ ] PhoneLineBrowse / PhoneLineInbox: playing audio keeps playing after
    leaving the page; reply recorder has the same recorder issues; no error
    state when loading fails.
29. [ ] PhoneLine hub: status labels for `pending` / `rejected` (not phone line
    statuses), `banned` missing; "Live" shown while the greeting is still
    pending review.
30. [ ] No moderation queue for voice greetings: greetings default to
    `pending` and nothing approves them, so Browse voices is always empty in
    production.
31. [ ] AdminCallTests shows only `call_sessions`; in-app calls
    (`video_call_sessions`) are invisible.

## Fixed

(each entry: files, how verified)

- SQL part 1 (`docs/handoff/calls.sql` §1-3): CHECK widened to accept
  `spend` (fixes #0 server side), `start_call`, `answer_call`,
  `decline_call`, `mark_call_connected`, `charge_call_minute` (server clock,
  first minute at connect then one per 60 s), `end_call` (server duration,
  settles unpaid minutes from the caller's balance), `record_missed_call`
  (caller only, ringing >= 15 s, active match, once per session; partial
  unique index on `missed_calls.call_session_id`). Verified: PGlite with the
  V1 mock + 0001-0003, file applied twice, 39 checks
  (`e2e/calls-sql-test.mjs`): lifecycle, time gate, settlement, outsiders,
  receiver/caller role checks, decline, missed, duplicate insert rejected,
  rate limit, blocked, anon has no EXECUTE.

## Verification

(commands and e2e results)

## Left to do

(exact next steps)
