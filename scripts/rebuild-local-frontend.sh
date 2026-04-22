#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="dis_frontend:local-$(date +%s)"
CONTAINER_NAME="dis_frontend"
NETWORK_NAME="dis_default"

echo "[local] Rebuilding frontend image without cache..."
docker build --no-cache \
  -t "${IMAGE_TAG}" \
  --build-arg NEXT_PUBLIC_API_URL=SAME_ORIGIN \
  --build-arg INTERNAL_API_ORIGIN=http://backend:8000 \
  "${PROJECT_DIR}/frontend"

echo "[local] Removing old frontend container (if exists)..."
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

echo "[local] Starting fresh frontend container..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  --network "${NETWORK_NAME}" \
  -p 3000:3000 \
  "${IMAGE_TAG}" >/dev/null

echo "[local] Frontend restarted on http://localhost:3000"
echo "[local] Image tag: ${IMAGE_TAG}"
