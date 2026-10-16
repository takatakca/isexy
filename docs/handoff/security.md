# Security + DB performance stage (0005)

Branch `claude/zealous-brown-kv2hmx`. Migration
`supabase/isexy-migrations/0005_security_and_performance.sql` runs after 0004
(neither is applied anywhere). The file header lists every part and why.
Tests: `scripts/isexy/test/security-smoke.sql` (105 checks), wired into the CI
`migrations` job with the three older smoke files.

## Progress

- [x] audit: client writes of profiles + the money/ledger tables (grep of src/ and supabase/functions/)
- [x] audit: every isexy policy, SECURITY DEFINER function, grant (local DB 0001-0004)
- [x] 0005 part A: protected profile columns trigger
- [x] 0005 part B: member write policies closed + audit fixes
- [x] 0005 part C: FK indexes, (select auth.uid()) policies, normalize_gender search_path, duplicate indexes
- [x] security-smoke.sql (105 PASS on 0001-0005; the same file fails 60 checks on 0001-0004)
- [x] migration test 0001-0005 like CI (mock, dry run, apply, re-run "up to date", guard silent) + all smoke files
- [x] CI: smoke tests step in the `migrations` job
- [ ] typecheck, build, lint, every e2e
- [ ] HANDOFF.md security section, WORKLOG, push

## How the local test ran

