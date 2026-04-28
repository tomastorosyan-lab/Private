"""
Эндпоинты аутентификации
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app.core.database import get_db
from app.core.security import create_access_token
from app.core.config import settings
from app.core.dependencies import get_current_user as get_current_user_dep
from app.core.permissions import require_admin
from app.core.rate_limit import auth_rate_limiter, get_client_ip
from app.core.upload import save_uploaded_file, delete_file
from app.schemas.auth import (
    Token,
    UserCreate,
    UserResponse,
    UserUpdate,
    EmailVerificationRequest,
    EmailVerificationConfirm,
    EmailVerificationResponse,
)
from app.services.auth_service import AuthService
from app.models.user import User

router = APIRouter()


@router.post(
    "/register/send-code",
    response_model=EmailVerificationResponse,
    summary="Отправка кода подтверждения на email",
    tags=["Аутентификация"],
)
async def send_register_code(
    request: Request,
    payload: EmailVerificationRequest,
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    normalized_email = payload.email.strip().lower()
    auth_rate_limiter.check(
        f"register-code:ip:{client_ip}",
        limit=settings.AUTH_SEND_CODE_IP_LIMIT_PER_HOUR,
        window_seconds=3600,
        detail="Слишком много запросов кода с этого IP",
    )
    auth_rate_limiter.check(
        f"register-code:email:{normalized_email}",
        limit=settings.AUTH_SEND_CODE_EMAIL_LIMIT_PER_HOUR,
        window_seconds=3600,
        detail="Слишком много запросов кода для этого email",
    )
    service = AuthService(db)
    verification_required = await service.send_registration_code(payload.email)
    if verification_required:
        return {
            "message": "Код подтверждения отправлен на email",
            "verification_required": True,
        }
    return {
        "message": "Email-подтверждение временно недоступно, регистрацию можно завершить без кода",
        "verification_required": False,
    }


@router.post(
    "/register/confirm-code",
    response_model=EmailVerificationResponse,
    summary="Подтверждение кода регистрации",
    tags=["Аутентификация"],
)
async def confirm_register_code(
    payload: EmailVerificationConfirm,
    db: Session = Depends(get_db),
):
    service = AuthService(db)
    await service.confirm_registration_code(payload.email, payload.code)
    return {"message": "Email успешно подтвержден"}


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Регистрация нового пользователя",
    description=    """
    Регистрация нового пользователя в системе.
    
    Поддерживаемые типы пользователей:
    - **supplier** - Поставщик (может создавать товары и управлять ими)
    - **customer** - Заказчик (может формировать заказы)
    - **admin** - Администратор (полный доступ)
    
    После успешной регистрации пользователь может войти в систему через эндпоинт /login.
    """,
    response_description="Данные созданного пользователя",
    tags=["Аутентификация"]
)
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Регистрация нового пользователя
    
    Создает нового пользователя в системе с указанным типом (поставщик или заказчик).
    Email должен быть уникальным.
    """
    client_ip = get_client_ip(request)
    normalized_email = user_data.email.strip().lower()
    auth_rate_limiter.check(
        f"register:ip:{client_ip}",
        limit=settings.AUTH_REGISTER_IP_LIMIT_PER_HOUR,
        window_seconds=3600,
        detail="Слишком много попыток регистрации с этого IP",
    )
    auth_rate_limiter.check(
        f"register:email:{normalized_email}",
        limit=settings.AUTH_REGISTER_EMAIL_LIMIT_PER_HOUR,
        window_seconds=3600,
        detail="Слишком много попыток регистрации для этого email",
    )
    service = AuthService(db)
    return await service.register_user(user_data)


