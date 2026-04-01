#!/usr/bin/env bash
set -euo pipefail

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump is required but was not found in PATH." >&2
  exit 1
fi

if [ -z "${LOCAL_DATABASE_URL:-}" ]; then
  echo "Error: LOCAL_DATABASE_URL is required." >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
DUMP_FILE="${DUMP_FILE:-tmp/local.dump}"

case "${DUMP_FILE}" in
  /*) ;;
  *) DUMP_FILE="${BACKEND_DIR}/${DUMP_FILE}" ;;
esac

mkdir -p "$(dirname -- "${DUMP_FILE}")"

echo "Exporting local PostgreSQL data to ${DUMP_FILE}"
pg_dump -Fc --no-owner --no-privileges "${LOCAL_DATABASE_URL}" -f "${DUMP_FILE}"
echo "Export complete."
