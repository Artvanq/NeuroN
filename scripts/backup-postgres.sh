#!/usr/bin/env sh
# Daily Postgres backup — requires pg_dump and DATABASE_URL
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
STAMP=$(date -u +%Y%m%d-%H%M%S)
FILE="$OUT_DIR/neuron-${STAMP}.sql.gz"

echo "Writing $FILE ..."
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -9 > "$FILE"
echo "Done: $FILE ($(du -h "$FILE" | cut -f1))"

# Optional retention: delete backups older than N days
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
if [ "$RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  find "$OUT_DIR" -name 'neuron-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
fi
