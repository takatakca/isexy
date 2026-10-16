# Security + DB performance stage: running notes

Branch `claude/zealous-brown-kv2hmx` (base b9f1815). New migration
`supabase/isexy-migrations/0005_security_and_performance.sql` (0004 is not
applied anywhere either; 0005 runs after it). Notes kept current so the work
survives a stop.

Local test database: throwaway Postgres 16 in `/var/tmp/isexy-security-pg`,
port 55496 (the postgres user cannot enter the scratchpad).

## Progress

- [ ] audit: client writes of profiles + the money/ledger tables (grep of src/)
- [ ] audit: every isexy policy, SECURITY DEFINER function, grant (local DB)
- [ ] 0005 part A: protected profile columns trigger
- [ ] 0005 part B: member write policies closed + audit fixes
- [ ] 0005 part C: FK indexes, (select auth.uid()) policies, normalize_gender search_path, duplicate indexes
- [ ] 0005 smoke tests (scripts/isexy/test/0005-smoke.sql)
- [ ] migration test 0001-0005 + all smoke files
- [ ] typecheck, build, lint, every e2e
- [ ] HANDOFF.md security section, WORKLOG, push
