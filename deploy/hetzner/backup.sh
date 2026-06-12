#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Nightly PostgreSQL backup for the Hetzner production stack.
#
# Dumps the geo-wushu database from the compose `db` service, gzips it into
# BACKUP_DIR, and prunes dumps older than RETENTION_DAYS. Pair it with an
# OFF-BOX copy (Hetzner Storage Box / object storage) — a backup that lives
# only on the same VPS disk protects against nothing that matters.
#
# Install as a host cron (run from the repo root):
#   crontab -e
#   15 3 * * * /opt/geo-wushu/deploy/hetzner/backup.sh >> /var/log/geo-wushu-backup.log 2>&1
#
# Restore (DESTRUCTIVE — drops current data):
#   gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose -f deploy/hetzner/docker-compose.prod.yml \
#     --env-file deploy/hetzner/.env.prod exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Resolve paths relative to this script so the cron entry stays one line.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
ENV_FILE="${SCRIPT_DIR}/.env.prod"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/geo-wushu}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Read DB credentials from the same env file compose uses.
# shellcheck disable=SC1090
source "${ENV_FILE}"

mkdir -p "${BACKUP_DIR}"

STAMP="$(date +%F)"
OUT="${BACKUP_DIR}/backup-${STAMP}.sql.gz"

cd "${REPO_ROOT}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" \
  exec -T db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${OUT}"

# A zero-byte dump means pg_dump failed inside the pipe — fail loudly.
if [ ! -s "${OUT}" ]; then
  echo "[backup] FAILED: ${OUT} is empty" >&2
  rm -f "${OUT}"
  exit 1
fi

echo "[backup] wrote ${OUT} ($(du -h "${OUT}" | cut -f1))"

# Prune local dumps past retention.
find "${BACKUP_DIR}" -name 'backup-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

# ── OFF-BOX COPY (uncomment + configure one) ─────────────────────────────────
# rclone copy "${OUT}" storagebox:geo-wushu-backups/
# scp "${OUT}" u123456@u123456.your-storagebox.de:backups/
