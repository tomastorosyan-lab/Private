"""
Конфигурация приложения
"""
try:
    from pydantic_settings import BaseSettings
except ImportError:
    # Для совместимости со старыми версиями
    from pydantic import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # Основные настройки
    PROJECT_NAME: str = "DIS"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # База данных
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/dis_db"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS (127.0.0.1 и localhost — разные Origin в браузере)
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:8080",
    ]
    # Для Cloudflare Quick Tunnel (trycloudflare.com), если Origin меняется при каждом запуске
    CORS_ORIGIN_REGEX: Optional[str] = None
    
    # Настройки загрузки файлов
    UPLOAD_DIR: str = "uploads"
    # Максимальный размер исходного файла до обработки (байты)
    MAX_UPLOAD_SIZE: int = 12 * 1024 * 1024  # 12MB
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    # После обработки: единый формат WebP, размер файла не больше этого значения
    IMAGE_OUTPUT_MAX_BYTES: int = 1024 * 1024  # 1MB
    # Максимальная сторона после вписывания (px); при необходимости уменьшается, пока не уложимся в лимит
    IMAGE_OUTPUT_MAX_SIDE: int = 1600

    # Email-уведомления о новых заказах
    EMAIL_NOTIFICATIONS_ENABLED: bool = False
    ORDER_NOTIFICATION_EMAIL: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "DIS"
    PUBLIC_SITE_URL: str = "https://abkhazhub.ru"
    # Telegram-уведомления поставщикам о новых заказах
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_BOT_USERNAME: Optional[str] = None
    TELEGRAM_WEBHOOK_SECRET: Optional[str] = None
    TELEGRAM_POLLING_ENABLED: bool = True
    TELEGRAM_POLLING_TIMEOUT_SECONDS: int = 25
    # Email-верификация регистрации
    EMAIL_VERIFICATION_ENABLED: bool = False
    EMAIL_VERIFICATION_CODE_TTL_MINUTES: int = 10
    EMAIL_VERIFICATION_WINDOW_MINUTES: int = 30
    EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: int = 60
    AUTH_SEND_CODE_IP_LIMIT_PER_HOUR: int = 20
    AUTH_SEND_CODE_EMAIL_LIMIT_PER_HOUR: int = 5
    AUTH_REGISTER_IP_LIMIT_PER_HOUR: int = 10
    AUTH_REGISTER_EMAIL_LIMIT_PER_HOUR: int = 3
    PASSWORD_RESET_CODE_TTL_MINUTES: int = 10
    PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: int = 60
    PASSWORD_RESET_IP_LIMIT_PER_HOUR: int = 10
    PASSWORD_RESET_EMAIL_LIMIT_PER_HOUR: int = 5
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

