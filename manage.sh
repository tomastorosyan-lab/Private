#!/bin/bash
# Скрипт для управления контейнерами проекта DIS

case "$1" in
    start)
        echo "🚀 Запуск всех сервисов..."
        docker start dis_db dis_backend dis_frontend 2>/dev/null || {
            echo "Контейнеры не найдены. Запустите ./start_manual.sh для первого запуска"
        }
        ;;
    stop)
        echo "⏹️  Остановка всех сервисов..."
        docker stop dis_db dis_backend dis_frontend
        ;;
    restart)
        echo "🔄 Перезапуск всех сервисов..."
        docker restart dis_db dis_backend dis_frontend
        ;;
    status)
        echo "📊 Статус сервисов:"
        docker ps --filter "name=dis_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;
    logs)
        if [ -z "$2" ]; then
            echo "Просмотр логов всех сервисов (Ctrl+C для выхода)"
            docker-compose logs -f 2>/dev/null || docker logs -f dis_db dis_backend dis_frontend
        else
            echo "Логи сервиса: $2"
            docker logs -f "dis_$2"
        fi
        ;;
    rebuild)
        echo "🔨 Пересборка образов..."
        cd backend && docker build -t dis_backend . && cd ..
        cd frontend && docker build -t dis_frontend . && cd ..
        echo "✅ Образы пересобраны"
        ;;
    clean)
        echo "🧹 Остановка и удаление всех контейнеров..."
        docker stop dis_db dis_backend dis_frontend 2>/dev/null
        docker rm dis_db dis_backend dis_frontend 2>/dev/null
        echo "✅ Контейнеры удалены"
        ;;
    *)
        echo "Использование: $0 {start|stop|restart|status|logs [service]|rebuild|clean}"
        echo ""
        echo "Команды:"
        echo "  start    - Запустить все сервисы"
        echo "  stop     - Остановить все сервисы"
        echo "  restart  - Перезапустить все сервисы"
        echo "  status   - Показать статус сервисов"
        echo "  logs     - Показать логи (можно указать: db|backend|frontend)"
        echo "  rebuild  - Пересобрать образы"
        echo "  clean    - Удалить все контейнеры"
        echo ""
        echo "Примеры:"
        echo "  $0 start"
        echo "  $0 logs backend"
        echo "  $0 status"
        exit 1
        ;;
esac




