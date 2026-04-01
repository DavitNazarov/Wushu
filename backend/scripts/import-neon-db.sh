#!/usr/bin/env bash
set -euo pipefail

if [ -z "${TARGET_DATABASE_URL:-}" ]; then
  echo "Error: TARGET_DATABASE_URL is required." >&2
  exit 1
fi

if [ "${CONFIRM_RESET:-}" != "yes" ]; then
  echo "Refusing to import without CONFIRM_RESET=yes." >&2
  echo "This restore uses --clean --if-exists and may drop or replace existing target data." >&2
  exit 1
fi

if printf '%s' "${TARGET_DATABASE_URL}" | grep -q -- '-pooler\.'; then
  echo "Refusing to use a pooled Neon connection string for restore." >&2
  echo "Set TARGET_DATABASE_URL to the direct Neon connection string whose host does not contain -pooler." >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
DUMP_FILE="${DUMP_FILE:-tmp/local.dump}"

case "${DUMP_FILE}" in
  /*) ;;
  *) DUMP_FILE="${BACKEND_DIR}/${DUMP_FILE}" ;;
esac

if [ ! -f "${DUMP_FILE}" ]; then
  echo "Error: dump file not found at ${DUMP_FILE}" >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "Error: pg_restore is required but was not found in PATH." >&2
  exit 1
fi

echo "WARNING: restoring ${DUMP_FILE} into target database."
echo "WARNING: existing objects from the dump may be dropped and recreated."
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --dbname="${TARGET_DATABASE_URL}" \
  "${DUMP_FILE}"
echo "Import complete."
