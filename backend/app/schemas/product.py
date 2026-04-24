"""
Схемы для товаров
"""
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal


class ProductResponse(BaseModel):
    id: int = Field(..., description="Уникальный идентификатор товара")
    name: str = Field(..., description="Название товара", example="Молоко цельное 3.2%")
    description: Optional[str] = Field(None, description="Описание товара")
    category_id: Optional[int] = Field(None, description="ID категории товара")
    category: Optional[str] = Field(None, description="Категория товара", example="Молочные продукты")
    category_path: Optional[str] = Field(None, description="Полный путь категории", example="Молочные продукты > Сыры")
    unit: str = Field(..., description="Единица измерения (всегда 'шт')", example="шт")
    items_per_box: Optional[int] = Field(None, description="Количество штук в коробке", example=12)
    image_url: Optional[str] = Field(None, description="URL изображения товара")
    supplier_id: int = Field(..., description="ID поставщика (пользователь типа supplier)")
    
    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str = Field(..., description="Название товара", example="Молоко цельное 3.2%")
    description: Optional[str] = Field(None, description="Описание товара")
    category_id: Optional[int] = Field(None, description="ID категории товара")
    category: Optional[str] = Field(None, description="Категория товара", example="Молочные продукты")
    category_path: Optional[str] = Field(None, description="Полный путь категории", example="Молочные продукты > Сыры")
    unit: str = Field(default="шт", description="Единица измерения (всегда 'шт')", example="шт")
    items_per_box: Optional[int] = Field(None, description="Количество штук в коробке", example=12, ge=1)
    quantity: Optional[Decimal] = Field(None, description="Количество товара в наличии (опционально, для создания остатков)", ge=0, example=100.5)
    price: Optional[Decimal] = Field(None, description="Цена за единицу товара (опционально, для создания остатков)", gt=0, example=150.00)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Название товара")
    description: Optional[str] = Field(None, description="Описание товара")
    category_id: Optional[int] = Field(None, description="ID категории товара")
    category: Optional[str] = Field(None, description="Категория товара")
    category_path: Optional[str] = Field(None, description="Полный путь категории")
    unit: Optional[str] = Field(None, description="Единица измерения (всегда 'шт')")
    items_per_box: Optional[int] = Field(None, description="Количество штук в коробке", ge=1)
    image_url: Optional[str] = Field(None, description="URL изображения товара")
    quantity: Optional[Decimal] = Field(
        None,
        description="Остаток на складе (обновляет связанную запись inventory поставщика товара)",
        ge=0,
    )
    price: Optional[Decimal] = Field(
        None,
        description="Цена за единицу, ₽ (inventory)",
        gt=0,
    )


class ProductSearch(BaseModel):
    query: Optional[str] = Field(None, description="Текстовый поиск по названию и описанию", example="молоко")
    category_id: Optional[int] = Field(None, description="Фильтр по ID категории")
    category: Optional[str] = Field(None, description="Фильтр по категории", example="Молочные продукты")
    supplier_id: Optional[int] = Field(None, description="Фильтр по поставщику")
    min_price: Optional[Decimal] = Field(None, description="Минимальная цена", example=100.00)
    max_price: Optional[Decimal] = Field(None, description="Максимальная цена", example=500.00)
    in_stock: Optional[bool] = Field(None, description="Только товары в наличии")

