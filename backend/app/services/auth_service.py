"""
Сервис аутентификации
"""
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from datetime import datetime, timedelta, timezone
import secrets
from app.models.user import User, UserType
from app.schemas.auth import UserCreate, UserResponse, UserUpdate
from app.core.security import get_password_hash, verify_password, decode_access_token
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.inventory import Inventory
from app.models.email_verification import EmailVerification
from app.models.email_verification_event import EmailVerificationEvent
from app.models.password_reset_code import PasswordResetCode
from app.services.email_service import EmailService, EmailDeliveryError
from app.core.config import settings


class AuthService:
    def __init__(self, db: Session):
        self.db = db
    
    @staticmethod
    def _normalize_email(email: str) -> str:
        return email.strip().lower()

    async def send_registration_code(self, email: str) -> bool:
        normalized_email = self._normalize_email(email)
        existing_user = self.db.query(User.id).filter(User.email == normalized_email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует",
            )
        if not settings.EMAIL_VERIFICATION_ENABLED or not EmailService.is_verification_configured():
            return False

        code = f"{secrets.randbelow(1000000):06d}"
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.EMAIL_VERIFICATION_CODE_TTL_MINUTES)
        cooldown_seconds = max(0, int(settings.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS))

        row = self.db.query(EmailVerification).filter(EmailVerification.email == normalized_email).first()
        if row:
            last_sent_at = row.updated_at or row.created_at
            if last_sent_at is not None and cooldown_seconds > 0:
                seconds_from_last_send = (now - last_sent_at).total_seconds()
                if seconds_from_last_send < cooldown_seconds:
                    retry_after = int(cooldown_seconds - seconds_from_last_send + 0.999)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Код уже отправлялся недавно. Повторите через {retry_after} сек.",
                    )
            row.code_hash = get_password_hash(code)
            row.attempts = 0
            row.expires_at = expires_at
            row.verified_until = None
        else:
            row = EmailVerification(
                email=normalized_email,
                code_hash=get_password_hash(code),
                attempts=0,
                expires_at=expires_at,
                verified_until=None,
            )
            self.db.add(row)
        event = EmailVerificationEvent(
            email=normalized_email,
            requested_at=now,
        )
        self.db.add(event)
        self.db.commit()

        try:
            EmailService.send_registration_verification_code(normalized_email, code)
        except EmailDeliveryError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            )
        event.sent_at = datetime.now(timezone.utc)
        self.db.commit()
        return True

    async def confirm_registration_code(self, email: str, code: str) -> None:
        normalized_email = self._normalize_email(email)
        row = self.db.query(EmailVerification).filter(EmailVerification.email == normalized_email).first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Сначала запросите код подтверждения",
            )
        now = datetime.now(timezone.utc)
        if row.expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Код подтверждения истек. Запросите новый код",
            )
        if row.attempts >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Превышено число попыток ввода кода. Запросите новый код",
            )
        if not verify_password(code, row.code_hash):
            row.attempts += 1
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный код подтверждения",
            )

        row.verified_until = now + timedelta(minutes=settings.EMAIL_VERIFICATION_WINDOW_MINUTES)
        row.attempts = 0
        event = (
            self.db.query(EmailVerificationEvent)
            .filter(EmailVerificationEvent.email == normalized_email)
            .order_by(EmailVerificationEvent.requested_at.desc(), EmailVerificationEvent.id.desc())
            .first()
        )
        if event:
            event.validated_at = now
        self.db.commit()

    async def send_password_reset_code(self, email: str) -> None:
        normalized_email = self._normalize_email(email)
        user = self.db.query(User.id).filter(User.email == normalized_email).first()
        if not user:
            # Не раскрываем, зарегистрирован ли email.
            return
        if not EmailService.is_verification_configured():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email не настроен: заполните SMTP_HOST и SMTP_FROM_EMAIL на сервере.",
            )

        code = f"{secrets.randbelow(1000000):06d}"
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.PASSWORD_RESET_CODE_TTL_MINUTES)
        cooldown_seconds = max(0, int(settings.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS))

        row = self.db.query(PasswordResetCode).filter(PasswordResetCode.email == normalized_email).first()
        if row:
            last_sent_at = row.updated_at or row.created_at
            if last_sent_at is not None and cooldown_seconds > 0:
                seconds_from_last_send = (now - last_sent_at).total_seconds()
                if seconds_from_last_send < cooldown_seconds:
                    retry_after = int(cooldown_seconds - seconds_from_last_send + 0.999)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Код уже отправлялся недавно. Повторите через {retry_after} сек.",
                    )
            row.code_hash = get_password_hash(code)
            row.attempts = 0
            row.expires_at = expires_at
        else:
            row = PasswordResetCode(
                email=normalized_email,
                code_hash=get_password_hash(code),
                attempts=0,
                expires_at=expires_at,
            )
            self.db.add(row)
        self.db.commit()

        try:
            EmailService.send_password_reset_code(normalized_email, code)
        except EmailDeliveryError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            )
        row.updated_at = datetime.now(timezone.utc)
        self.db.commit()

    async def reset_password_with_code(
        self,
        email: str,
        code: str,
        password: str,
        password_confirm: str,
    ) -> None:
        if password != password_confirm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пароли не совпадают",
            )

        normalized_email = self._normalize_email(email)
        row = self.db.query(PasswordResetCode).filter(PasswordResetCode.email == normalized_email).first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Сначала запросите код сброса пароля",
            )

        now = datetime.now(timezone.utc)
        if row.expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Код сброса пароля истек. Запросите новый код",
            )
        if row.attempts >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Превышено число попыток ввода кода. Запросите новый код",
            )
        if not verify_password(code, row.code_hash):
            row.attempts += 1
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный код сброса пароля",
            )

        user = self.db.query(User).filter(User.email == normalized_email).first()
        if not user:
            self.db.delete(row)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не удалось сбросить пароль",
            )

        user.hashed_password = get_password_hash(password)
        self.db.delete(row)
        self.db.commit()

    async def register_user(self, user_data: UserCreate) -> User:
        """Регистрация нового пользователя"""
        normalized_email = self._normalize_email(user_data.email)
        # Проверка существования пользователя (проверяем только email, чтобы избежать проблем с enum)
        existing_user = self.db.query(User.id).filter(User.email == normalized_email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        
        # Создание нового пользователя
        # Для поставщиков автоматически устанавливаем тип интеграции "manual"
        hashed_password = get_password_hash(user_data.password)
        integration_type = "manual" if user_data.user_type == UserType.SUPPLIER else None
        
        verification_required = settings.EMAIL_VERIFICATION_ENABLED and EmailService.is_verification_configured()
        verification = self.db.query(EmailVerification).filter(EmailVerification.email == normalized_email).first()
        now = datetime.now(timezone.utc)
        if verification_required and (not verification or not verification.verified_until or verification.verified_until < now):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Подтвердите email кодом перед регистрацией",
            )

        new_user = User(
            email=normalized_email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            user_type=user_data.user_type,
            integration_type=integration_type
        )
        
        self.db.add(new_user)
        self.db.commit()
        self.db.refresh(new_user)

        # Одноразовое подтверждение: после регистрации удаляем запись кода
        if verification:
            self.db.delete(verification)
            self.db.commit()
        
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

        if "min_order_amount" in user_update.model_fields_set:
            if user.user_type != UserType.SUPPLIER:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Минимальную сумму заказа может задавать только поставщик",
                )
            if user_update.min_order_amount is None:
                user.min_order_amount = Decimal("0")
            else:
                user.min_order_amount = user_update.min_order_amount

        if "telegram_notifications_enabled" in user_update.model_fields_set:
            if user.user_type != UserType.SUPPLIER:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Telegram-уведомления о заказах доступны только поставщикам",
                )
            if user_update.telegram_notifications_enabled and not user.telegram_chat_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Сначала подключите Telegram-бота",
                )
            user.telegram_notifications_enabled = bool(user_update.telegram_notifications_enabled)
        
        self.db.commit()
        self.db.refresh(user)
        
        return user

    async def create_telegram_connect_code(self, user_id: int) -> str:
        """Создает одноразовый код для привязки Telegram-чата поставщика."""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден",
            )
        if user.user_type != UserType.SUPPLIER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Telegram-уведомления доступны только поставщикам",
            )

        code = secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8].upper()
        while self.db.query(User.id).filter(User.telegram_connect_code == code).first():
            code = secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8].upper()

        user.telegram_connect_code = code
        self.db.commit()
        return code

    async def disconnect_telegram(self, user_id: int) -> User:
        """Отключает Telegram-уведомления текущего поставщика."""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден",
            )
        if user.user_type != UserType.SUPPLIER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Telegram-уведомления доступны только поставщикам",
            )
        user.telegram_chat_id = None
        user.telegram_notifications_enabled = False
        user.telegram_connect_code = None
        self.db.commit()
        self.db.refresh(user)
        return user

    async def get_users(
        self,
        skip: int = 0,
        limit: int = 200,
        search: str | None = None,
    ) -> list[User]:
        """Список пользователей для администратора"""
        query = self.db.query(User)
        if search:
            q = f"%{search}%"
            query = query.filter(
                or_(
                    User.email.ilike(q),
                    User.full_name.ilike(q),
                )
            )
        return query.order_by(User.id.asc()).offset(skip).limit(limit).all()

    async def delete_user_hard(self, user_id: int, current_user_id: int) -> None:
        """
        Полное удаление пользователя и связанных данных (админ-функция).
        """
        if user_id == current_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя удалить текущего администратора",
            )

        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь не найден",
            )

        # 1) Удаляем заказы пользователя (как заказчик и как поставщик) и их позиции.
        order_ids = [
            row.id
            for row in self.db.query(Order.id)
            .filter(or_(Order.user_id == user_id, Order.supplier_id == user_id))
            .all()
        ]
        if order_ids:
            self.db.query(OrderItem).filter(OrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
            self.db.query(Order).filter(Order.id.in_(order_ids)).delete(synchronize_session=False)

        # 2) Удаляем товары поставщика и связанные с ними позиции/остатки.
        product_ids = [
            row.id
            for row in self.db.query(Product.id)
            .filter(Product.supplier_id == user_id)
            .all()
        ]
        if product_ids:
            self.db.query(OrderItem).filter(OrderItem.product_id.in_(product_ids)).delete(synchronize_session=False)
            self.db.query(Inventory).filter(Inventory.product_id.in_(product_ids)).delete(synchronize_session=False)
            self.db.query(Product).filter(Product.id.in_(product_ids)).delete(synchronize_session=False)

        # 3) Страховочно удаляем остатки, если остались строки по supplier_id.
        self.db.query(Inventory).filter(Inventory.supplier_id == user_id).delete(synchronize_session=False)

        # 4) Удаляем пользователя.
        self.db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
        self.db.commit()

