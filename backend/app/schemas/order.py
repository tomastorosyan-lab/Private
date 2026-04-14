"""
Схемы для заказов
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from app.models.order import OrderStatus


class OrderItemCreate(BaseModel):
    product_id: int = Field(..., description="ID товара", example=1)
    quantity: Decimal = Field(..., description="Количество товара", gt=0, example=10.5)
    price: Decimal = Field(..., description="Цена за единицу товара", gt=0, example=150.00)


class OrderCreate(BaseModel):
    supplier_id: int = Field(..., description="ID поставщика (пользователь типа supplier)", example=1)
    items: List[OrderItemCreate] = Field(..., description="Список товаров в заказе", min_items=1)
    delivery_address: str = Field(..., description="Адрес доставки", example="г. Москва, ул. Ленина, д. 1")
    contact_phone: Optional[str] = Field(None, description="Контактный телефон", example="+7 (999) 123-45-67")
    notes: Optional[str] = Field(None, description="Примечания к заказу", example="Доставить до 18:00")


class OrderItemResponse(BaseModel):
    id: int = Field(..., description="ID позиции заказа")
    product_id: int = Field(..., description="ID товара")
    quantity: Decimal = Field(..., description="Количество товара")
    price: Decimal = Field(..., description="Цена за единицу")
    total: Decimal = Field(..., description="Общая стоимость позиции")
    
    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int = Field(..., description="Уникальный идентификатор заказа")
    user_id: int = Field(..., description="ID пользователя, создавшего заказ")
    supplier_id: int = Field(..., description="ID поставщика (пользователь типа supplier)")
    status: OrderStatus = Field(..., description="Статус заказа")
    total_amount: Decimal = Field(..., description="Общая сумма заказа")
    delivery_address: str = Field(..., description="Адрес доставки")
    contact_phone: Optional[str] = Field(None, description="Контактный телефон")
    notes: Optional[str] = Field(None, description="Примечания к заказу")
    created_at: datetime = Field(..., description="Дата и время создания заказа")
    items: List[OrderItemResponse] = Field(..., description="Список позиций заказа")
    
    class Config:
        from_attributes = True


class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = Field(None, description="Новый статус заказа")
    notes: Optional[str] = Field(None, description="Обновленные примечания к заказу")

