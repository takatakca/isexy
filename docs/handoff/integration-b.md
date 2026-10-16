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
      Smoke: 0004-smoke 34/34, calls-smoke 101/101, rewards-smoke 88/88.
- [x] types.ts: member RPCs already matched the DB (args compared); + service_role RPCs the
      edge functions call (apply_chat_subscription, apply_stripe_subscription,
      apply_twilio_call_status, fulfill_stripe_payment, expire_member_plans, reset_daily_likes)
- [ ] typecheck, build, lint, every e2e
- [ ] cross-area notes
- [ ] docs/HANDOFF.md, WORKLOG, push
