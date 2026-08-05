#!/usr/bin/env bash
# ── MySQL backup script ────────────────────────────────────────────────────────
# Dumps the ritual_ai database from the running MySQL container to a local
# timestamped file, then prunes backups older than KEEP_DAYS.
#
# Usage:
#   chmod +x deploy/backup-mysql.sh
#   ./deploy/backup-mysql.sh
#
# Recommended: add a cron job so it runs automatically every day at 2 AM:
#   crontab -e
#   0 2 * * * /home/ubuntu/gotthis/deploy/backup-mysql.sh >> /var/log/gotthis-backup.log 2>&1
#
# Optional: copy backups off-VM (e.g. Oracle Object Storage, S3-compatible):
#   Uncomment and configure the rclone section at the bottom.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
KEEP_DAYS="${KEEP_DAYS:-7}"   # number of daily backups to retain locally
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/ritual_ai_${TIMESTAMP}.sql.gz"

# Load .env so we can read MYSQL_ROOT_PASSWORD without hard-coding it.
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a; source "${ENV_FILE}"; set +a
fi

if [[ -z "${MYSQL_ROOT_PASSWORD:-}" ]]; then
  echo "ERROR: MYSQL_ROOT_PASSWORD is not set. Source .env or set the variable." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup → ${BACKUP_FILE}"

docker compose -f "${COMPOSE_FILE}" exec -T mysql \
  mysqldump \
    --user=root \
    --password="${MYSQL_ROOT_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    ritual_ai \
  | gzip > "${BACKUP_FILE}"

SIZE="$(du -sh "${BACKUP_FILE}" | cut -f1)"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete — ${SIZE} written to ${BACKUP_FILE}"

# Prune backups older than KEEP_DAYS.
find "${BACKUP_DIR}" -name "ritual_ai_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Pruned backups older than ${KEEP_DAYS} days"

# ── Optional: sync to off-VM storage ─────────────────────────────────────────
# Install rclone (https://rclone.org) and configure a remote named "backup":
#   rclone config  →  create a remote named "backup" pointing at Oracle Object
#                     Storage, S3, Backblaze B2, or any S3-compatible store.
# Then uncomment:
#
# REMOTE_PATH="backup:gotthis-backups/mysql"
# rclone copy "${BACKUP_FILE}" "${REMOTE_PATH}/"
# echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Synced to ${REMOTE_PATH}"
