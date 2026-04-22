#!/usr/bin/env bash
# Применить SQL-патч к БД (локально: из корня репозитория с запущенным docker compose).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL="${ROOT}/scripts/sql/patch_users_min_order_amount.sql"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [[ ! -f "${SQL}" ]]; then
  echo "Missing ${SQL}" >&2
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

compose exec -T db psql -U postgres -d dis_db -v ON_ERROR_STOP=1 < "${SQL}"
echo "[ensure-min-order] OK"
