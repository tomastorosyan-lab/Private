# Multi-stage build для оптимизации размера образа
FROM node:20-alpine AS builder

WORKDIR /app

# Копирование package файлов
COPY package*.json ./

# Установка зависимостей
RUN npm ci

# URL API в браузере клиента (для LAN: docker-compose подставляет NEXT_PUBLIC_API_URL из .env при сборке)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG INTERNAL_API_ORIGIN=http://127.0.0.1:8000
ENV INTERNAL_API_ORIGIN=$INTERNAL_API_ORIGIN

# Копирование приложения
COPY . .

# Сборка приложения
RUN npm run build

# Production образ
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Копирование только необходимых файлов из standalone сборки
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

