# Миграция проекта на Hostland

Документ для перехода проекта `DIS` на Hostland (VPS + Docker Compose).

## 1) Что заказать на Hostland

Рекомендуемая база для вашего стека (FastAPI + Next.js + PostgreSQL):

- VPS с Ubuntu 22.04/24.04
- 2 vCPU, 4 GB RAM, 40+ GB SSD (минимум)
- Публичный IPv4
- Домен (можно на Hostland или внешний)

Если ожидается нагрузка, лучше сразу 4 vCPU / 8 GB RAM.

## 2) Целевая схема на сервере

- `frontend` (Next.js standalone) за Nginx
- `backend` (FastAPI/uvicorn) только во внутренней Docker-сети
- `db` (PostgreSQL) только во внутренней Docker-сети
- HTTPS через Nginx + Let's Encrypt

Важно: не публикуйте PostgreSQL наружу (`5432`) без необходимости.

## 3) Что подготовить заранее

### Доступы и переменные

- [ ] SSH-доступ к VPS (`root` или sudo-user)
- [ ] Домен и доступ к DNS-записям
- [ ] Production `SECRET_KEY` (`openssl rand -hex 32`)
- [ ] Production `DATABASE_URL`
- [ ] Production `CORS_ORIGINS` (с вашим доменом)

### Backup перед переключением

- [ ] Полный дамп PostgreSQL
- [ ] Копия `.env`
- [ ] Копия загруженных файлов (если используете `uploads/`)

## 4) Подготовка сервера

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git
sudo systemctl enable --now docker
```

Создайте рабочую директорию:

```bash
sudo mkdir -p /opt/dis
sudo chown -R $USER:$USER /opt/dis
cd /opt/dis
```

## 5) Перенос проекта на VPS

```bash
git clone <URL_ВАШЕГО_REPO> .
cp env.example .env
```

Отредактируйте `.env` под production:

- `SECRET_KEY` — новый длинный ключ
- `DATABASE_URL` — для контейнерной схемы обычно:
  `postgresql://postgres:<пароль>@db:5432/dis_db`
- `CORS_ORIGINS` — ваш домен, например:
  `["https://example.ru","https://www.example.ru"]`
- `NEXT_PUBLIC_API_URL=SAME_ORIGIN`

## 6) Docker Compose для production

Ваш текущий `docker-compose.yml` уже близок к нужному. Для production проверьте:

- у `backend` не должно быть `--reload`
- для `db` не открывайте порт `5432` наружу
- для `frontend` публикуется только `3000` (или вообще без публикации, если Nginx в той же сети)

Минимальный запуск:

```bash
docker compose up -d --build
docker compose ps
```

Миграции БД:

```bash
docker compose exec backend alembic upgrade head
```

## 7) Nginx и HTTPS

Пример прокси-конфига (`/etc/nginx/sites-available/dis`):

```nginx
server {
    server_name example.ru www.example.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Включить сайт:

```bash
sudo ln -s /etc/nginx/sites-available/dis /etc/nginx/sites-enabled/dis
sudo nginx -t
sudo systemctl reload nginx
```

Сертификат:

```bash
sudo certbot --nginx -d example.ru -d www.example.ru
```

## 8) Перенос данных PostgreSQL

На старом сервере:

```bash
pg_dump -Fc -h <OLD_HOST> -U <OLD_USER> <OLD_DB> > dis.dump
```

На новом (в контейнер `db`):

```bash
docker cp dis.dump dis_db:/tmp/dis.dump
docker exec -it dis_db pg_restore -U postgres -d dis_db /tmp/dis.dump
```

## 9) Переключение домена без простоя

1. Поднимите новый сервер полностью на временном домене/поддомене.
2. Проверьте:
   - `/health`
   - `/api/docs`
   - логин/регистрация
3. Уменьшите TTL DNS до 300 заранее.
4. Переключите `A`-запись домена на IP Hostland.
5. Мониторьте логи 1-2 часа после переключения.

## 10) Быстрый runbook (в день миграции)

- [ ] Freeze изменений в БД на старом окружении
- [ ] Финальный `pg_dump`
- [ ] Восстановление БД на Hostland
- [ ] `docker compose up -d --build`
- [ ] `alembic upgrade head`
- [ ] Smoke-тест
- [ ] Переключение DNS
- [ ] Проверка ошибок в логах

## 11) Команды проверки

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
curl -I https://example.ru
curl https://example.ru/health
```

## 12) Что я рекомендую сделать в репозитории до переезда

1. Добавить отдельный `docker-compose.prod.yml` (без `--reload`, без проброса 5432).
2. Добавить `nginx` конфиг для production в репозиторий.
3. Вынести секреты в `.env` только на сервере (не в git).
4. Настроить авто-бэкапы БД (cron + `pg_dump`).
