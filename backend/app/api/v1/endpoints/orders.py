"""
Эндпоинты для работы с заказами
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.permissions import require_customer, require_supplier
from app.models.user import User, UserType
from app.models.order import OrderStatus
from app.schemas.order import OrderCreate, OrderResponse, OrderUpdate
from app.services.order_service import OrderService

router = APIRouter()


@router.post(
    "",
    response_model=OrderResponse,
    status_code=201,
    summary="Создание нового заказа",
    description="""
    Создает новый заказ у указанного поставщика.
    
    ### Требования:
    - Пользователь должен быть заказчиком (customer) или администратором
    - Заказ должен содержать хотя бы одну позицию
    - Указан адрес доставки
    
    ### Статусы заказа:
    - **pending** - Ожидает обработки (начальный статус)
    - **confirmed** - Подтвержден
    - **processing** - В обработке
    - **shipped** - Отправлен
    - **delivered** - Доставлен
    - **cancelled** - Отменен
    """,
    response_description="Данные созданного заказа",
    tags=["Заказы"]
)
async def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(require_customer()),
    db: Session = Depends(get_db)
):
    """
    Создание нового заказа
    
    Создает новый заказ с указанными товарами у выбранного поставщика.
    Автоматически рассчитывается общая сумма заказа на основе цен и количества товаров.
    
    Доступно только для заказчиков (customer) и администраторов.
    """
    service = OrderService(db)
    return await service.create_order(order_data, user_id=current_user.id)


@router.get(
    "",
    response_model=List[OrderResponse],
    summary="Получение списка заказов",
    description="""
    Возвращает список заказов с пагинацией.
    
    Для аутентифицированных пользователей возвращаются только их заказы.
    Администраторы могут видеть все заказы.
    """,
    response_description="Список заказов",
    tags=["Заказы"]
)
async def get_orders(
    skip: int = Query(0, ge=0, description="Количество пропущенных записей"),
    limit: int = Query(100, ge=1, le=1000, description="Максимальное количество записей"),
    status: Optional[OrderStatus] = Query(
        None, description="Фильтр по статусу (например pending — ожидают обработки)"
    ),
    date_from: Optional[date] = Query(None, description="Дата начала периода, YYYY-MM-DD"),
    date_to: Optional[date] = Query(None, description="Дата конца периода, YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Получение списка заказов

    Возвращает список заказов текущего пользователя с поддержкой пагинации.
    """
    service = OrderService(db)
    return await service.get_orders(
        skip=skip,
        limit=limit,
        user_id=current_user.id,
        current_user=current_user,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )


@router.get(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Получение информации о заказе",
    description="Возвращает детальную информацию о конкретном заказе, включая все позиции",
    response_description="Данные заказа",
    tags=["Заказы"]
)
async def get_order(
    order_id: int = Path(..., description="ID заказа", example=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получение информации о заказе
    
    Возвращает полную информацию о заказе: статус, список товаров,
    общую сумму, адрес доставки и контактную информацию.
    Пользователи могут видеть только свои заказы.
    """
    service = OrderService(db)
    return await service.get_order_by_id(
        order_id, 
        user_id=current_user.id,
        current_user=current_user
    )


@router.patch(
    "/{order_id}",
    response_model=OrderResponse,
    summary="Обновление заказа",
    description="""
    Обновляет информацию о заказе.
    
    Можно изменить:
    - Статус заказа
    - Примечания к заказу
    
    Изменение статуса доступно только поставщикам и администраторам.
    Пользователи могут изменять только свои заказы.
    """,
    response_description="Обновленные данные заказа",
    tags=["Заказы"]
)
async def update_order(
    order_id: int = Path(..., description="ID заказа", example=1),
    order_update: OrderUpdate = ...,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Обновление заказа
    
    Позволяет изменить статус заказа или добавить/изменить примечания.
    Обычно используется поставщиками для обновления статуса выполнения заказа.
    
    Статус заказа могут изменять только поставщики и администраторы.
    Владельцы заказа могут изменять только примечания.
    """
    service = OrderService(db)
    return await service.update_order(
        order_id, 
        order_update, 
        user_id=current_user.id,
        current_user=current_user
    )

