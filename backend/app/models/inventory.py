"""
Модель остатков товаров
"""
from sqlalchemy import Column, Integer, Numeric, ForeignKey, DateTime, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Inventory(Base):
    """Модель остатков товара у поставщика"""
    __tablename__ = "inventory"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Поставщик (пользователь типа supplier)
    
    quantity = Column(Numeric(10, 2), nullable=False, default=0)
    price = Column(Numeric(10, 2), nullable=False)
    
    # Метаданные синхронизации
    last_synced_at = Column(DateTime(timezone=True))
    sync_source = Column(String)  # Источник данных (api, file, manual)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    product = relationship("Product", back_populates="inventory")
    supplier = relationship("User", back_populates="inventory", foreign_keys=[supplier_id])

