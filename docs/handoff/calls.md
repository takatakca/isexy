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

0. [x] Every connected call is cut off at once with "Out of minutes":
   `deduct_call_minute` inserts `credit_transactions.type = 'spend'`, which
   the CHECK (purchase/video_call/bonus/refund) rejects. Same bug in
   `charge_call_session_minute` (Phone Line) and `unlock_conversation`.
1. [x] TURN is read from `VITE_TURN_URLS` only; the documented name for this
   run is `VITE_TURN_URL` (accept both); no STUN override; not documented.
2. [x] ICE recovery: only the caller restarts, only on `failed`, only once;
   `disconnected` shows "Reconnecting" forever; no give-up timer.
3. [x] Camera/mic denied or missing: the call hangs up at once with a toast;
   no audio-only fallback when only the camera fails; the other side keeps
   ringing.
4. [x] Missing controls: speaker (sound on/off) and switch camera on phones.
5. [x] Ring timeout: missed call inserted by the edge function with the
   service role; members can INSERT `missed_calls` for anyone (known hole).
   Needs RPC `record_missed_call` (caller only, active match, once per call).
6. [x] Billing is client-driven (`deduct_call_minute` every 60 s from the
   caller, not tied to a session; skipping it = free calls; caller writes
   duration/credits/status into `video_call_sessions`). Needs session RPCs.
7. [x] Signaling topic `call-<matchId>` shared by every call of the match;
   channel errors/timeouts ignored (sits on "Ringing" forever).
8. [x] Repeated "ready" makes the caller create a new offer each time.
9. [x] Callee opened from a push never sees the already ringing call.
10. [x] Answering a call that already ended starts a dead call screen.
11. [x] "Open chat" during a call unmounts the screen and silently hangs up.
12. [x] End states navigate away after 0.9 s with a toast; failures need a
    clear screen with "Call again" / "Message".
13. [x] Peer camera off / audio-only peer shows black video, no indicator.
14. [x] Remote audio `play()` rejection (autoplay) swallowed: silent call.
15. [x] Closing the tab mid-call leaves the session `connected`.
16. [x] Brand: green answer button, `bg-red-500`, amber minutes pill; "No
    minutes" Cancel does `navigate(-1)` (can leave the app).
32. [x] WIP review: the hook's unmount effect depends on `send` (my id), so
    a change of `myId` mid-call would run the cleanup and kill the call.
33. [x] WIP review: the caller only starts the connect timeout when the
    callee's "ready" arrives; if the callee answered (row `connecting`) but
    its signaling never arrives, the caller sits on "Connecting…" forever.
34. [x] WIP review: `e2e/calls-e2e.mjs` written but never run to the end;
    `e2e/smoke-call.mjs` still drives the removed direct-table flow.
35. [x] Docs/CI: DEPLOYMENT.md, V1-MIGRATION.md, HANDOFF.md and the CI build
    only know `VITE_TURN_URLS`.

### Phone Line

17. [x] `start_phone_line_call_session` reads `profiles.age` (no such
    column): every "Call" on Browse voices fails at runtime.
18. [x] Phone Line calls are fake: the session starts `connected`, the
    receiver is never told, no audio flows, the caller pays per minute.
    SQL part (ring, answer, decline, connected, settle) is in calls.sql but
    the answered/connected states are not separated (the caller could start
    billing before anyone answers); client (PhoneLineCall + ringing for the
    receiver) not done.
19. [x] Twilio IVR: inbound and menu select `profiles.age` / `profiles.status`
    (do not exist): every verified caller is treated as unknown.
20. [x] TwiML: `&` in Gather/Redirect URLs not XML-escaped (browse is a parse
    error), names not escaped, browse ignores the digits (2 = repeat, 9 =
    main menu do nothing).
21. [~] Greetings recorded as WebM/Opus (Safari: MP4) and labelled
    `audio/webm`: Twilio `<Play>` plays neither, so browse by phone is silent;
    older Safari cannot play WebM in the app either.
22. [x] Twilio signature checked against `req.url` (the internal URL, not
    the public URL Twilio signed) with a non constant-time compare; the menu
    builds its own URL from `req.url`.
