"""
Эндпоинты для работы с остатками товаров
"""
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.permissions import require_supplier
from app.schemas.inventory import InventoryResponse, InventorySyncRequest, InventoryCreate, InventoryUpdate
from app.services.inventory_service import InventoryService
from app.models.user import User

router = APIRouter()


@router.get(
    "/product/{product_id}",
    response_model=List[InventoryResponse],
    summary="Остатки товара у всех поставщиков",
    description="""
    Возвращает информацию об остатках конкретного товара у всех поставщиков.
    
    Позволяет сравнить цены и наличие товара у разных поставщиков.
    """,
    response_description="Список остатков товара у поставщиков",
    tags=["Остатки"]
)
async def get_product_inventory(
    product_id: int = Path(..., description="ID товара", example=1),
    db: Session = Depends(get_db)
):
    """
    Получение остатков товара у всех поставщиков
    
    Возвращает список всех поставщиков, у которых есть данный товар,
    с информацией о количестве, цене и дате последней синхронизации.
    """
    service = InventoryService(db)
    return await service.get_product_inventory(product_id)


@router.get(
    "/supplier/{supplier_id}",
    response_model=List[InventoryResponse],
    summary="Остатки всех товаров у поставщика",
    description="""
    Возвращает информацию об остатках всех товаров у конкретного поставщика.
    
    Полезно для просмотра полного каталога товаров поставщика с актуальными остатками.
    """,
    response_description="Список остатков товаров у поставщика",
    tags=["Остатки"]
)
async def get_supplier_inventory(
    supplier_id: int = Path(..., description="ID поставщика (пользователь типа supplier)", example=1),
    db: Session = Depends(get_db)
):
    """
    Получение остатков всех товаров у поставщика
    
    Возвращает полный список товаров поставщика с информацией
    об остатках, ценах и дате последней синхронизации.
    """
    service = InventoryService(db)
    return await service.get_supplier_inventory(supplier_id)


@router.post(
    "/sync",
    status_code=202,
    summary="Синхронизация остатков",
    description="""
    Запускает синхронизацию остатков товаров с внешними системами учета.
    
    ### Параметры:
    - **supplier_id** - ID поставщика для синхронизации (если не указан - синхронизируются все)
    - **force** - принудительная синхронизация (даже если недавно уже была)
    
    Синхронизация выполняется асинхронно. Возвращается ID задачи для отслеживания статуса.
    """,
    response_description="ID задачи синхронизации",
    tags=["Остатки"]
)
async def sync_inventory(
    sync_request: InventorySyncRequest,
    db: Session = Depends(get_db)
):
    """
    Запуск синхронизации остатков с внешними системами
    
    Инициирует процесс синхронизации остатков товаров с системами учета
    поставщиков (1С, SAP и др.). Синхронизация выполняется в фоновом режиме.
    """
    service = InventoryService(db)
    task_id = await service.sync_inventory(sync_request)
    return {"message": "Синхронизация запущена", "task_id": task_id}


@router.post(
    "",
    response_model=InventoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создание остатков товара",
    description="""
    Создает остатки товара для текущего поставщика.
    
    Поставщики могут создавать остатки только для своих товаров.
    """,
    response_description="Созданные остатки",
    tags=["Остатки"]
)
async def create_inventory(
    inventory_data: InventoryCreate,
    current_user: User = Depends(require_supplier()),
    db: Session = Depends(get_db)
):
    """
    Создание остатков товара
    
    Поставщики могут создавать остатки только для своих товаров.
    """
    service = InventoryService(db)
    return await service.create_inventory(inventory_data, current_user)


@router.patch(
    "/{inventory_id}",
    response_model=InventoryResponse,
    summary="Обновление остатков товара",
    description="""
    Обновляет остатки товара (количество и/или цену).
    
    Поставщики могут обновлять только свои остатки.
    """,
    response_description="Обновленные остатки",
    tags=["Остатки"]
)
async def update_inventory(
    inventory_id: int = Path(..., description="ID остатков", example=1),
    inventory_update: InventoryUpdate = ...,
    current_user: User = Depends(require_supplier()),
    db: Session = Depends(get_db)
):
    """
    Обновление остатков товара
    
    Поставщики могут обновлять только свои остатки.
    """
    service = InventoryService(db)
    return await service.update_inventory(inventory_id, inventory_update, current_user)


@router.delete(
    "/{inventory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удаление остатков товара",
    description="""
    Удаляет остатки товара.
    
    Поставщики могут удалять только свои остатки.
    """,
    tags=["Остатки"]
)
async def delete_inventory(
    inventory_id: int = Path(..., description="ID остатков", example=1),
    current_user: User = Depends(require_supplier()),
    db: Session = Depends(get_db)
):
    """
    Удаление остатков товара
    
    Поставщики могут удалять только свои остатки.
    """
    service = InventoryService(db)
    await service.delete_inventory(inventory_id, current_user)
    return None

