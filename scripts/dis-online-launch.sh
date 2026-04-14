#!/usr/bin/env bash
# Перезапуск DIS-сервиса онлайн (пересборка фронта + шлюз :8080 + туннель)
set -euo pipefail

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT"

# Несколько путей: GNOME, русское имя папки, ~/Desktop, плюс файл в проекте
DESKTOP_DIRS=()
while IFS= read -r d; do [[ -n "$d" && -d "$d" ]] && DESKTOP_DIRS+=("$d"); done < <(
  xdg-user-dir DESKTOP 2>/dev/null
  echo "$HOME/Рабочий стол"
  echo "$HOME/Desktop"
)
# уникальные существующие каталоги
LINK_FILES=("$PROJECT/DIS-ссылка.txt")
for d in "${DESKTOP_DIRS[@]}"; do
  [[ -d "$d" ]] || continue
  LINK_FILES+=("$d/DIS-ссылка.txt")
done

wait_http() {
  local url="$1" label="$2" max="${3:-30}"
  local i=0
  while [[ $i -lt "$max" ]]; do
    if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
      echo "OK: $label"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "ОШИБКА: за ${max}s не ответил $label ($url)" >&2
  return 1
}

extract_tunnel_url() {
  docker logs dis_cf_tunnel 2>&1 | { grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' || true; } | tail -1
}

wait_for_tunnel_url() {
  local u="" i=0
  while [[ $i -lt 20 ]]; do
    u="$(extract_tunnel_url)"
    [[ -n "$u" ]] && { echo "$u"; return 0; }
    sleep 2
    i=$((i + 1))
  done
  extract_tunnel_url
}

write_link_files() {
  local url="$1"
  local stamp
  stamp="$(date -Iseconds 2>/dev/null || date)"
  for f in "${LINK_FILES[@]}"; do
    {
      echo "DIS — ссылка для входа из интернета (Cloudflare Quick Tunnel)"
      echo "Обновлено: $stamp"
      echo ""
      if [[ -n "$url" ]]; then
        echo "$url"
        echo ""
        echo "Откройте в браузере (телефон/другой ПК). После каждого перезапуска туннеля адрес меняется."
      else
        echo "Ссылку пока не удалось прочитать из логов."
        echo "Выполните в терминале:"
        echo "  docker logs dis_cf_tunnel 2>&1 | grep -oE 'https://[a-zA-Z0-9.-]+\\.trycloudflare\\.com' | tail -1"
      fi
    } >"$f" || echo "Не удалось записать: $f (права?)" >&2
  done
  echo "Файл со ссылкой (и копии на рабочем столе):"
  printf '  %s\n' "${LINK_FILES[@]}"
}

echo "=== Пересборка frontend ==="
docker-compose build frontend

echo ""
echo "=== Шлюз :8080 (nginx) ==="
docker-compose --profile tunnel up -d gateway

echo ""
echo "=== Backend + frontend ==="
docker rm -f dis_backend 2>/dev/null || true
docker run -d \
  --name dis_backend \
  --network dis_default \
  --network-alias backend \
  -p 8000:8000 \
  -v "$PROJECT/backend":/app \
  -e DATABASE_URL=postgresql://postgres:postgres@db:5432/dis_db \
  --env-file "$PROJECT/.env" \
  dis_backend \
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

docker rm -f dis_frontend 2>/dev/null || true
docker run -d \
  --name dis_frontend \
  --network dis_default \
  -p 3000:3000 \
  dis_frontend

echo ""
echo "=== Ждём шлюз http://127.0.0.1:8080 ==="
wait_http "http://127.0.0.1:8080/" "шлюз 8080" 45

echo ""
echo "=== Перезапуск Cloudflare Tunnel ==="
if docker ps -a --format '{{.Names}}' | grep -qx 'dis_cf_tunnel'; then
  docker restart dis_cf_tunnel
else
  echo "Контейнер dis_cf_tunnel не найден. Создаём..."
  docker run -d --name dis_cf_tunnel \
    --add-host=host.docker.internal:host-gateway \
    cloudflare/cloudflared:latest \
    tunnel --no-autoupdate --url http://host.docker.internal:8080
fi

echo "Ожидаем регистрацию туннеля (до ~40 с, при необходимости)..."
sleep 5
PUB_URL="$(wait_for_tunnel_url || true)"

write_link_files "$PUB_URL"

if [[ -n "$PUB_URL" ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "ВАЖНО: после каждого перезапуска туннеля меняется ссылка."
  echo "Скопируйте эту (старая закладка не откроется):"
  echo ""
  echo "  $PUB_URL"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if curl -sf --max-time 20 "$PUB_URL/health" | grep -q healthy; then
    echo "Проверка: $PUB_URL/health — OK"
  else
    echo "Предупреждение: ссылка пока не отвечает — подождите 1–2 мин." >&2
  fi
else
  echo "" >&2
  echo "Не удалось получить URL автоматически — в файлах выше есть команда для ручной проверки." >&2
fi

echo ""
echo "=== Статус контейнеров ==="
docker ps --filter name=dis_ --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo ""
echo "Нажмите Enter для выхода..."
read -r