23. [x] Status callback: `ringing` maps to `initiating`, late callbacks move a
    finished call back to `connected`, `answered_at` overwritten on every
    `in-progress`; inbound session stamped `answered_at` at once.
24. [x] Inbound inserts a new `call_sessions` row on every webhook retry.
25. [x] `link_my_phone_line_number` (AdminCallTests) uses a `verified_at`
    column and an `ON CONFLICT (profile_id)` target that do not exist, so it
    always fails; it is granted to every member (anyone could mark any number
    verified) and it DELETEs rows.
26. [~] No way for a member to link their phone to the IVR.
27. [~] PhoneLineSetup: a banned voice profile un-bans itself on "Save
    draft" (client writes `status`); owners can self-approve greetings and
    voice replies (`moderation_status` writable). Recorder: forced
    `audio/webm`, no MediaRecorder check, mic not released when leaving the
    page, timer stops the recorder inside a state updater.
28. [~] PhoneLineBrowse / PhoneLineInbox: audio keeps playing after leaving
    the page; reply recorder has the same issues; no error state.
29. [~] PhoneLine hub: labels for `pending` / `rejected` (not phone line
    statuses), `banned` missing; "Live" while the greeting is pending.
30. [x] No moderation queue for voice greetings: greetings default to
    `pending` and nothing approves them, so Browse voices stays empty.
31. [~] AdminCallTests shows only `call_sessions`; in-app calls
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

