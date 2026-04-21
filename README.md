# DIS — агрегатор поставщиков

Сервис для заказчиков и поставщиков оптовой продукции: каталог, остатки, заказы.

## Стек

| Часть    | Технологии                          |
|----------|-------------------------------------|
| Backend  | FastAPI, PostgreSQL, SQLAlchemy, JWT |
| Frontend | Next.js 14, TypeScript, Tailwind    |
| Запуск   | Docker Compose                      |

## Быстрый старт (Docker)

1. Скопируйте окружение:
   ```bash
   cp env.example .env
   ```
   Заполните `SECRET_KEY` и при необходимости `CORS_ORIGINS` / `NEXT_PUBLIC_API_URL` (см. комментарии в `env.example`).

2. Поднимите сервисы:
   ```bash
   # Рекомендуется Docker Compose v2.
   # Если у вас нет `docker compose`, а старый `docker-compose` падает с ошибкой `KeyError: 'ContainerConfig'`
   # на новых версиях Docker Engine — установите compose v2 в ./bin одной командой:
   bash scripts/install-compose-v2.sh

   ./bin/docker-compose up -d --build
   ```

3. Миграции БД:
   ```bash
   docker exec dis_backend alembic upgrade head
   ```

4. Откройте в браузере:
   - Frontend: http://localhost:3000  
   - API docs: http://localhost:8000/api/docs  
   - Health: http://localhost:8000/health  

**Один порт для фронта и API (телефон в Wi‑Fi, туннель):** см. профиль `tunnel` в `docker-compose.yml` и скрипт `scripts/start-internet-tunnel.sh`.

## Структура

```
dis/
├── backend/           # FastAPI (app/, alembic/, tests/)
├── frontend/          # Next.js (src/app, src/lib)
├── nginx/             # proxy для режима tunnel (порт 8080)
├── scripts/           # вспомогательные скрипты (туннель)
├── docker-compose.yml
├── env.example        # пример переменных для .env в корне
└── START_HERE.md      # пошаговый деплой в Yandex Cloud
```

## Деплой в облако

Полная пошаговая инструкция: **[START_HERE.md](./START_HERE.md)** (Yandex Cloud: Registry, PostgreSQL, контейнеры).

## Деплой на Hostland (VPS)

- Пошаговый план миграции: **[HOSTLAND_MIGRATION.md](./HOSTLAND_MIGRATION.md)**
- Production compose: `docker-compose.prod.yml`

Быстрый запуск на сервере:

```bash
cp env.example .env
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### Автодеплой (GitHub Actions)

В репозитории есть workflow: `.github/workflows/deploy-prod.yml`.
Он запускается при `push` в `main` и выполняет на сервере `/opt/dis/scripts/deploy-prod.sh`.

Нужно добавить GitHub Secrets в репозитории:

- `SSH_HOST` (например `178.212.12.157`)
- `SSH_PORT` (обычно `22`)
- `SSH_USER` (например `root`)
- `SSH_PRIVATE_KEY` (приватный ключ для входа на сервер)

## Разработка без Docker

**Backend:** `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` — задайте `DATABASE_URL`, затем `uvicorn app.main:app --reload`.

**Frontend:** `cd frontend && npm ci && npm run dev`.

## Тесты

```bash
docker exec dis_backend pytest /app/tests -q
```

## Лицензия

MIT
