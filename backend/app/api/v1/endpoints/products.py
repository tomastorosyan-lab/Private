"""
Эндпоинты для работы с товарами
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.permissions import require_supplier
from app.core.upload import save_uploaded_file, delete_file
from app.models.user import User
from app.schemas.product import ProductResponse, ProductSearch, ProductCreate, ProductUpdate
from app.services.product_service import ProductService

router = APIRouter()


@router.get(
    "",
    response_model=List[ProductResponse],
    summary="Получение списка товаров",
    description="""
    Возвращает список товаров с возможностью фильтрации и пагинации.
    
    ### Параметры фильтрации:
    - **search** - поиск по названию и описанию товара
    - **supplier_id** - фильтр по поставщику
    - **category** - фильтр по категории товара
    
    ### Пагинация:
    - **skip** - количество пропущенных записей (для пагинации)
    - **limit** - максимальное количество записей (от 1 до 1000)
    """,
    response_description="Список товаров",
    tags=["Товары"]
)
async def get_products(
    skip: int = Query(0, ge=0, description="Количество пропущенных записей"),
    limit: int = Query(100, ge=1, le=1000, description="Максимальное количество записей"),
    search: Optional[str] = Query(None, description="Поисковый запрос (название или описание)"),
    supplier_id: Optional[int] = Query(None, description="ID поставщика для фильтрации"),
    category: Optional[str] = Query(None, description="Категория товара для фильтрации (legacy)"),
    category_id: Optional[int] = Query(None, description="ID категории товара для фильтрации"),
    include_hidden: bool = Query(False, description="Включать скрытые товары (для кабинета поставщика)"),
    db: Session = Depends(get_db)
):
    """
    Получение списка товаров с фильтрацией
    
    Возвращает список товаров с возможностью поиска, фильтрации по поставщику
    и категории, а также пагинации результатов.
    """
    service = ProductService(db)
    return await service.get_products(
        skip=skip,
        limit=limit,
        search=search,
        supplier_id=supplier_id,
        category=category,
        category_id=category_id,
        include_hidden=include_hidden,
    )


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Получение информации о товаре",
    description="Возвращает детальную информацию о конкретном товаре по его ID",
    response_description="Данные товара",
    tags=["Товары"]
)
async def get_product(
    product_id: int = Path(..., description="ID товара", example=1),
    db: Session = Depends(get_db)
):
    """
    Получение информации о товаре
    
    Возвращает полную информацию о товаре, включая название, описание,
    категорию, единицу измерения и информацию о поставщике.
    """
    service = ProductService(db)
    product = await service.get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    return product


@router.post(
    "/search",
    response_model=List[ProductResponse],
    summary="Расширенный поиск товаров",
    description="""
    Поиск товаров с расширенными параметрами фильтрации.
    
    ### Доступные параметры поиска:
    - **query** - текстовый поиск по названию и описанию
    - **category** - фильтр по категории
    - **supplier_id** - фильтр по поставщику
    - **min_price** - минимальная цена
    - **max_price** - максимальная цена
    - **in_stock** - только товары в наличии
    """,
    response_description="Список найденных товаров",
    tags=["Товары"]
)
async def search_products(
    search_params: ProductSearch,
    db: Session = Depends(get_db)
):
    """
    Расширенный поиск товаров
    
    Позволяет выполнить поиск товаров с использованием множественных критериев:
    текстовый поиск, фильтрация по цене, наличию, категории и поставщику.
    """
    service = ProductService(db)
    return await service.search_products(search_params)


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создание нового товара",
    description="""
    Создает новый товар. Доступно только для поставщиков (supplier) и администраторов.
    
    Товар автоматически привязывается к поставщику текущего пользователя.
    """,
    response_description="Данные созданного товара",
    tags=["Товары"]
)
async def create_product(
    product_data: ProductCreate,
    supplier_id: int = Query(..., description="ID поставщика (пользователь типа supplier)"),
    current_user: User = Depends(require_supplier()),
    db: Session = Depends(get_db)
):
    """
    Создание нового товара
    
    Поставщики могут создавать товары для себя.
    """
    service = ProductService(db)
    return await service.create_product(product_data, supplier_id, current_user)


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Обновление товара",
    description="Обновление информации о товаре. Доступно только для поставщиков и администраторов.",
    response_description="Обновленные данные товара",
    tags=["Товары"]
)
async def update_product(
    product_id: int = Path(..., description="ID товара"),
    product_data: ProductUpdate = ...,
    current_user: User = Depends(require_supplier()),
    db: Session = Depends(get_db)
):
    """
    Обновление товара
    
    Поставщики могут обновлять только свои товары.
    """
    service = ProductService(db)
    return await service.update_product(product_id, product_data, current_user)


@router.post(
    "/{product_id}/image",
    response_model=ProductResponse,
    summary="Загрузка изображения товара",
    description="""
    Загружает изображение для товара.
    
    Поддерживаемые форматы: JPEG, PNG, GIF, WebP
    Максимальный размер: 5MB
    
    Старое изображение автоматически удаляется при загрузке нового.
    """,
    response_description="Обновленные данные товара с новым URL изображения",
    tags=["Товары"]
)
async def upload_product_image(
    product_id: int = Path(..., description="ID товара"),
    file: UploadFile = File(..., description="Изображение товара"),
    current_user: User = Depends(require_supplier()),
    db: Session = Depends(get_db)
):
    """
    Загрузка изображения товара
    
    Сохраняет загруженное изображение и обновляет image_url в товаре.
    """
    service = ProductService(db)
    product = await service.get_product_by_id(product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Проверяем права доступа
    if product.supplier_id != current_user.id and current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Нет прав на изменение этого товара")
    
    # Удаляем старое изображение, если оно есть
    if product.image_url:
        delete_file(product.image_url)
    
    # Сохраняем новый файл
    image_url = await save_uploaded_file(file, f"product_{product_id}")
    
    # Обновляем товар
    product_update = ProductUpdate(image_url=image_url)
    return await service.update_product(product_id, product_update, current_user)


@router.delete(
    "/{product_id}/image",
    response_model=ProductResponse,
    summary="Удаление изображения товара",
    description="Удаляет изображение товара.",
    response_description="Обновленные данные товара без изображения",
    tags=["Товары"]
)
async def delete_product_image(
    product_id: int = Path(..., description="ID товара"),
    current_user: User = Depends(require_supplier()),
    db: Session = Depends(get_db)
):
    """
    Удаление изображения товара
    """
    service = ProductService(db)
    product = await service.get_product_by_id(product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Проверяем права доступа
    if product.supplier_id != current_user.id and current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Нет прав на изменение этого товара")
    
    # Удаляем файл изображения
    if product.image_url:
        delete_file(product.image_url)
    
    # Обновляем товар
    product_update = ProductUpdate(image_url=None)
    return await service.update_product(product_id, product_update, current_user)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удаление товара",
    description="Удаление товара. Доступно только для поставщиков и администраторов.",
    tags=["Товары"]
)
async def delete_product(
    product_id: int = Path(..., description="ID товара"),
    current_user: User = Depends(require_supplier()),
    db: Session = Depends(get_db)
):
    """
    Удаление товара
    
    Поставщики могут удалять только свои товары.
    """
    service = ProductService(db)
    product = await service.get_product_by_id(product_id)
    
    # Удаляем изображение товара, если оно есть
    if product and product.image_url:
        delete_file(product.image_url)
    
    await service.delete_product(product_id, current_user)
    return None

