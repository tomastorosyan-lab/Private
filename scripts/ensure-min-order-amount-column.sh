#!/usr/bin/env bash
# Применить все SQL-патчи к БД (локально: из корня репозитория с запущенным docker compose).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_DIR="${ROOT}/scripts/sql"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [[ ! -d "${SQL_DIR}" ]]; then
  echo "Missing ${SQL_DIR}" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  compose() { docker compose -f "${COMPOSE_FILE}" "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() { docker-compose -f "${COMPOSE_FILE}" "$@"; }
else
  echo "Need docker compose or docker-compose" >&2
  exit 1
fi

found=0
for sql_file in "${SQL_DIR}"/*.sql; do
  if [[ -f "${sql_file}" ]]; then
    found=1
    echo "[ensure-schema] apply ${sql_file}"
    compose exec -T db psql -U postgres -d dis_db -v ON_ERROR_STOP=1 < "${sql_file}"
  fi
done

if [[ "${found}" -eq 0 ]]; then
  echo "No SQL patches found in ${SQL_DIR}" >&2
  exit 1
fi

echo "[ensure-schema] OK"
