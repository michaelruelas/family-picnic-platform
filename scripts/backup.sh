#!/usr/bin/env bash
set -euo pipefail

# Database backup script for Family Picnic Platform
# Usage: ./scripts/backup.sh [--dump] [--restore FILE] [--prune] [--list]
#
# Requires: pg_dump, pg_restore, psql
# Environment: DATABASE_URL must be set in .env or environment
#
# Backup strategy:
#   Daily: pg_dump (full database)
#   Weekly: full backup with rotation (keep 7 daily, 4 weekly)
#   Retention: 30 days for daily backups, 90 days for weekly backups

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/.backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
WEEK_NUM="$(date +%V)"
RETENTION_DAYS=30
RETENTION_WEEKS=13

# Load .env if present
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

usage() {
  echo "Usage: $0 [--dump] [--restore FILE] [--prune] [--list]"
  echo ""
  echo "Commands:"
  echo "  --dump              Create a new database backup (default)"
  echo "  --restore FILE      Restore from a backup file"
  echo "  --prune             Remove backups older than retention policy"
  echo "  --list              List available backups"
  exit 0
}

dump() {
  local is_weekly="${1:-false}"
  local suffix="daily"
  local file

  if [ "$is_weekly" = true ]; then
    suffix="weekly"
    file="$BACKUP_DIR/family-picnic_weekly_${TIMESTAMP}.dump"
  else
    file="$BACKUP_DIR/family-picnic_daily_${TIMESTAMP}.dump"
  fi

  echo "Creating backup: $file"
  pg_dump --clean --if-exists --format=custom --no-owner --no-acl \
    --dbname="$DATABASE_URL" \
    --file="$file"

  local size
  size=$(du -h "$file" | cut -f1)
  echo "Backup complete: $file ($size)"
}

restore() {
  local file="$1"

  if [ ! -f "$file" ]; then
    echo "ERROR: Backup file not found: $file"
    exit 1
  fi

  echo "Restoring from: $file"
  echo "WARNING: This will overwrite the current database!"
  read -r -p "Are you sure? [y/N] " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Restore cancelled."
    exit 0
  fi

  pg_restore --clean --if-exists --no-owner --no-acl \
    --dbname="$DATABASE_URL" \
    --file="$file" || {
    echo "WARNING: pg_restore completed with warnings (non-fatal)"
  }

  echo "Restore complete."
}

prune() {
  echo "Pruning backups older than retention policy..."
  local count=0

  # Remove daily backups older than RETENTION_DAYS
  while IFS= read -r -d '' file; do
    rm -f "$file"
    echo "  Removed: $file"
    count=$((count + 1))
  done < <(find "$BACKUP_DIR" -name "family-picnic_daily_*.dump" -mtime +"$RETENTION_DAYS" -print0)

  # Remove weekly backups older than RETENTION_WEEKS
  while IFS= read -r -d '' file; do
    rm -f "$file"
    echo "  Removed: $file"
    count=$((count + 1))
  done < <(find "$BACKUP_DIR" -name "family-picnic_weekly_*.dump" -mtime +$((RETENTION_WEEKS * 7)) -print0)

  echo "Pruned $count backup(s)."
}

list_backups() {
  echo "Available backups:"
  echo ""

  if [ ! "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
    echo "  No backups found."
    exit 0
  fi

  ls -lhS "$BACKUP_DIR"/*.dump 2>/dev/null | awk '{
    split($9, parts, "/");
    name = parts[length(parts)];
    printf "  %-50s %s\n", name, $5
  }'

  echo ""
  local total
  total=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
  echo "Total backup size: $total"
}

# Main
COMMAND="${1:---dump}"

case "$COMMAND" in
  --dump)
    dump
    ;;
  --dump-weekly)
    dump true
    ;;
  --restore)
    if [ -z "${2:-}" ]; then
      echo "ERROR: --restore requires a backup file path"
      exit 1
    fi
    restore "$2"
    ;;
  --prune)
    prune
    ;;
  --list)
    list_backups
    ;;
  *)
    usage
    ;;
esac