# Integrator A: running notes (discover + accounts + chat)

Branch `claude/zealous-brown-kv2hmx`. Notes so the integration survives a stop.

## Progress

- [x] merge wf/discover (typecheck clean)
- [x] merge wf/accounts (App.tsx + types.ts auto-merged; typecheck clean)
- [x] merge wf/chat (conflicts: ContactMethodModal = chat version; Matches.tsx = discover base + chat tick/realtime/header; useChatOpener got onClose; push/email files = chat versions)
- [ ] cross-area notes
- [x] 0004_app_completion.sql (A discover, B accounts, C chat) + CI-style test:
      v1-mock.sql, migrate.sh dry run, --apply, re-run no-op all pass, guard silent;
      0004 re-applied on top of itself in a rolled-back tx: OK.
      scripts/isexy/test/0004-smoke.sql: 34/34 PASS (allowed + forbidden per RPC).
      Local PG16 ran in /var/tmp/isexy-integ-a-pg (port 55440): the sandbox does not
      let the postgres user into the scratchpad.
      Changes vs the branch SQL: one swipes(swiped_id, created_at DESC) index instead of
      two; get_my_badge_counts likes use the same liker filters as get_likes_received;
      group chat policies TO authenticated; photo_verifications grants trimmed; policies
      DROP IF EXISTS + CREATE.
- [x] types.ts: + review_photo_verification, is_group_chat_member (others came with the branches)
- [ ] typecheck, build, lint, e2e
- [ ] docs/HANDOFF.md, WORKLOG, push
