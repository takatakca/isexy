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
- A failed profile refresh after a save keeps the loaded profile (no retry
  screen, no setup); a thrown error never leaves the app on a spinner.
- Onboarding dots have labels.
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

1. Integrator: apply `docs/handoff/accounts.sql` as the next isexy migration
   (after wf/chat's chat.sql, which adds `user_preferences.notification_settings`;
   no clash, different column). Until then Settings say "Saved on this device
   only" and a photo verification request fails with an error toast.
2. Staff review screen for photo verifications (admin/trust area): list
   `photo_verifications` with `status = 'pending'`, show the selfie with
   `supabase.storage.from("isexy-photo-verifications").createSignedUrl(selfie_path, 600)`
   next to the member's `profile_photos`, approve/reject with
   `supabase.rpc("review_photo_verification", { p_request_id, p_approve, p_reason })`.
   Nothing lists pending requests yet, so members wait on "being reviewed".
3. Active Status (settings.activeStatus) is saved but not honoured: Matches and
   Messages read `profiles.last_active_at` directly (src/lib/inbox.ts, wf/chat).
   Next: a SECURITY DEFINER RPC that returns NULL for members with
   showActive = false (and for showRecentlyActive = false when older than 2 h),
   used by the inbox instead of the raw column.
4. Saved but not used anywhere yet: Global, Maximum distance and the two
   "if I run out of profiles" switches (the deck has no distance filter; owner
   decision on wf/discover), Photo Verified Chat (chat send path), Send Read
   Receipts (wf/chat `mark_messages_read` could skip when the reader turned it
   off), distance unit (cards show km), the "who I'd like to see" filters
   (looking for, languages, zodiac...).
5. Discovery off / Incognito / Block Contacts apply to the Discover deck
   (`get_discover_feed`, also used by Explore). Top Picks, Likes and direct
   /web-profile links read profiles directly and do not apply them.
6. Security pass: photo verification approval only means something once members
   can no longer UPDATE `profiles.is_verified` themselves (known hole).
7. Account deletion is a support ticket; staff still delete by hand.
8. Brand: the theme's primary colour tokens are still pink (#ff5864); BRAND.md
   says electric blue. Global token change, not done per page.
