# Accounts, profile and forms (branch wf/accounts)

Running notes so the work survives a stop. Newest state at the top of each list.

## SQL this branch needs

`docs/handoff/accounts.sql` (idempotent, tested on a local Postgres 16 with
`scripts/isexy/test/v1-mock.sql` + migrations 0001-0003, applied twice):

1. `isexy.user_preferences.settings jsonb` (object, max 64 KB). Private
   member settings used by `src/hooks/useMemberSettings.ts`. Until it exists the
   pages keep working and say "Saved on this device only".
2. `isexy.photo_verifications` + private bucket `isexy-photo-verifications` +
   `isexy.review_photo_verification(id, approve, reason)` (staff only, sets
   `profiles.is_verified` on approval). RLS tested: members file one pending
   request for themselves only, cannot approve, cannot read others; storage
   folder = auth uid; staff (admin/moderator) read everything.
3. `isexy.get_discover_feed` replaced (same signature/columns/ranking) so the
   Settings choices take effect: Enable Discovery off / Incognito hide a member
   from other decks except people they already liked; the caller's Minimum
   photos, Has a bio and Recently Active apply to their own deck; Block
   Contacts keeps two people out of each other's deck when either listed the
   other's sign-in email/phone (auth.users read inside the function only).
   Tested locally (feed F1-F7, contacts B0-B5). If another branch replaces this
   function too, merge both sets of conditions.

## Done

- Reviewed WIP ad684b4. Kept: profile completeness helper (`src/lib/profileStatus.ts`),
  `goBack` helper, auth loading fix (returning members never bounce to
  /profile-setup), ProfileSetup seeding + photo sync, Settings persistence,
  Email/Push/Active status/Block contacts persistence, photo verification
  request flow, deletion request ticket, push subscription saved to
  `isexy.push_subscriptions`.
- Dropped from the WIP (owned by wf/discover, which rewrote them): `WebProfile.tsx`,
  `DiscoverFilters.tsx`, the `get_web_profile` RPC and the web-profile toggle.
  `/web-profile` and `/photo-verification` routes left as on main to avoid a
  conflict with wf/discover's App.tsx line; PhotoVerification guards itself.
- Also handed back to wf/chat, which built email + push notification settings
  end to end (user_preferences.notification_settings, honoured by
  isexy-send-notification-email and isexy-send-push-notification, commits
  b6203e4 and d85c047): `usePushNotifications.ts`, `PushNotificationPrompt.tsx`,
  `EmailSettings.tsx`, `PushNotifications.tsx` and the email function are as on
  main here, so wf/chat's versions merge without conflict.

- Auth: a failed profile read no longer sends a returning member to
  /profile-setup (retry screen in ProtectedRoute); profile, photo count and the
  error flag update together (no flash redirect after refreshProfile).
- Sign-in: "Send a new code" comes back by itself after 60 s (countdown).
- Passport: cities were disabled for free members (dead buttons); they now lead
  to /premium. Canada section first (Montréal, Toronto, Vancouver, Québec City,
  + Ottawa, Calgary, Edmonton, Winnipeg, Halifax in search); accent-insensitive
  search; back button falls back to /settings. Cuba section unchanged (on hold).
- Settings: Recently Active and Incognito (Plus™) lead free members to /premium;
  honest Enable Discovery copy; Web Profile card says "Share a link" (no username exists).
- Returning members: "/" (and the installed app's start URL) sends a signed-in
  member to Discover (setup if incomplete). Back buttons on pages opened
  directly (AuthLayout, /auth, setup step 1) stay in ISEXY instead of leaving.
- Delete account: the confirm dialog stays open ("Deleting...") until the
  request is sent; the alternatives are real (hide from Discover, fewer emails)
  instead of a "pause" that does not exist.
- Phone layout: sweep of every area page at 390x844 (e2e/accounts-layout.mjs):
  no horizontal scroll, every control reachable and uncovered (all pass; the
  only hit was the Push page's last switch under the assistant button, now wf/chat's page).
- Block Contacts: phone numbers need the country code (matched against sign-in
  numbers); copy says what it does (not in each other's Discover, nobody told).

## Left / next steps

(filled in as work progresses)
