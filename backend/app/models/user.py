"""
Модель пользователя
"""
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class UserType(str, enum.Enum):
    """Типы пользователей"""
    SUPPLIER = "supplier"  # Поставщик
    CUSTOMER = "customer"  # Заказчик
    ADMIN = "admin"  # Администратор


class User(Base):
    """Модель пользователя (поставщик или заказчик)"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    user_type = Column(Enum(UserType), nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Дополнительные поля для поставщиков (опциональные для заказчиков)
    description = Column(Text, nullable=True)  # Описание компании/бизнеса
    contact_phone = Column(String, nullable=True)  # Контактный телефон
    integration_type = Column(String, nullable=True)  # Тип интеграции (api, file, manual)
    integration_config = Column(JSON, nullable=True)  # Конфигурация интеграции
    logo_url = Column(String, nullable=True)  # URL логотипа компании
    delivery_address = Column(String, nullable=True)  # Адрес доставки (для заказчиков)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    orders = relationship("Order", back_populates="user", foreign_keys="Order.user_id")
    supplier_orders = relationship("Order", back_populates="supplier", foreign_keys="Order.supplier_id")
    products = relationship("Product", back_populates="supplier")
    inventory = relationship("Inventory", back_populates="supplier")

