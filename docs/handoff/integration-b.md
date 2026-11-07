# Integrator B: running notes (calls + rewards)

Branch `claude/zealous-brown-kv2hmx` (base 336099c). Notes so the integration
survives a stop.

## Progress

- [x] merge wf/calls (only WORKLOG.md conflicted; typecheck clean)
- [x] merge wf/rewards (WORKLOG.md + e2e/README.md conflicted, both sides kept; types.ts, App.tsx, AIChatWidget auto-merged; typecheck clean)
- [x] 0004: calls.sql appended as part D (D1-D6), rewards.sql as part R (R1-R11);
      one CHECK widening block (D1 adds 'spend' + 'referral_bonus', R1 points to it);
      header lists D and R. docs/handoff/calls.sql and rewards.sql marked FOLDED.
      CI-style test on a throwaway Postgres 16 (/var/tmp/isexy-integ-b-pg, port 55480:
      the postgres user cannot enter the scratchpad): v1-mock.sql, migrate.sh dry run,
      --apply, re-run "up to date", guard silent; 0004 re-applied on itself (rolled
      back): OK; one definition per function (no overloads in isexy).
      Smoke: 0013-smoke 34/34, calls-smoke 101/101, rewards-smoke 88/88.
- [x] types.ts: member RPCs already matched the DB (args compared); + service_role RPCs the
      edge functions call (apply_chat_subscription, apply_stripe_subscription,
      apply_twilio_call_status, fulfill_stripe_payment, expire_member_plans, reset_daily_likes)
- [x] typecheck clean; build OK (offline); lint 120 errors, all pre-existing (148 at
      336099c): per-file comparison with 336099c found one new one in the new
      supabase/functions/_shared/payments.ts (`sub: any`), now typed. Edge functions
      type-checked with tsc + Deno shims + Stripe 18.5 types (17 changed functions, clean).
- [x] e2e (vite preview on 4410, offline guard): discover 36, accounts-auth-setup 28,
      accounts-profile 24, accounts-settings 54, accounts-signups 26, accounts-layout 33,
      chat 39, chat-notifications 21, rewards 86/86, calls 61 + ALL PASS, calls-twilio
      43, calls-phone-line-pages 52 + ALL PASS (build with VITE_PHONE_LINE_NUMBER),
      smoke-swipe/chat/auth/reposition logs read, no page errors. Preview and
      Postgres stopped.
- [x] cross-area notes: isexy-send-missed-call-notification needs the session
      record_missed_call marked missed (same match + caller, < 5 min), reuses its
      missed_calls row, no double notify. Left for the Security stage (listed in
      HANDOFF): user_credits "Users can update own credits", anon EXECUTE on
      deduct_call_minute. Left for owners: moderator voice review, sticky bars under
      the assistant button on other pages, PromoOfferBanner deletion.
- [x] docs/HANDOFF.md (calls + rewards in Done/Left, Needs the owner, trust area still to do,
      security next pass), WORKLOG, push to origin claude/zealous-brown-kv2hmx
