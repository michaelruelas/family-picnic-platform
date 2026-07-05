#!/usr/bin/env bash
set -euo pipefail

# Install cron jobs for production maintenance tasks
# Run this once during deployment setup.
#
# Adds:
#   - Database backup (daily at 2 AM)
#   - Database backup (weekly on Sunday at 3 AM)
#   - Process scheduled broadcasts (every minute)
#   - Prune old backups (daily at 4 AM)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CRON_LOG_DIR="${PROJECT_DIR}/.cron-logs"

mkdir -p "$CRON_LOG_DIR"

# Remove any existing family-picnic entries first
crontab -l 2>/dev/null | grep -v 'family-picnic' > /tmp/family-picnic-crontab || true

# Append new entries
cat >> /tmp/family-picnic-crontab <<CRONTAB

# family-picnic: daily database backup (2 AM)
0 2 * * * cd $PROJECT_DIR && ./scripts/backup.sh --dump >> $CRON_LOG_DIR/backup-daily.log 2>&1

# family-picnic: weekly database backup (Sunday 3 AM)
0 3 * * 0 cd $PROJECT_DIR && ./scripts/backup.sh --dump-weekly >> $CRON_LOG_DIR/backup-weekly.log 2>&1

# family-picnic: process scheduled broadcasts (every minute)
* * * * * cd $PROJECT_DIR && curl -s -H "Authorization: Bearer \$CRON_SECRET" http://localhost:3000/api/admin/communications/process-scheduled >> $CRON_LOG_DIR/process-scheduled.log 2>&1

# family-picnic: prune old backups (daily 4 AM)
0 4 * * * cd $PROJECT_DIR && ./scripts/backup.sh --prune >> $CRON_LOG_DIR/prune.log 2>&1
CRONTAB

crontab /tmp/family-picnic-crontab
rm /tmp/family-picnic-crontab

echo "Cron jobs installed. Logs go to: $CRON_LOG_DIR"