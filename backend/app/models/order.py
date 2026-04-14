"""
Модели заказов
"""
from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class OrderStatus(str, enum.Enum):
    """Статусы заказа"""
    PENDING = "pending"  # Ожидает обработки
    CONFIRMED = "confirmed"  # Подтвержден
    PROCESSING = "processing"  # В обработке
    SHIPPED = "shipped"  # Отправлен
    DELIVERED = "delivered"  # Доставлен
    CANCELLED = "cancelled"  # Отменен


class Order(Base):
    """Модель заказа"""
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Заказчик
    supplier_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Поставщик
    
    # В БД (Alembic) перечисление orderstatus — имена PENDING, CONFIRMED, ...
    # без values_callable ORM сравнивал бы со строчными значениями Python и фильтр по статусу не находил строки
    status = Column(
        Enum(
            OrderStatus,
            name="orderstatus",
            native_enum=True,
            create_type=False,
            values_callable=lambda cls: [m.name for m in cls],
        ),
        default=OrderStatus.PENDING,
    )
    total_amount = Column(Numeric(10, 2), nullable=False)
    
    delivery_address = Column(String, nullable=False)
    contact_phone = Column(String)
    notes = Column(String)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    user = relationship("User", back_populates="orders", foreign_keys=[user_id])
    supplier = relationship("User", back_populates="supplier_orders", foreign_keys=[supplier_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    """Модель позиции заказа"""
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    quantity = Column(Numeric(10, 2), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    total = Column(Numeric(10, 2), nullable=False)
    
    # Связи
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

