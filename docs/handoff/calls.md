# Calls handoff (wf/calls)

Area: in-app WebRTC video and audio calls (VideoCall, useCallConnection,
IncomingCallNotification, lib/iceServers, lib/callMedia, lib/callSessions),
the Phone Line (PhoneLine, PhoneLineSetup, PhoneLineBrowse, PhoneLineInbox,
PhoneLineCall), AdminCallTests and the Twilio functions
(isexy-twilio-inbound-phone-line, isexy-twilio-phone-line-menu,
isexy-twilio-call-status, isexy-get-voice-greeting-url,
isexy-get-voice-reply-url).

New SQL lives in `docs/handoff/calls.sql` (idempotent, never edits 0001-0004;
the integrator appends it to `0004_app_completion.sql` or the next migration).
The client in this branch needs that SQL: deploy them together.

Branch history: 4 commits on df87113 (audit, SQL part 1, WIP client rewrite,
WIP stopped at the usage limit), then `git merge claude/zealous-brown-kv2hmx`
(discover + accounts + chat; only WORKLOG.md conflicted). Chat owns the
missed-call banner and the missed-call / incoming-call notification functions.

## Defects (audit, refreshed after the merge)

Status: [ ] open · [~] code written, not verified yet · [x] fixed and verified
(see "Fixed" for how).

### In-app calls (VideoCall, useCallConnection, IncomingCallNotification)

0. [~] Every connected call is cut off at once with "Out of minutes":
   `deduct_call_minute` inserts `credit_transactions.type = 'spend'`, which
   the CHECK (purchase/video_call/bonus/refund) rejects. Same bug in
   `charge_call_session_minute` (Phone Line) and `unlock_conversation`.
1. [~] TURN is read from `VITE_TURN_URLS` only; the documented name for this
   run is `VITE_TURN_URL` (accept both); no STUN override; not documented.
2. [~] ICE recovery: only the caller restarts, only on `failed`, only once;
   `disconnected` shows "Reconnecting" forever; no give-up timer.
3. [~] Camera/mic denied or missing: the call hangs up at once with a toast;
   no audio-only fallback when only the camera fails; the other side keeps
   ringing.
4. [~] Missing controls: speaker (sound on/off) and switch camera on phones.
5. [~] Ring timeout: missed call inserted by the edge function with the
   service role; members can INSERT `missed_calls` for anyone (known hole).
   Needs RPC `record_missed_call` (caller only, active match, once per call).
6. [~] Billing is client-driven (`deduct_call_minute` every 60 s from the
   caller, not tied to a session; skipping it = free calls; caller writes
   duration/credits/status into `video_call_sessions`). Needs session RPCs.
7. [~] Signaling topic `call-<matchId>` shared by every call of the match;
   channel errors/timeouts ignored (sits on "Ringing" forever).
8. [~] Repeated "ready" makes the caller create a new offer each time.
9. [~] Callee opened from a push never sees the already ringing call.
10. [~] Answering a call that already ended starts a dead call screen.
11. [~] "Open chat" during a call unmounts the screen and silently hangs up.
12. [~] End states navigate away after 0.9 s with a toast; failures need a
    clear screen with "Call again" / "Message".
13. [~] Peer camera off / audio-only peer shows black video, no indicator.
14. [~] Remote audio `play()` rejection (autoplay) swallowed: silent call.
15. [~] Closing the tab mid-call leaves the session `connected`.
16. [~] Brand: green answer button, `bg-red-500`, amber minutes pill; "No
    minutes" Cancel does `navigate(-1)` (can leave the app).
32. [ ] WIP review: the hook's unmount effect depends on `send` (my id), so
    a change of `myId` mid-call would run the cleanup and kill the call.
33. [ ] WIP review: the caller only starts the connect timeout when the
    callee's "ready" arrives; if the callee answered (row `connecting`) but
    its signaling never arrives, the caller sits on "Connecting…" forever.
