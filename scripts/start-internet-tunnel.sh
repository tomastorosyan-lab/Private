#!/usr/bin/env bash
# Временная публичная ссылка через Cloudflare Quick Tunnel (бесплатно, URL меняется при каждом запуске).
# Требования: Docker; стек DIS уже собран с NEXT_PUBLIC_API_URL=SAME_ORIGIN; подняты db, backend, frontend.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Поднимаем nginx-шлюз на порту 8080 (профиль tunnel)..."
docker-compose --profile tunnel up -d gateway

echo ""
echo "==> Запуск Cloudflare Tunnel → http://127.0.0.1:8080"
echo "    Когда появится строка с https://....trycloudflare.com — это ваша ссылка в интернет."
echo "    Остановка: Ctrl+C (туннель закроется; контейнеры проекта останутся)."
echo ""

docker run --rm -it \
  --add-host=host.docker.internal:host-gateway \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate --url http://host.docker.internal:8080
