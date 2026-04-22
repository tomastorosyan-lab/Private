"""
Схемы для поставщиков (теперь это пользователи типа supplier)
"""
from decimal import Decimal
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DistributorResponse(BaseModel):
    """Схема для поставщика (пользователь типа supplier)"""
    id: int
    full_name: str  # Название компании/поставщика
    email: str
    description: Optional[str]
    contact_phone: Optional[str]
    integration_type: Optional[str]
    logo_url: Optional[str]  # URL логотипа компании
    is_active: bool
    created_at: datetime
    min_order_amount: Decimal = Field(
        default=Decimal("0"),
        description="Минимальная сумма заказа (₽), 0 — без ограничения",
    )
    
    class Config:
        from_attributes = True