34. [ ] WIP review: `e2e/calls-e2e.mjs` written but never run to the end;
    `e2e/smoke-call.mjs` still drives the removed direct-table flow.
35. [ ] Docs/CI: DEPLOYMENT.md, V1-MIGRATION.md, HANDOFF.md and the CI build
    only know `VITE_TURN_URLS`.

### Phone Line

17. [~] `start_phone_line_call_session` reads `profiles.age` (no such
    column): every "Call" on Browse voices fails at runtime.
18. [ ] Phone Line calls are fake: the session starts `connected`, the
    receiver is never told, no audio flows, the caller pays per minute.
    SQL part (ring, answer, decline, connected, settle) is in calls.sql but
    the answered/connected states are not separated (the caller could start
    billing before anyone answers); client (PhoneLineCall + ringing for the
    receiver) not done.
19. [ ] Twilio IVR: inbound and menu select `profiles.age` / `profiles.status`
    (do not exist): every verified caller is treated as unknown.
20. [ ] TwiML: `&` in Gather/Redirect URLs not XML-escaped (browse is a parse
    error), names not escaped, browse ignores the digits (2 = repeat, 9 =
    main menu do nothing).
21. [ ] Greetings recorded as WebM/Opus (Safari: MP4) and labelled
    `audio/webm`: Twilio `<Play>` plays neither, so browse by phone is silent;
    older Safari cannot play WebM in the app either.
22. [ ] Twilio signature checked against `req.url` (the internal URL, not
    the public URL Twilio signed) with a non constant-time compare; the menu
    builds its own URL from `req.url`.
23. [ ] Status callback: `ringing` maps to `initiating`, late callbacks move a
    finished call back to `connected`, `answered_at` overwritten on every
    `in-progress`; inbound session stamped `answered_at` at once.
24. [ ] Inbound inserts a new `call_sessions` row on every webhook retry.
25. [ ] `link_my_phone_line_number` (AdminCallTests) uses a `verified_at`
    column and an `ON CONFLICT (profile_id)` target that do not exist, so it
    always fails; it is granted to every member (anyone could mark any number
    verified) and it DELETEs rows.
26. [ ] No way for a member to link their phone to the IVR.
27. [ ] PhoneLineSetup: a banned voice profile un-bans itself on "Save
    draft" (client writes `status`); owners can self-approve greetings and
    voice replies (`moderation_status` writable). Recorder: forced
    `audio/webm`, no MediaRecorder check, mic not released when leaving the
    page, timer stops the recorder inside a state updater.
28. [ ] PhoneLineBrowse / PhoneLineInbox: audio keeps playing after leaving
    the page; reply recorder has the same issues; no error state.
29. [ ] PhoneLine hub: labels for `pending` / `rejected` (not phone line
    statuses), `banned` missing; "Live" while the greeting is pending.
30. [ ] No moderation queue for voice greetings: greetings default to
    `pending` and nothing approves them, so Browse voices stays empty.
31. [ ] AdminCallTests shows only `call_sessions`; in-app calls
    (`video_call_sessions`) are invisible.

### Found outside this area (cross-area notes, not changed here)

- `user_credits` policy "Users can update own credits" lets a member set
  their own `video_minutes` / `phone_minutes` (not in the known-holes list).
  Security pass: drop it (every balance change goes through RPCs).
- `isexy-send-missed-call-notification` (chat) emails/pushes "missed call"
  for any match member without a missed call on the server. Once
  `record_missed_call` is live it should require a `video_call_sessions`
  row `status = 'missed'`, caller = the signed-in member, younger than 5 min.

## Fixed

(each entry: files, how verified)

- SQL part 1 (`docs/handoff/calls.sql` §1-3), PGlite only so far: CHECK
  widened to accept `spend`; `start_call`, `answer_call`, `decline_call`,
  `mark_call_connected`, `charge_call_minute`, `end_call`,
  `record_missed_call`. To be re-verified on Postgres 16 (CI style).

## Verification

(commands and e2e results)

## Left to do

(exact next steps)
