#!/usr/bin/env bash
set -euo pipefail

# OpenWorkflow worker process for Family Picnic Platform
# Starts a worker that polls PostgreSQL for pending workflow runs and
# executes them.
#
# Usage:
#   ./scripts/worker.sh [--concurrency N]
#
# Environment:
#   DATABASE_URL must be set

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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

cd "$PROJECT_DIR"
exec npx @openworkflow/cli worker start "$@"