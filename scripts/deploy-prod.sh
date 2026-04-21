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

echo "[deploy] Health check"
curl -fsS https://abkhazhub.ru/health >/dev/null

echo "[deploy] Done"
