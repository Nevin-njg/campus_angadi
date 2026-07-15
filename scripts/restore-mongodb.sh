#!/usr/bin/env bash
set -euo pipefail

: "${MONGODB_URI:?Set MONGODB_URI before restoring}"
: "${1:?Usage: npm run restore:mongodb -- /path/to/backup.archive.gz}"
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "Set CONFIRM_RESTORE=YES to confirm this destructive restore." >&2
  exit 1
fi
command -v mongorestore >/dev/null 2>&1 || { echo "mongorestore is required" >&2; exit 1; }
mongorestore --uri="${MONGODB_URI}" --archive="$1" --gzip --drop
echo "Restore completed from: $1"
