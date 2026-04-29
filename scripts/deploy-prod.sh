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
git reset --hard "origin/${BRANCH}"

echo "[deploy] Create pre-deploy backups"
mkdir -p "${BACKUP_DIR}"

# Backup PostgreSQL before any container recreation.
db_backup_path="${BACKUP_DIR}/db-${TIMESTAMP}.sql"
if compose exec -T db pg_dump -U postgres -d dis_db > "${db_backup_path}"; then
  echo "[deploy] DB backup saved: ${db_backup_path}"
else
  rm -f "${db_backup_path}"
  echo "[deploy] WARNING: DB backup skipped (db service is not ready yet)"
fi

# Backup uploaded media files so accidental volume issues are recoverable.
uploads_backup_path="${BACKUP_DIR}/uploads-${TIMESTAMP}.tgz"
uploads_backup_ok=0
for attempt in $(seq 1 10); do
  if compose exec -T backend sh -lc 'cd /app && tar -czf - uploads' > "${uploads_backup_path}"; then
    uploads_backup_ok=1
    echo "[deploy] Uploads backup saved: ${uploads_backup_path}"
    break
  fi
  echo "[deploy] Uploads backup attempt ${attempt}/10 failed; backend may be restarting, retrying in 3s..."
  sleep 3
done

if [ "$uploads_backup_ok" -ne 1 ]; then
  rm -f "${uploads_backup_path}"
  echo "[deploy] WARNING: failed to backup uploads after retries; continuing deploy"
fi

# Keep rolling backups for 14 days.
find "${BACKUP_DIR}" -type f -mtime +14 -delete

echo "[deploy] Build and restart containers"
# Cleanup legacy container from previous project layout if it still holds port 3000.
docker rm -f dis_web >/dev/null 2>&1 || true
compose up -d --build --remove-orphans

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
# Удаляем контейнер frontend через compose, чтобы не ловить гонки recreate/remove.
compose rm -sf frontend || true
sleep 2
frontend_started=0
for attempt in $(seq 1 8); do
  if compose up -d --no-deps frontend; then
    frontend_started=1
    break
  fi
  # Если compose снова споткнулся о старые контейнеры с именем dis_frontend — подчистим и повторим.
  stale_frontends="$(docker ps -aq --filter "name=dis_frontend")"
  if [ -n "${stale_frontends}" ]; then
    docker rm -f ${stale_frontends} || true
  fi
  echo "[deploy] Frontend recreate attempt ${attempt}/8 failed; retrying in 3s..."
  sleep 3
done

if [ "${frontend_started}" -ne 1 ]; then
  echo "[deploy] ERROR: failed to recreate frontend container after retries" >&2
  exit 1
fi

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

echo "[deploy] Host-level upstream checks"
curl -fsS --max-time 10 "http://127.0.0.1:8000/health" >/dev/null
curl -fsSI --max-time 10 "http://127.0.0.1:3000/" >/dev/null
echo "[deploy] Host upstreams are reachable"

echo "[deploy] Reload host nginx"
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx || systemctl restart nginx
else
  service nginx reload || service nginx restart
fi

echo "[deploy] Public health check through host nginx"
for attempt in $(seq 1 10); do
  if curl -fsS --max-time 15 "https://abkhazhub.ru/health" >/dev/null; then
    echo "[deploy] Public nginx health check passed on attempt ${attempt}"
    break
  fi
  if [ "${attempt}" -eq 10 ]; then
    echo "[deploy] ERROR: public nginx health check failed after ${attempt} attempts" >&2
    exit 1
  fi
  sleep 3
done

echo "[deploy] Done"
