"""
Схемы для аутентификации
"""
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserType


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="Email адрес пользователя", example="user@example.com")
    password: str = Field(..., description="Пароль пользователя (минимум 8 символов)", min_length=8, example="securepassword123")
    full_name: str = Field(..., description="Полное имя пользователя", example="Иван Иванов")
    user_type: UserType = Field(..., description="Тип пользователя: supplier (поставщик), customer (заказчик), admin (администратор)", example="customer")


class EmailVerificationRequest(BaseModel):
    email: EmailStr = Field(..., description="Email для отправки кода")


class EmailVerificationConfirm(BaseModel):
    email: EmailStr = Field(..., description="Email адрес пользователя")
    code: str = Field(..., description="6-значный код подтверждения", min_length=6, max_length=6)


class EmailVerificationResponse(BaseModel):
    message: str = Field(..., description="Результат операции")
    verification_required: bool = Field(
        default=True,
        description="Требуется ли подтверждение email кодом для завершения регистрации",
    )


class PasswordResetRequest(BaseModel):
    email: EmailStr = Field(..., description="Email для отправки кода сброса пароля")


class PasswordResetConfirm(BaseModel):
    email: EmailStr = Field(..., description="Email адрес пользователя")
    code: str = Field(..., description="6-значный код сброса пароля", min_length=6, max_length=6)
    password: str = Field(..., description="Новый пароль (минимум 8 символов)", min_length=8)
    password_confirm: str = Field(..., description="Повтор нового пароля", min_length=8)


class PasswordResetResponse(BaseModel):
    message: str = Field(..., description="Результат операции")


class UserResponse(BaseModel):
    id: int = Field(..., description="Уникальный идентификатор пользователя")
    email: str = Field(..., description="Email адрес пользователя")
    full_name: str = Field(..., description="Полное имя пользователя")
    user_type: UserType = Field(..., description="Тип пользователя")
    is_active: bool = Field(..., description="Активен ли пользователь")
    description: str | None = Field(None, description="Описание компании/бизнеса")
    contact_phone: str | None = Field(None, description="Контактный телефон")
    integration_type: str | None = Field(None, description="Тип интеграции")
    integration_config: dict | None = Field(None, description="Конфигурация интеграции")
    logo_url: str | None = Field(None, description="URL логотипа компании")
    delivery_address: str | None = Field(None, description="Адрес доставки (для заказчиков)")
    min_order_amount: Decimal = Field(
        default=Decimal("0"),
        description="Минимальная сумма заказа для поставщика (₽), 0 — без ограничения",
    )
    
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Схема для обновления данных пользователя"""
    email: EmailStr | None = Field(None, description="Email адрес пользователя", example="user@example.com")
    password: str | None = Field(None, description="Новый пароль (минимум 8 символов)", min_length=8, example="newpassword123")
    full_name: str | None = Field(None, description="Полное имя пользователя", example="Иван Иванов")
    description: str | None = Field(None, description="Описание компании/бизнеса")
    contact_phone: str | None = Field(None, description="Контактный телефон", example="+7 (999) 123-45-67")
    integration_type: str | None = Field(None, description="Тип интеграции (api, file, manual)")
    integration_config: dict | None = Field(None, description="Конфигурация интеграции")
    logo_url: str | None = Field(None, description="URL логотипа компании")
    delivery_address: str | None = Field(None, description="Адрес доставки (для заказчиков)", example="г. Москва, ул. Ленина, д. 1")
    min_order_amount: Decimal | None = Field(
        None,
        description="Минимальная сумма заказа для поставщика (₽), 0 — без ограничения",
        ge=0,
    )


class Token(BaseModel):
    access_token: str = Field(..., description="JWT токен доступа")
    token_type: str = Field(default="bearer", description="Тип токена")

