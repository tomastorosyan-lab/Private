#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/dis"
BRANCH="${1:-main}"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="${APP_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

echo "[deploy] Start deploy branch: ${BRANCH}"
cd "${APP_DIR}"

# Docker Compose v2 (`docker compose`) или v1 (`docker-compose`) — на разных серверах по-разному.
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose -f "${COMPOSE_FILE}" "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() { docker-compose -f "${COMPOSE_FILE}" "$@"; }
else
  echo "[deploy] ERROR: need docker compose or docker-compose" >&2
  exit 1
fi

echo "[deploy] Fetch latest changes"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[deploy] Create pre-deploy backups"
mkdir -p "${BACKUP_DIR}"

# Backup PostgreSQL before any container recreation.
compose exec -T db pg_dump -U postgres -d dis_db > "${BACKUP_DIR}/db-${TIMESTAMP}.sql"
echo "[deploy] DB backup saved: ${BACKUP_DIR}/db-${TIMESTAMP}.sql"

# Backup uploaded media files so accidental volume issues are recoverable.
compose exec -T backend sh -lc 'cd /app && tar -czf - uploads' > "${BACKUP_DIR}/uploads-${TIMESTAMP}.tgz"
echo "[deploy] Uploads backup saved: ${BACKUP_DIR}/uploads-${TIMESTAMP}.tgz"

# Keep rolling backups for 14 days.
find "${BACKUP_DIR}" -type f -mtime +14 -delete

echo "[deploy] Build and restart containers"
compose up -d --build

# Применяем idempotent SQL-патчи схемы перед запуском backend-операций.
if ls "${APP_DIR}/scripts/sql/"*.sql >/dev/null 2>&1; then
  for sql_file in "${APP_DIR}"/scripts/sql/*.sql; do
    echo "[deploy] Apply SQL patch: ${sql_file}"
    compose exec -T db psql -U postgres -d dis_db -v ON_ERROR_STOP=1 < "${sql_file}"
  done
fi

# Отдельно пересобираем фронт без кэша — иначе Docker иногда оставляет старый слой Next.js и «изменений не видно».
echo "[deploy] Rebuild frontend image without cache and restart frontend container"
compose build --no-cache frontend
compose up -d frontend

echo "[deploy] Run DB migrations"
compose exec -T backend alembic upgrade head

echo "[deploy] Verify persistent mounts"
docker inspect dis_db --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -q '/var/lib/postgresql/data'
docker inspect dis_backend --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -q '/app/uploads'
echo "[deploy] Persistent mounts are configured"

echo "[deploy] Telegram polling status"
compose ps telegram_polling || true
compose logs --tail=50 telegram_polling || true

echo "[deploy] Call /api/v1/telegram/net-egress from backend container"
compose exec -T backend python3 - <<'PY'
import json
import urllib.request

url = "http://127.0.0.1:8000/api/v1/telegram/net-egress"
req = urllib.request.Request(url, method="GET")

with urllib.request.urlopen(req, timeout=30) as resp:
    body = resp.read().decode("utf-8", errors="replace")
    print(body)
PY

echo "[deploy] Health check (backend container)"
# Prefer checking the API directly inside the backend container (avoids nginx/cache/SSL edge cases).
for attempt in $(seq 1 20); do
  set +e
  compose exec -T backend python - <<'PY'
import json
import urllib.error
import urllib.request

url = "http://127.0.0.1:8000/health"
try:
    with urllib.request.urlopen(url, timeout=10) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        if resp.status != 200:
            raise SystemExit(f"health check failed: HTTP {resp.status}")
        data = json.loads(body)
        status = str(data.get("status", "")).lower()
        if status not in {"healthy", "ok"}:
            raise SystemExit(f"health check failed: unexpected payload: {data!r}")
except urllib.error.URLError as e:
    raise SystemExit(f"health check failed: {e}") from e
PY
  rc=$?
  set -e
  if [ "$rc" -eq 0 ]; then
    echo "[deploy] Health check passed on attempt ${attempt}"
    break
  fi
  if [ "${attempt}" -eq 20 ]; then
    echo "[deploy] Health check failed after ${attempt} attempts"
    exit 1
  fi
  echo "[deploy] Health check not ready yet (attempt ${attempt}), retrying in 3s..."
  sleep 3
done

echo "[deploy] Done"
