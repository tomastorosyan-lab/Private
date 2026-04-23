"""
Эндпоинты для работы с категориями товаров
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.categories import sync_categories_to_db
from app.core.database import get_db
from app.models.category import Category

router = APIRouter()


@router.get(
    "",
    summary="Получение списка категорий товаров",
    description="Возвращает список всех доступных категорий товаров",
    response_description="Список категорий",
    tags=["Категории"]
)
async def get_categories(db: Session = Depends(get_db)):
    """
    Получение списка категорий товаров
    
    Возвращает предопределенный список категорий, из которых можно выбирать при создании товара.
    """
    sync_categories_to_db(db)
    rows = db.query(Category).filter(Category.is_active == True).order_by(Category.id.asc()).all()
    tree = [
        {
            "id": row.id,
            "parent_id": row.parent_id,
            "slug": row.slug,
            "name": row.name,
        }
        for row in rows
    ]
    ids_with_children = {row.parent_id for row in rows if row.parent_id is not None}
    leaves = [row for row in rows if row.id not in ids_with_children]
    by_id = {row.id: row for row in rows}

    category_path_by_leaf = {}
    for leaf in leaves:
        parent = by_id.get(leaf.parent_id) if leaf.parent_id is not None else None
        category_path_by_leaf[leaf.name] = f"{parent.name} > {leaf.name}" if parent else leaf.name

    return {
        "categories": [row.name for row in leaves],
        "tree": tree,
        "category_path_by_leaf": category_path_by_leaf,
    }





