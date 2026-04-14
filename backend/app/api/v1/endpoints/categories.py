"""
Эндпоинты для работы с категориями товаров
"""
from fastapi import APIRouter
from app.core.categories import PRODUCT_CATEGORIES

router = APIRouter()


@router.get(
    "",
    summary="Получение списка категорий товаров",
    description="Возвращает список всех доступных категорий товаров",
    response_description="Список категорий",
    tags=["Категории"]
)
async def get_categories():
    """
    Получение списка категорий товаров
    
    Возвращает предопределенный список категорий, из которых можно выбирать при создании товара.
    """
    return {"categories": PRODUCT_CATEGORIES}





