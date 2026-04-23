"""
Модель товара
"""
from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Product(Base):
    """Модель товара"""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    category = Column(String, index=True)
    category_path = Column(String, nullable=True, index=True)  # Полный путь категории (например "Бакалея > Макароны")
    unit = Column(String, nullable=False, default="шт")  # единица измерения - всегда "шт"
    items_per_box = Column(Integer, nullable=True)  # количество штук в коробке
    image_url = Column(String, nullable=True)  # URL изображения товара
    
    # Связь с поставщиком (пользователь типа supplier)
    supplier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    supplier = relationship("User", back_populates="products", foreign_keys=[supplier_id])
    category_ref = relationship("Category", foreign_keys=[category_id])
    
    # Остатки и цены хранятся в таблице Inventory
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    inventory = relationship("Inventory", back_populates="product")
    order_items = relationship("OrderItem", back_populates="product")

