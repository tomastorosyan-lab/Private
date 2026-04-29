"""
Главный файл приложения FastAPI
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.core.config import settings
from app.api.v1.router import api_router
from app.services.telegram_polling import TelegramPollingWorker


telegram_polling_worker = TelegramPollingWorker()


@asynccontextmanager
async def lifespan(app: FastAPI):
    telegram_polling_worker.start()
    try:
        yield
    finally:
        await telegram_polling_worker.stop()

app = FastAPI(
    title="DIS - Агрегатор поставщиков",
    description="""
    ## Сервис агрегации оптовой продукции для магазинов и ресторанов
    
    ### Основные возможности:
    
    * **Аутентификация** - регистрация и авторизация пользователей (поставщики и заказчики)
    * **Каталог товаров** - поиск и фильтрация товаров от разных поставщиков
    * **Управление заказами** - создание, отслеживание и управление заказами
    * **Остатки товаров** - синхронизация и отображение остатков у поставщиков
    * **Интеграции** - подключение систем учета поставщиков и магазинов
    
    ### Типы пользователей:
    
    * **Заказчик (customer)** - может просматривать каталог, создавать заказы
    * **Поставщик (supplier)** - может создавать товары, управлять остатками, обрабатывать заказы
    * **Администратор (admin)** - полный доступ к системе
    """,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    contact={
        "name": "DIS Support",
        "email": "support@dis.example.com",
    },
    lifespan=lifespan,
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(api_router, prefix="/api/v1")

# Подключение статических файлов для загрузок
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")


@app.get(
    "/",
    summary="Главная страница API",
    description="Возвращает информацию о версии API",
    tags=["Общее"]
)
async def root():
    """
    Главная страница API
    
    Возвращает базовую информацию о сервисе и версии API.
    """
    return {"message": "DIS API", "version": "1.0.0"}


@app.get(
    "/health",
    summary="Проверка здоровья сервиса",
    description="Эндпоинт для проверки работоспособности API",
    tags=["Общее"]
)
async def health_check():
    """
    Health check эндпоинт
    
    Используется для мониторинга состояния сервиса.
    Возвращает статус "healthy" если сервис работает корректно.
    """
    return {"status": "healthy"}

