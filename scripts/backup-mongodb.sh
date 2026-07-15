#!/usr/bin/env bash
set -euo pipefail

: "${MONGODB_URI:?Set MONGODB_URI before running a backup}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT="${BACKUP_DIR}/campusbaza-${TIMESTAMP}.archive.gz"
mkdir -p "${BACKUP_DIR}"
command -v mongodump >/dev/null 2>&1 || { echo "mongodump is required" >&2; exit 1; }
mongodump --uri="${MONGODB_URI}" --archive="${OUTPUT}" --gzip
echo "Backup created: ${OUTPUT}"