Throwaway Postgres 16 in `/var/tmp/isexy-sec5-pg`, port 55517 (the `postgres`
user cannot enter the scratchpad: `/tmp/claude-0` is mode 700, so the data
directory lives under `/var/tmp`, as for the earlier stages). Database
`postgres`: `v1-mock.sql`, `migrate.sh` dry run (5 pending, guard "V1 objects
unchanged"), `--apply`, re-run "up to date"; smoke tests with
`-v ON_ERROR_STOP=1` (without it psql exits 0 even when a smoke file fails):
0004-smoke 34, calls-smoke 101, rewards-smoke 88, security-smoke 105, all PASS.
0005 applied twice in a row is a no-op (C2 says "already applied").

## Audit: client writes (proof that closing the policies breaks nothing)

`python3 -I <scratchpad>/security/writes.py src` lists every
`.insert/.update/.upsert/.delete` with the nearest `.from("table")`.

- `profiles` (13 sites): CubanSignup insert (user_id, first_name, birth_date,
  gender, country; then `rpc("set_my_cuban_flag")`), ProfileSetup and
  TouristSignup insert/update (first_name, birth_date, gender, interested_in,
  bio, lifestyle fields, interests, privacy_accepted, latitude/longitude,
  location_enabled, country), DiscoverFilters and Settings (distance_preference,
  age_min, age_max, interested_in, show_gender, show_orientation), EditBio (bio),
  EditProfile (core + extended text fields), Interests (interests), PassportMode
  (latitude, longitude, city), useStreakTracker (last_active_at),
  AdminDashboardFull (`is_active`, staff only: exempt from the trigger). **No
  member write sets a protected column.**
- No client code inserts/updates `credit_transactions`, `boost_transactions`,
  `boost_wallets`, `allowances`, `star_transactions`, `gift_transactions`,
  `coupon_redemptions`, `missed_calls`, `messages` (UPDATE), `matches`, `swipes`
  (INSERT; only the undo DELETE), `referrals`, `star_cashout_requests`,
  `message_translations`. Those go through RPCs (perform_like,
  mark_messages_read, use_boost, convert_credits_to_minutes, record_missed_call,
  apply_referral_code, request_star_cashout...) or service-role functions.
- Edge functions: every write uses the service-role client (`admin` /
  `supabase` with the service key); the three user-JWT clients
  (`isexy-get-voice-reply-url`, `isexy-get-voice-greeting-url`,
  `isexy-seed-profiles`) only read or check the caller.
- Every isexy function that UPDATEs `profiles` is SECURITY DEFINER (16, all with
  `search_path = isexy, extensions`), so the trigger never sees them as members.

## Audit: what else was found and fixed (0005 B2-B4)

See the 0005 header: matches UPDATE, swipes INSERT, referrals INSERT,
star_cashout_requests INSERT, message_translations INSERT dropped;
content_violations, forum posts/replies, cuban_verifications, scheduled_calls
checks; scheduled_calls and double_date_pairs guard triggers; profile photo
uploads limited to the member's folder; get_admin_users staff only;
purge_old_telemetry / cleanup_expired_otps / calculate_profile_score
service_role only; anon EXECUTE removed where it was never needed; TRUNCATE /
TRIGGER / REFERENCES and sequence UPDATE revoked from anon/authenticated.

## Audit: looked at and left alone (with the reason)

- Every SECURITY DEFINER function already pins `search_path` (82 checked).
  Member RPCs check `auth.uid()` directly or via `assert_profile_owner`
  (perform_like, use_boost, redeem_coupon, sync_entitlements,
  unlock_conversation, check_swipe_rate_limit are thin wrappers).
- `has_role` stays executable by anon: policies evaluated for anon call it.
- `messages` INSERT: the `validate_message_allowed` trigger already refuses
  inactive matches, non-participants and blocks.
- Phone Line tables (`phone_line_numbers`, `phone_line_profiles`,
  `voice_greetings`, `phone_line_voice_replies`) already have member guards (0004 D).
- **For the trust stage / owner (not changed here, to avoid clashing with the
  moderation work or because it is a product rule):**
  - `reports` INSERT lets the reporter set `status` (could file a report as
    already "resolved"): add `AND coalesce(status, 'pending') = 'pending'`.
  - No staff UPDATE policy on `profiles`: the AdminDashboardFull ban button
    (`is_active`) silently changes nothing; give staff an RPC (the trigger
    already lets staff change protected columns).
  - `user_warnings` INSERT is staff only, but `useContentModeration` inserts
    warnings as the member: the progressive ban never records (silent failure).
  - `support_tickets` "Users can update own tickets": a member can change
    `status`, `priority`, `assigned_to`, `admin_notes`, `response` of their own
    ticket; the policy also reads `auth.users` (members cannot on Supabase).
  - `profiles` SELECT: every member reads every column of every active profile
    (`blocked_contacts`, latitude/longitude to ~1 km, `shadow_banned`, plan).
    Column-level privacy needs a view or RPC; `select("*")` sites would change.
  - Chat unlock (Premium / chat unlock / chat subscription) and Plus-only
    settings (Incognito, Recently Active in `user_preferences`) are enforced in
    the UI only (owner decision #1 pending).
  - `forum_posts.view_count` is updated by viewers but only authors may update:
    the counter only moves for the author's own views (needs an RPC).
  - The duplicate UNIQUE pairs on `matches` and `swipes` both back
    constraints (kept per the rule: only plain indexes are dropped).

## C2: regenerate when a policy changes

C2 is static: `scripts/isexy/gen-rls-initplan.sh` (with
`scripts/isexy/gen-rls-initplan.sql`) runs 0005 parts A-C1 and the generator in
one rolled-back transaction on a throwaway 0001-0004 database and rewrites the
block between the `@@C2` markers. The block starts with a fingerprint guard:
if any isexy policy that still calls `auth.*()` per row differs from the ones
the statements were generated from (for example the trust stage changes a
policy in 0004, or adds one), 0005 stops with "C2: ... fingerprint ... <> ..."
and the hint to regenerate. Checked: a changed `reports` policy makes 0005
fail; regenerating picks it up. After regenerating, re-run the migration test
and `security-smoke.sql` (its C2 check fails if a policy was missed).

Logic check used for the 133 rewritten policies: unwrap
`( SELECT auth.uid() AS uid)` → `auth.uid()` and
`( SELECT isexy.has_role(...) AS has_role)` → `isexy.has_role(...)` on the
pg_policies text before and after C2; the two listings are identical.

FK index query (C1), on a 0001-0004 copy: FKs in `isexy` with no valid index
whose leading columns are the FK columns (partial indexes only with an
`IS NOT NULL` predicate) — 51, all single-column; same query is check C1 of
security-smoke.
