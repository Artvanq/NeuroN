#!/usr/bin/env sh
# Print or install a daily Postgres backup cron line for Neuron.
# Usage:
#   export DATABASE_URL=postgresql://...
#   export BACKUP_DIR=/var/backups/neuron
#   ./scripts/install-backup-cron.sh          # print crontab line
#   ./scripts/install-backup-cron.sh --install # append to user crontab (interactive)

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_SCRIPT="$ROOT/scripts/backup-postgres.sh"
HOUR="${BACKUP_CRON_HOUR:-3}"
MINUTE="${BACKUP_CRON_MINUTE:-0}"

if [ ! -x "$BACKUP_SCRIPT" ]; then
  chmod +x "$BACKUP_SCRIPT"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Set DATABASE_URL before running." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
LOG="${BACKUP_LOG:-/var/log/neuron-backup.log}"

LINE="$MINUTE $HOUR * * * cd $ROOT && DATABASE_URL='$DATABASE_URL' BACKUP_DIR='$BACKUP_DIR' BACKUP_RETENTION_DAYS=$RETENTION $BACKUP_SCRIPT >> $LOG 2>&1"

if [ "${1:-}" = "--install" ]; then
  (crontab -l 2>/dev/null | grep -v 'backup-postgres.sh' || true; echo "$LINE") | crontab -
  echo "Installed cron:"
  crontab -l | grep backup-postgres || true
else
  echo "# Add this line to crontab -e:"
  echo "$LINE"
fi
