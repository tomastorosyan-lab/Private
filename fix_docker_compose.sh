#!/bin/bash
# Скрипт для исправления проблемы с docker-compose

echo "🔧 Исправление проблемы с docker-compose..."

# Вариант 1: Установить python3-setuptools (содержит distutils)
echo "Попытка 1: Установка python3-setuptools..."
sudo apt-get update
sudo apt-get install -y python3-setuptools

if [ $? -eq 0 ]; then
    echo "✅ python3-setuptools установлен!"
    echo "Попробуйте запустить: docker-compose up -d"
    exit 0
fi

# Вариант 2: Установить docker-compose-v2
echo "Попытка 2: Установка docker-compose-v2..."
sudo apt-get install -y docker-compose-v2

if [ $? -eq 0 ]; then
    echo "✅ docker-compose-v2 установлен!"
    echo "Используйте команду: docker compose up -d (без дефиса)"
    exit 0
fi

# Вариант 3: Скачать docker-compose напрямую
echo "Попытка 3: Скачивание docker-compose напрямую..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

if [ $? -eq 0 ]; then
    echo "✅ docker-compose установлен из GitHub!"
    echo "Попробуйте запустить: docker-compose up -d"
    exit 0
fi

echo "❌ Не удалось установить docker-compose автоматически"
echo "Используйте ручной запуск: ./start_manual.sh"





