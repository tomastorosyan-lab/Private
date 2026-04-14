#!/bin/bash
# Скрипт для ручного запуска контейнеров без docker-compose

set -e

echo "🚀 Запуск проекта DIS вручную..."

# Создание сети
echo "📡 Создание Docker сети..."
docker network create dis_network 2>/dev/null || echo "Сеть уже существует"

# Запуск PostgreSQL
echo "🗄️  Запуск PostgreSQL..."
docker run -d \
  --name dis_db \
  --network dis_network \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dis_db \
  -p 5432:5432 \
  -v dis_postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Ожидание готовности БД
echo "⏳ Ожидание готовности PostgreSQL..."
sleep 5

# Запуск Backend
echo "🐍 Запуск Backend..."
cd backend
docker build -t dis_backend .
docker run -d \
  --name dis_backend \
  --network dis_network \
  -p 8000:8000 \
  -v $(pwd):/app \
  -e DATABASE_URL=postgresql://postgres:postgres@dis_db:5432/dis_db \
  -e SECRET_KEY=your-secret-key-change-in-production \
  dis_backend \
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
cd ..

# Запуск Frontend
echo "⚛️  Запуск Frontend..."
cd frontend
docker build -t dis_frontend .
docker run -d \
  --name dis_frontend \
  --network dis_network \
  -p 3000:3000 \
  -v $(pwd):/app \
  -v /app/node_modules \
  -v /app/.next \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
  dis_frontend \
  npm run dev
cd ..

echo "✅ Все сервисы запущены!"
echo ""
echo "Проверьте статус:"
echo "  docker ps"
echo ""
echo "Остановить все:"
echo "  docker stop dis_db dis_backend dis_frontend"
echo "  docker rm dis_db dis_backend dis_frontend"




