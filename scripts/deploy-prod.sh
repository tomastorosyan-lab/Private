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
docker compose -f docker-compose.prod.yml exec -T backend python - <<'PY'
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

echo "[deploy] Done"
