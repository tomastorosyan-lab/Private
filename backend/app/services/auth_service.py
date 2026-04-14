"""
Сервис аутентификации
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User, UserType
from app.schemas.auth import UserCreate, UserResponse, UserUpdate
from app.core.security import get_password_hash, verify_password, decode_access_token


class AuthService:
    def __init__(self, db: Session):
        self.db = db
    
    async def register_user(self, user_data: UserCreate) -> User:
        """Регистрация нового пользователя"""
        # Проверка существования пользователя (проверяем только email, чтобы избежать проблем с enum)
        existing_user = self.db.query(User.id).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        
        # Создание нового пользователя
        # Для поставщиков автоматически устанавливаем тип интеграции "manual"
        hashed_password = get_password_hash(user_data.password)
        integration_type = "manual" if user_data.user_type == UserType.SUPPLIER else None
        
        new_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            user_type=user_data.user_type,
            integration_type=integration_type
        )
        
        self.db.add(new_user)
        self.db.commit()
        self.db.refresh(new_user)
        
        return new_user
    
    async def authenticate_user(self, email: str, password: str) -> User | None:
        """Аутентификация пользователя"""
        user = self.db.query(User).filter(User.email == email).first()
        if not user:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Пользователь неактивен"
            )
        
        return user
    
    async def get_current_user(self, token: str) -> User:
        """Получение текущего пользователя по токену"""
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный токен"
            )
        
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный токен"
            )
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        return user
    
    async def update_user(self, user_id: int, user_update: UserUpdate) -> User:
        """Обновление данных пользователя"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден"
            )
        
        # Проверка уникальности email, если он изменяется
        if user_update.email and user_update.email != user.email:
            existing_user = self.db.query(User.id).filter(User.email == user_update.email).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Пользователь с таким email уже существует"
                )
            user.email = user_update.email
        
        # Обновление пароля
        if user_update.password:
            user.hashed_password = get_password_hash(user_update.password)
        
        # Обновление остальных полей
        if user_update.full_name is not None:
            user.full_name = user_update.full_name
        if user_update.description is not None:
            user.description = user_update.description
        if user_update.contact_phone is not None:
            user.contact_phone = user_update.contact_phone
        if user_update.integration_type is not None:
            user.integration_type = user_update.integration_type
        if user_update.integration_config is not None:
            user.integration_config = user_update.integration_config
        if user_update.logo_url is not None:
            user.logo_url = user_update.logo_url if user_update.logo_url else None
        if user_update.delivery_address is not None:
            user.delivery_address = user_update.delivery_address
        
        self.db.commit()
        self.db.refresh(user)
        
        return user

