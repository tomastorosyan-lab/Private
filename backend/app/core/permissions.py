"""
Модуль для проверки прав доступа и ролей пользователей
"""
from functools import wraps
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, UserType
from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.core.exceptions import ForbiddenException


def require_role(*allowed_roles: UserType):
    """
    Декоратор для проверки роли пользователя
    
    Args:
        *allowed_roles: Разрешенные роли пользователей
    
    Usage:
        @require_role(UserType.ADMIN, UserType.SUPPLIER)
        async def some_endpoint(current_user: User = Depends(get_current_user)):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Извлекаем current_user из kwargs
            current_user = None
            for key, value in kwargs.items():
                if isinstance(value, User):
                    current_user = value
                    break
            
            # Если не нашли в kwargs, ищем в args (для методов)
            if not current_user:
                for arg in args:
                    if isinstance(arg, User):
                        current_user = arg
                        break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Требуется аутентификация"
                )
            
            if current_user.user_type not in allowed_roles:
                raise ForbiddenException(
                    f"Доступ запрещен. Требуются роли: {', '.join([role.value for role in allowed_roles])}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_any_role(*allowed_roles: UserType):
    """
    Зависимость FastAPI для проверки роли пользователя
    
    Используется как dependency в эндпоинтах.
    
    Args:
        *allowed_roles: Разрешенные роли пользователей
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            current_user: User = Depends(require_any_role(UserType.ADMIN))
        ):
            ...
    """
    async def role_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        if current_user.user_type not in allowed_roles:
            raise ForbiddenException(
                f"Доступ запрещен. Требуются роли: {', '.join([role.value for role in allowed_roles])}"
            )
        return current_user
    
    return role_checker


def require_admin():
    """Зависимость для проверки прав администратора"""
    return require_any_role(UserType.ADMIN)


def require_supplier():
    """Зависимость для проверки прав поставщика"""
    return require_any_role(UserType.SUPPLIER, UserType.ADMIN)


def require_customer():
    """Зависимость для проверки прав заказчика"""
    return require_any_role(UserType.CUSTOMER, UserType.ADMIN)


def can_modify_order(order_user_id: int, current_user: User, db: Session) -> bool:
    """
    Проверка прав на изменение заказа
    
    Заказ может изменять:
    - Владелец заказа (заказчик)
    - Поставщик, у которого сделан заказ
    - Администратор
    
    Args:
        order_user_id: ID пользователя, создавшего заказ
        current_user: Текущий пользователь
        db: Сессия БД
    
    Returns:
        True если пользователь может изменять заказ
    """
    # Администратор может все
    if current_user.user_type == UserType.ADMIN:
        return True
    
    # Владелец заказа может изменять свой заказ
    if current_user.id == order_user_id:
        return True
    
    # Поставщик может изменять заказы у себя
    if current_user.user_type == UserType.SUPPLIER:
        # Проверка будет в сервисе, т.к. нужен доступ к заказу
        return True
    
    return False


def can_view_order(order_user_id: int, order_supplier_id: int, current_user: User) -> bool:
    """
    Проверка прав на просмотр заказа
    
    Заказ могут просматривать:
    - Владелец заказа (заказчик)
    - Поставщик, у которого сделан заказ
    - Администратор
    
    Args:
        order_user_id: ID пользователя, создавшего заказ
        order_supplier_id: ID поставщика заказа
        current_user: Текущий пользователь
    
    Returns:
        True если пользователь может просматривать заказ
    """
    # Администратор может все
    if current_user.user_type == UserType.ADMIN:
        return True
    
    # Владелец заказа может просматривать свой заказ
    if current_user.id == order_user_id:
        return True
    
    # Поставщик может просматривать заказы у себя
    if current_user.user_type == UserType.SUPPLIER:
        # Нужно проверить, что поставщик соответствует заказу
        # Это будет проверяться в сервисе
        return True
    
    return False


def can_modify_supplier_data(supplier_id: int, current_user: User) -> bool:
    """
    Проверка прав на изменение данных поставщика
    
    Данные поставщика могут изменять:
    - Сам поставщик
    - Администратор
    
    Args:
        supplier_id: ID поставщика (пользователь типа supplier)
        current_user: Текущий пользователь
    
    Returns:
        True если пользователь может изменять данные
    """
    if current_user.user_type == UserType.ADMIN:
        return True
    
    # Поставщик может изменять свои данные
    if current_user.user_type == UserType.SUPPLIER:
        return current_user.id == supplier_id
    
    return False


def can_modify_product(product_supplier_id: int, current_user: User) -> bool:
    """
    Проверка прав на изменение товара
    
    Товар могут изменять:
    - Поставщик, которому принадлежит товар
    - Администратор
    
    Args:
        product_supplier_id: ID поставщика товара (пользователь типа supplier)
        current_user: Текущий пользователь
    
    Returns:
        True если пользователь может изменять товар
    """
    if current_user.user_type == UserType.ADMIN:
        return True
    
    # Поставщик может изменять свои товары
    if current_user.user_type == UserType.SUPPLIER:
        return current_user.id == product_supplier_id
    
    return False