@router.post(
    "/login",
    response_model=Token,
    summary="Вход в систему",
    description="""
    Аутентификация пользователя и получение JWT токена.
    
    Используйте полученный токен для доступа к защищенным эндпоинтам.
    Токен передавайте в заголовке: `Authorization: Bearer <token>`
    
    Токен действителен в течение 30 минут (настраивается в конфигурации).
    """,
    response_description="JWT токен доступа",
    tags=["Аутентификация"]
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Вход в систему
    
    Проверяет учетные данные пользователя (email и пароль) и возвращает JWT токен.
    Используйте этот токен для авторизации в последующих запросах.
    """
    service = AuthService(db)
    user = await service.authenticate_user(form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Информация о текущем пользователе",
    description="""
    Возвращает информацию о текущем аутентифицированном пользователе.
    
    Требует валидный JWT токен в заголовке Authorization.
    """,
    response_description="Данные текущего пользователя",
    tags=["Аутентификация"]
)
async def get_current_user_info(
    current_user: User = Depends(get_current_user_dep)
):
    """
    Получение информации о текущем пользователе
    
    Извлекает информацию о пользователе из JWT токена.
    Используется для проверки авторизации и получения данных профиля.
    """
    return current_user


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Обновление профиля пользователя",
    description="""
    Обновляет данные текущего пользователя.
    
    Можно изменить:
    - Email (если он уникален)
    - Пароль
    - Полное имя
    - Описание (для поставщиков)
    - Контактный телефон
    - Настройки интеграции (для поставщиков)
    
    Нельзя изменить:
    - ID пользователя
    - Тип пользователя (supplier/customer/admin)
    """,
    response_description="Обновленные данные пользователя",
    tags=["Аутентификация"]
)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db)
):
    """
    Обновление профиля текущего пользователя
    
    Позволяет пользователю изменить свои данные, кроме ID и типа пользователя.
    """
    service = AuthService(db)
    return await service.update_user(current_user.id, user_update)


@router.post(
    "/me/logo",
    response_model=UserResponse,
    summary="Загрузка логотипа",
    description="""
    Загружает логотип для текущего пользователя.
    
    Поддерживаемые форматы: JPEG, PNG, GIF, WebP
    Максимальный размер исходного файла: 12MB; после обработки — WebP до 1MB
    
    Старый логотип автоматически удаляется при загрузке нового.
    """,
    response_description="Обновленные данные пользователя с новым URL логотипа",
    tags=["Аутентификация"]
)
async def upload_logo(
    file: UploadFile = File(..., description="Изображение логотипа"),
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db)
):
    """
    Загрузка логотипа пользователя
    
    Сохраняет загруженное изображение и обновляет logo_url в профиле пользователя.
    """
    service = AuthService(db)
    
    # Удаляем старый логотип, если он есть
    if current_user.logo_url:
        delete_file(current_user.logo_url)
    
    # Сохраняем новый файл
    logo_url = await save_uploaded_file(file, current_user.id)
    
    # Обновляем профиль пользователя
    user_update = UserUpdate(logo_url=logo_url)
    return await service.update_user(current_user.id, user_update)


@router.delete(
    "/me/logo",
    response_model=UserResponse,
    summary="Удаление логотипа",
    description="""
    Удаляет логотип текущего пользователя.
    """,
    response_description="Обновленные данные пользователя без логотипа",
    tags=["Аутентификация"]
)
async def delete_logo(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db)
):
    """
    Удаление логотипа пользователя
    
    Удаляет файл логотипа и очищает logo_url в профиле пользователя.
    """
    service = AuthService(db)
    
    # Удаляем файл, если он есть
    if current_user.logo_url:
        delete_file(current_user.logo_url)
    
    # Обновляем профиль пользователя
    user_update = UserUpdate(logo_url="")
    return await service.update_user(current_user.id, user_update)


@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="Список пользователей (admin)",
    tags=["Аутентификация"],
)
async def get_users_admin(
    skip: int = 0,
    limit: int = 200,
    search: str | None = None,
    _: User = Depends(require_admin()),
    db: Session = Depends(get_db),
):
    service = AuthService(db)
    return await service.get_users(skip=skip, limit=limit, search=search)


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Обновление пользователя (admin)",
    tags=["Аутентификация"],
)
async def update_user_admin(
    user_id: int,
    user_update: UserUpdate,
    _: User = Depends(require_admin()),
    db: Session = Depends(get_db),
):
    service = AuthService(db)
    return await service.update_user(user_id, user_update)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удаление пользователя (admin)",
    tags=["Аутентификация"],
)
async def delete_user_admin(
    user_id: int,
    current_user: User = Depends(require_admin()),
    db: Session = Depends(get_db),
):
    service = AuthService(db)
    await service.delete_user_hard(user_id=user_id, current_user_id=current_user.id)
    return None

