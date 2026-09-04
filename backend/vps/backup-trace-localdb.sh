#!/usr/bin/env bash
# Nightly Trace LocalDB backup: online SQLite snapshot + offsite rclone copy.
# Installed as trace-localdb-backup.service/.timer (see below). Configure:
#   /etc/trace/backup.env -> TRACE_BACKUP_REMOTE (e.g. "b2:trace-backups"), RETENTION_DAYS
set -euo pipefail
cd /home/ubuntu/trace

DATA_DIR="/srv/trace-data/localdb"
BACKUP_DIR="/srv/trace-data/backups"
ENV_FILE="/etc/trace/backup.env"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
DEST="$BACKUP_DIR/documents-$STAMP.sqlite3"

# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
: "${RETENTION_DAYS:=30}"

mkdir -p "$BACKUP_DIR"
/home/ubuntu/trace/.venv/bin/python - "$DATA_DIR/documents.sqlite3" "$DEST" <<'EOF'
import sys
from backend.localdb import LocalDocumentStore
src, dest = sys.argv[1], sys.argv[2]
LocalDocumentStore(src).backup_to(dest)
print(f"backup written: {dest}")
EOF

gzip -f "$DEST"

if [ -n "${TRACE_BACKUP_REMOTE:-}" ]; then
  rclone copy "$DEST.gz" "$TRACE_BACKUP_REMOTE/trace-localdb/" --s3-no-check-bucket
  echo "offsite copy done: $TRACE_BACKUP_REMOTE/trace-localdb/"
else
  echo "TRACE_BACKUP_REMOTE unset — kept local copy only: $DEST.gz"
fi

# Local retention.
find "$BACKUP_DIR" -name 'documents-*.sqlite3.gz' -mtime +"$RETENTION_DAYS" -delete
