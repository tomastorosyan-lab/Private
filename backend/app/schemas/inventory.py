"""
Схемы для остатков товаров
"""
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime


class InventoryResponse(BaseModel):
    id: int = Field(..., description="Уникальный идентификатор записи об остатке")
    product_id: int = Field(..., description="ID товара")
    supplier_id: int = Field(..., description="ID поставщика (пользователь типа supplier)")
    quantity: Decimal = Field(..., description="Количество товара в наличии", ge=0, example=100.5)
    price: Decimal = Field(..., description="Цена товара", gt=0, example=150.00)
    last_synced_at: Optional[datetime] = Field(None, description="Дата и время последней синхронизации")
    sync_source: Optional[str] = Field(None, description="Источник данных (api, file, manual)", example="api")
    
    class Config:
        from_attributes = True


class InventoryCreate(BaseModel):
    """Схема для создания остатков товара"""
    product_id: int = Field(..., description="ID товара", example=1)
    quantity: Decimal = Field(..., description="Количество товара в наличии", ge=0, example=100.5)
    price: Decimal = Field(..., description="Цена за единицу товара", gt=0, example=150.00)


class InventoryUpdate(BaseModel):
    """Схема для обновления остатков товара"""
    quantity: Optional[Decimal] = Field(None, description="Количество товара в наличии", ge=0, example=100.5)
    price: Optional[Decimal] = Field(None, description="Цена за единицу товара", gt=0, example=150.00)


class InventorySyncRequest(BaseModel):
    supplier_id: Optional[int] = Field(None, description="ID поставщика для синхронизации. Если не указан - синхронизируются все", example=1)
    force: bool = Field(False, description="Принудительная синхронизация (даже если недавно уже была)")

