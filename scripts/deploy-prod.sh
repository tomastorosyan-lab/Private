#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/dis"
BRANCH="${1:-main}"

echo "[deploy] Start deploy branch: ${BRANCH}"
cd "${APP_DIR}"

echo "[deploy] Fetch latest changes"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[deploy] Build and restart containers"
docker compose -f docker-compose.prod.yml up -d --build

echo "[deploy] Run DB migrations"
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

echo "[deploy] Health check (backend container)"
# Prefer checking the API directly inside the backend container (avoids nginx/cache/SSL edge cases).
if docker compose -f docker-compose.prod.yml exec -T backend sh -lc 'command -v curl >/dev/null 2>&1'; then
  docker compose -f docker-compose.prod.yml exec -T backend sh -lc 'curl -fsS http://127.0.0.1:8000/health >/dev/null'
elif docker compose -f docker-compose.prod.yml exec -T backend sh -lc 'command -v wget >/dev/null 2>&1'; then
  docker compose -f docker-compose.prod.yml exec -T backend sh -lc 'wget -qO- http://127.0.0.1:8000/health >/dev/null'
else
  echo "[deploy] WARN: curl/wget not found in backend image; falling back to public URL check"
  curl -fsS https://abkhazhub.ru/health >/dev/null
fi

echo "[deploy] Done"
