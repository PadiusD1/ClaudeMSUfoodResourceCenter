#!/usr/bin/env bash
# Daily SQLite backup for Morgan Pantry Store
# Schedule via cron: 0 3 * * * /opt/morgan-pantry/scripts/backup-db.sh

set -euo pipefail

APP_DIR="/opt/morgan-pantry"
DB_FILE="$APP_DIR/data/app.db"
BACKUP_DIR="$APP_DIR/backups"
NAS_BACKUP_DIR="/mnt/nas/pantry-backups"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/app_${TIMESTAMP}.db"

# Use SQLite's .backup command for a safe, consistent copy
# This works even while the server is running (WAL mode)
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# Compress the backup
gzip "$BACKUP_FILE"

# Remove local backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "app_*.db.gz" -mtime +$KEEP_DAYS -delete

echo "[backup] Local: ${BACKUP_FILE}.gz"

# Copy to NAS if mounted
if mountpoint -q "$NAS_BACKUP_DIR" 2>/dev/null || [ -d "$NAS_BACKUP_DIR" ]; then
  cp "${BACKUP_FILE}.gz" "$NAS_BACKUP_DIR/"
  find "$NAS_BACKUP_DIR" -name "app_*.db.gz" -mtime +90 -delete
  echo "[backup] NAS copy: ${NAS_BACKUP_DIR}/app_${TIMESTAMP}.db.gz"
else
  echo "[backup] NAS not mounted at $NAS_BACKUP_DIR, skipping remote copy"
fi
