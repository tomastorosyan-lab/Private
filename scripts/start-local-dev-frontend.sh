#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${PROJECT_DIR}"

if ! docker ps --format '{{.Names}}' | grep -qx 'dis_backend'; then
  echo "[dev] backend container (dis_backend) is not running."
  echo "[dev] Start backend first, then rerun this script."
  exit 1
fi

echo "[dev] Starting frontend in Next.js dev mode (hot reload)..."
docker rm -f dis_frontend >/dev/null 2>&1 || true
docker run -d \
  --name dis_frontend \
  --network dis_default \
  -p 3000:3000 \
  -w /app \
  -e NEXT_PUBLIC_API_URL=SAME_ORIGIN \
  -e INTERNAL_API_ORIGIN=http://backend:8000 \
  -e WATCHPACK_POLLING=true \
  -e CHOKIDAR_USEPOLLING=true \
  -v "${PROJECT_DIR}/frontend":/app \
  -v dis_frontend_node_modules:/app/node_modules \
  node:20-alpine \
  sh -lc "npm ci && npm run dev -- --hostname 0.0.0.0 --port 3000"

echo "[dev] Frontend dev server is launching on http://localhost:3000"
echo "[dev] Logs: docker logs -f dis_frontend"
