"""
Эндпоинты для работы с поставщиками
"""
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.distributor import DistributorResponse
from app.services.distributor_service import DistributorService

router = APIRouter()


@router.get(
    "",
    response_model=List[DistributorResponse],
    summary="Получение списка поставщиков",
    description="""
    Возвращает список активных поставщиков в системе.
    
    Поставщики - это компании, которые предоставляют оптовую продукцию
    и могут предоставлять товары магазинам и ресторанам через платформу.
    """,
    response_description="Список поставщиков",
    tags=["Поставщики"]
)
async def get_distributors(
    skip: int = Query(0, ge=0, description="Количество пропущенных записей"),
    limit: int = Query(100, ge=1, le=1000, description="Максимальное количество записей"),
    db: Session = Depends(get_db)
):
    """
    Получение списка поставщиков
    
    Возвращает список всех активных поставщиков с поддержкой пагинации.
    """
    service = DistributorService(db)
    return await service.get_distributors(skip=skip, limit=limit)


@router.get(
    "/{distributor_id}",
    response_model=DistributorResponse,
    summary="Получение информации о поставщике",
    description="""
    Возвращает детальную информацию о конкретном поставщике.
    
    Включает контактную информацию, описание и настройки интеграции.
    """,
    response_description="Данные поставщика",
    tags=["Поставщики"]
)
async def get_distributor(
    distributor_id: int = Path(..., description="ID поставщика", example=1),
    db: Session = Depends(get_db)
):
    """
    Получение информации о поставщике
    
    Возвращает полную информацию о поставщике: название, описание,
    контактные данные и тип интеграции с системой учета.
    """
    service = DistributorService(db)
    return await service.get_distributor_by_id(distributor_id)

