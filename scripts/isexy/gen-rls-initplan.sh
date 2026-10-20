#!/usr/bin/env bash
# Regenerates part C2 of supabase/isexy-migrations/0014_security_and_performance.sql
# (one ALTER POLICY per isexy policy calling auth.uid()/auth.jwt()/auth.role()
# per row, and the fingerprint guard; see scripts/isexy/gen-rls-initplan.sql).
#
#   ISEXY_DB_URL=postgresql://postgres@localhost:<port>/<db> scripts/isexy/gen-rls-initplan.sh
#
# Use a THROWAWAY database with v1-mock.sql + 0001-0013 applied (not 0014).
# One transaction, rolled back: parts A-C1 of 0014 first (C2 must see the
# policies after part B), then the generator; nothing is kept in the database.
# Only the C2 block of the 0014 file (between the @@C2 markers) is rewritten.
# Review the diff before committing: every statement must keep the policy's logic.
set -euo pipefail

: "${ISEXY_DB_URL:?Set ISEXY_DB_URL to a throwaway database with 0001-0013 applied}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIG="$ROOT/supabase/isexy-migrations/0014_security_and_performance.sql"
GEN="$ROOT/scripts/isexy/gen-rls-initplan.sql"
TMP="$(mktemp -d)"
trap 'rm -f "$TMP/before-c2.sql" "$TMP/c2.sql"; rmdir "$TMP"' EXIT

# 0014 up to (not including) the C2 section separator.
awk '/^-- C2\. /{exit} {print}' "$MIG" | sed '$d' > "$TMP/before-c2.sql"

{
  echo "BEGIN;"
  echo "\\o /dev/null"
  echo "\\ir $TMP/before-c2.sql"
  echo "RESET search_path;"
  echo "\\o"
  echo "\\ir $GEN"
  echo "ROLLBACK;"
} | psql "$ISEXY_DB_URL" -X -q -v ON_ERROR_STOP=1 --no-psqlrc -At > "$TMP/c2.sql"

python3 -I - "$MIG" "$TMP/c2.sql" <<'PY'
import re, sys
mig, gen = sys.argv[1], sys.argv[2]
src = open(mig).read()
block = open(gen).read().strip("\n")
if not block.startswith("-- @@C2 begin@@") or not block.endswith("-- @@C2 end@@"):
    sys.exit("generator output is not a C2 block:\n" + block[:500])
if "-- @@C2 begin@@" in src:
    new = re.sub(r"-- @@C2 begin@@.*?-- @@C2 end@@", lambda m: block, src, count=1, flags=re.S)
elif "-- @@C2@@" in src:
    new = src.replace("-- @@C2@@", block, 1)
else:
    sys.exit("no C2 markers in " + mig)
open(mig, "w").write(new)
print("C2 regenerated: " + block.splitlines()[0])
PY
