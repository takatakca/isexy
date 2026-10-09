#!/usr/bin/env bash
# Applies ISEXY migrations (supabase/isexy-migrations/*.sql) to the isexy schema
# of a shared database (TAKATAK V1), tracked in isexy.schema_migrations.
#
#   ISEXY_DB_URL=postgresql://... scripts/isexy/migrate.sh            # dry run (default)
#   ISEXY_DB_URL=postgresql://... scripts/isexy/migrate.sh --apply    # apply
#
# Dry run: runs every pending migration in ONE transaction and rolls it back.
# Apply: one transaction per migration. In both modes a fingerprint of V1's
# public schema, auth/storage triggers and policies, non-ISEXY buckets and the
# non-isexy realtime tables is taken before and after; any difference aborts
# and rolls back. This never uses `supabase db push` (V1's migration history
# belongs to takatak-v1).
set -euo pipefail

MODE="dry-run"
case "${1:-}" in
  ""|--dry-run) MODE="dry-run" ;;
  --apply) MODE="apply" ;;
  *) echo "usage: $0 [--dry-run|--apply]" >&2; exit 2 ;;
esac

: "${ISEXY_DB_URL:?Set ISEXY_DB_URL (session pooler or direct connection string of TAKATAK V1)}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$ROOT/supabase/isexy-migrations"
GUARD="$ROOT/scripts/isexy/guard.sql"
BUCKET_GUARD="$ROOT/scripts/isexy/storage-guard.sql"
PSQL=(psql "$ISEXY_DB_URL" -X -q -v ON_ERROR_STOP=1 --no-psqlrc)

bootstrap_sql="CREATE SCHEMA IF NOT EXISTS isexy;
CREATE TABLE IF NOT EXISTS isexy.schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON isexy.schema_migrations FROM PUBLIC, anon, authenticated;"

# Which migrations are already applied (and with which checksum)?
applied="$("${PSQL[@]}" -At -c "SELECT version || ' ' || checksum FROM isexy.schema_migrations" 2>/dev/null || true)"

pending=()
for f in "$DIR"/*.sql; do
  v="$(basename "$f" .sql)"
  sum="$(sha256sum "$f" | cut -d' ' -f1)"
  rec="$(printf '%s\n' "$applied" | awk -v v="$v" '$1 == v { print $2 }')"
  if [ -z "$rec" ]; then
    pending+=("$f")
  elif [ "$rec" != "$sum" ]; then
    echo "ERROR: $v was applied with checksum $rec but the file now hashes to $sum." >&2
    echo "Applied migrations are immutable; add a new migration instead." >&2
    exit 1
  fi
done

if [ ${#pending[@]} -eq 0 ]; then
  echo "isexy schema is up to date."
  exit 0
fi

echo "Pending ($MODE):"
for f in "${pending[@]}"; do echo "  - $(basename "$f")"; done

# Build one psql script per transaction: bootstrap, fingerprint, migration(s),
# record, compare fingerprint, then ROLLBACK (dry run) or COMMIT (apply).
run_tx() {
  local finish="$1"; shift
  {
    echo "BEGIN;"
    echo "$bootstrap_sql"
    echo "CREATE TEMP TABLE _isexy_guard ON COMMIT DROP AS $(sed 's/;\s*$//' "$GUARD") ;"
    echo "CREATE TEMP TABLE _isexy_bucket_guard ON COMMIT DROP AS $(sed 's/;\s*$//' "$BUCKET_GUARD") ;"
    for f in "$@"; do
      v="$(basename "$f" .sql)"; sum="$(sha256sum "$f" | cut -d' ' -f1)"
      echo "\\echo '>> $v'"
      echo "\\ir $f"
      echo "INSERT INTO isexy.schema_migrations(version, checksum) VALUES ('$v', '$sum');"
      echo "RESET search_path;"
    done
    echo "CREATE TEMP TABLE _isexy_guard_after ON COMMIT DROP AS $(sed 's/;\s*$//' "$GUARD") ;"
    echo "CREATE TEMP TABLE _isexy_bucket_guard_after ON COMMIT DROP AS $(sed 's/;\s*$//' "$BUCKET_GUARD") ;"
    cat <<'SQL'
DO $guard$
BEGIN
  IF (SELECT fingerprint FROM _isexy_guard) IS DISTINCT FROM (SELECT fingerprint FROM _isexy_guard_after) THEN
    RAISE EXCEPTION 'isexy guard: V1 public/auth/storage objects changed; rolling back';
  END IF;
  IF (SELECT md5 FROM _isexy_bucket_guard) IS DISTINCT FROM (SELECT md5 FROM _isexy_bucket_guard_after) THEN
    RAISE EXCEPTION 'isexy guard: non-ISEXY storage buckets changed; rolling back';
  END IF;
  RAISE NOTICE 'isexy guard: V1 objects unchanged';
END
$guard$;
SQL
    echo "$finish;"
  } | "${PSQL[@]}"
}

if [ "$MODE" = "dry-run" ]; then
  run_tx ROLLBACK "${pending[@]}"
  echo "Dry run OK: ${#pending[@]} migration(s) apply cleanly and leave V1 objects unchanged (rolled back)."
else
  for f in "${pending[@]}"; do
    run_tx COMMIT "$f"
    echo "applied $(basename "$f")"
  done
  "${PSQL[@]}" -c "NOTIFY pgrst, 'reload schema';"
  echo "Done. PostgREST schema cache reload requested."
fi