- In-app calls rewritten on the session RPCs (#1-#16, #32-#34):
  `src/hooks/useCallConnection.ts` (per-call topic `call-<sessionId>`,
  signaling steps applied one at a time, ICE restart after a 2.5 s grace on
  `disconnected` or at once on `failed`, retried every 5 s, give-up after
  25 s with "Connection lost", connect timeout 30 s also when the server says
  answered but no signaling arrives, peer mute/camera state, switch camera
  with `replaceTrack`, every track stopped on hang-up, hang-up sent on
  `pagehide`), `src/pages/VideoCall.tsx` (microphone first, camera failure =
  audio-only banner, clear blocked/missing/busy screens with Try again,
  start/answer/decline/connected/charge/end RPCs, ring timeout 35 s ->
  `record_missed_call`, end screens with Call again / Message / Buy minutes,
  speaker on/off, "Tap to hear" when autoplay is blocked),
  `src/components/IncomingCallNotification.tsx` (catch-up query for a call
  already ringing, busy while in a call, decline RPC, brand tokens),
  `src/lib/iceServers.ts` (STUN default, `VITE_STUN_URL`, TURN from
  `VITE_TURN_URL` or `VITE_TURN_URLS` + `VITE_TURN_USERNAME` /
  `VITE_TURN_CREDENTIAL`, `VITE_TURN_RELAY_ONLY`), `src/lib/callMedia.ts`,
  `src/lib/callSessions.ts`. Verified: `e2e/calls-e2e.mjs` 44/44 PASS (two
  Chromium contexts, real WebRTC with fake devices, mocked RPCs/Realtime),
  screenshots at 390x844. `e2e/smoke-call.mjs` removed (it drove the old
  direct-table flow; calls-e2e covers everything it did).

- SQL (`docs/handoff/calls.sql`, 6 sections, header lists them) for #0, #5,
  #6, #17, the server half of #18, #23, #24, #25, #27 (moderation state) and
  #30 (staff review RPCs): `credit_transactions` CHECK accepts `spend`;
  in-app session RPCs and `record_missed_call` (+ unique index on
  `missed_calls.call_session_id`); member INSERT/UPDATE policies on
  `video_call_sessions` dropped (RPCs only); Phone Line ring -> answer
  (connected, not billed) -> media connected (billed) -> end with
  settlement; `charge_call_session_minute` in-app only; `call_sessions` on
  Realtime; one Twilio session per CallSid (unique index);
  `apply_twilio_call_status` (service role, statuses only move forward,
  `answered_at` kept); members cannot mark phone numbers verified;
  `link_my_verified_phone` (SMS-confirmed sign-in number);
  `link_my_phone_line_number` admin-only, real columns, no DELETE;
  greetings / voice replies always start `pending`, owners cannot change
  moderation fields, new audio goes back to review, banned voice profiles
  stay banned and cannot be deleted, voice profile age from the birth date;
  `get_voice_greetings_for_review` / `review_voice_greeting` (admin or
  moderator); admins read `video_call_sessions`.
  Verified on a throwaway Postgres 16 exactly like the CI `migrations` job:
  `v1-mock.sql`, `migrate.sh` dry run / `--apply` / re-run "up to date"
  (0001-0004), then calls.sql as a 0005 through `migrate.sh` (dry run,
  apply, re-run; V1 guard silent), calls.sql applied a third time
  (idempotent), `0004-smoke.sql` 34/34 PASS, new
  `scripts/isexy/test/calls-smoke.sql` 98/98 PASS (allowed and forbidden
  call for every RPC, policy and trigger). The PGlite scripts
  (`e2e/calls-sql-*.mjs`) are replaced by calls-smoke.sql.

- Phone Line calls (#18, client): `src/pages/PhoneLineCall.tsx` rewritten
  (both sides: `/phone-line/call/new?to=<profileId>` for the caller,
  `/phone-line/call/<sessionId>?answer=1` for the receiver; microphone
  first, nothing rings without it; ring 35 s -> missed; billing only after
  `mark_call_session_connected`; end screens with Buy minutes / Call again /
  Leave a voice reply), `PhoneLineBrowse` "Call" opens it,
  `IncomingCallNotification` rings Phone Line calls too (Realtime on
  `call_sessions` + catch-up, decline RPC, name only: voice first),
  `useCallConnection({ privateRelay })` sends Phone Line media through TURN
  when configured (strangers never learn each other's IP). Verified:
  `e2e/calls-e2e.mjs` sections 8-9 (17 checks: ring, answer, audio both
  ways, billing after media only, mute, hang up, decline, no minutes, mic
  blocked, every track stopped).

- Twilio webhooks (#19, #20, #22, function half of #23/#24):
  `supabase/functions/_shared/twilio.ts` (signature = HMAC-SHA1 over the
  public URL `ISEXY_TWILIO_WEBHOOK_BASE` or `${SUPABASE_URL}/functions/v1`
  + the request's query string + sorted POST params, constant-time compare,
  `AccountSid` must match `TWILIO_ACCOUNT_SID` when set; `xmlEscape` on every
  name, headline and URL; caller = verified `phone_line_numbers` row + active
  profile 18+ from `birth_date`), `isexy-twilio-inbound-phone-line` (unknown
  callers logged hashed + masked, one `call_sessions` row per CallSid),
  `isexy-twilio-phone-line-menu` (absolute escaped Gather/Redirect URLs,
  menu 1-5/9, silence repeats then hangs up after 3 rounds, browse keys
  1 next / 2 again / 3 reply in the app / 9 menu, blocked and shadow-banned
  voices left out, only WAV/MP3 greetings are `<Play>`ed from a signed URL,
  others are introduced by name + headline), `isexy-twilio-call-status`
  (`apply_twilio_call_status`, 500 on a database error so Twilio retries).
  Verified: `e2e/calls-twilio-test.mjs` 43/43 PASS (Node, in-memory
  Supabase, Twilio's documented signature test vector).

- Docs/CI (#35): `docs/DEPLOYMENT.md` › Variables (`VITE_TURN_URL`,
  `VITE_TURN_USERNAME`, `VITE_STUN_URL`, `VITE_TURN_RELAY_ONLY`, why TURN
  matters), CI build passes the new names, `V1-MIGRATION.md` 3.6 (Twilio
  webhook URLs, `ISEXY_TWILIO_WEBHOOK_BASE`) and 3.9, `HANDOFF.md`.
  `TWILIO_WEBHOOK_BASE` is ISEXY-only in `_shared/env.ts` (a V1 value of
  that name would break every signature check).

## Verification

(commands and e2e results)

## Left to do

(exact next steps)
