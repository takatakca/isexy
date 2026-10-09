# Work log

Newest first, one line per piece of work. Rule: `AGENTS.md` › Work log rule.
Format: `YYYY-MM-DD | agent | branch → PR | status | what | next step`

- 2026-10-09 | claude | claude/zealous-brown-kv2hmx → PR #1 | PR #1 merged | Coolify hosting: no bun (bun.lockb only on main), nixpacks.toml pins Node 22 + npm, CI lockfile rule, docs (Render = fallback) | owner: redeploy main on Coolify, then V1-MIGRATION.md 3.9 checks
- 2026-10-09 | claude | claude/zealous-brown-kv2hmx → PR #1 | PR #1 merged | Reposition ISEXY: Canadian 18+ social network wording everywhere, Canada/EN-FR default; Cuba removal ON HOLD (nothing Cuba removed, no data deleted) | owner: decide docs/REPOSITIONING.md › Waiting on the owner (hero image, Cuba items)
- 2026-10-09 | claude | claude/zealous-brown-kv2hmx → PR #1 | PR #1 merged (nothing deployed to V1) | Move ISEXY off Lovable onto TAKATAK V1: isexy schema + guarded migrate.sh, isexy-* functions, Takatak Auth, Claude, Stripe customer fix | owner: docs/V1-MIGRATION.md §3 (migrate.sh dry run then --apply, expose isexy schema; the live app gets PGRST106 until then), then secrets, Stripe webhook
- 2026-10-08 | claude (owner setup) | default branch | done | Added the work log rule, this log and the stop reminder | every agent follows AGENTS.md › Work log rule
