"""
Сервис для работы с остатками товаров
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.user import User, UserType
from app.schemas.inventory import InventorySyncRequest, InventoryCreate, InventoryUpdate
from app.core.exceptions import NotFoundException, ForbiddenException


class InventoryService:
    def __init__(self, db: Session):
        self.db = db
    
    async def get_product_inventory(self, product_id: int) -> List[Inventory]:
        """Получение остатков товара у всех поставщиков"""
        return self.db.query(Inventory).filter(Inventory.product_id == product_id).all()
    
    async def get_supplier_inventory(self, supplier_id: int) -> List[Inventory]:
        """Получение остатков всех товаров у поставщика"""
        return self.db.query(Inventory).filter(Inventory.supplier_id == supplier_id).all()
    
    async def sync_inventory(self, sync_request: InventorySyncRequest) -> str:
        """Запуск синхронизации остатков"""
        # TODO: Реализовать фоновую задачу для синхронизации
        # Здесь будет запуск фоновой задачи для синхронизации
        task_id = "sync_task_123"  # Временный заглушка
        return task_id
    
    async def get_inventory_by_id(self, inventory_id: int) -> Optional[Inventory]:
        """Получение остатков по ID"""
        return self.db.query(Inventory).filter(Inventory.id == inventory_id).first()
    
    async def get_product_inventory_for_supplier(self, product_id: int, supplier_id: int) -> Optional[Inventory]:
        """Получение остатков конкретного товара у конкретного поставщика"""
        return self.db.query(Inventory).filter(
            Inventory.product_id == product_id,
            Inventory.supplier_id == supplier_id
        ).first()
    
    async def create_inventory(self, inventory_data: InventoryCreate, current_user: User) -> Inventory:
        """Создание остатков товара"""
        product = self.db.query(Product).filter(Product.id == inventory_data.product_id).first()
        if not product:
            raise NotFoundException(f"Товар с ID {inventory_data.product_id} не найден")
        
        if current_user.user_type != UserType.ADMIN:
            if product.supplier_id != current_user.id:
                raise ForbiddenException("Товар не принадлежит этому поставщику")
        
        target_supplier_id = product.supplier_id
        
        existing = await self.get_product_inventory_for_supplier(inventory_data.product_id, target_supplier_id)
        if existing:
            raise ForbiddenException("Остатки для этого товара уже существуют. Используйте обновление.")
        
        new_inventory = Inventory(
            product_id=inventory_data.product_id,
            supplier_id=target_supplier_id,
            quantity=inventory_data.quantity,
            price=inventory_data.price,
            sync_source="manual"
        )
        
        self.db.add(new_inventory)
        self.db.commit()
        self.db.refresh(new_inventory)
        
        return new_inventory
    
    async def update_inventory(self, inventory_id: int, inventory_update: InventoryUpdate, current_user: User) -> Inventory:
        """Обновление остатков товара"""
        inventory = await self.get_inventory_by_id(inventory_id)
        if not inventory:
            raise NotFoundException("Остатки не найдены")
        
        # Проверяем права - поставщик может обновлять только свои остатки
        if current_user.user_type != UserType.ADMIN and inventory.supplier_id != current_user.id:
            raise ForbiddenException("Вы можете обновлять только свои остатки")
        
        if inventory_update.quantity is not None:
            inventory.quantity = inventory_update.quantity
        if inventory_update.price is not None:
            inventory.price = inventory_update.price
        
        inventory.sync_source = "manual"
        inventory.updated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(inventory)
        
        return inventory
    
    async def delete_inventory(self, inventory_id: int, current_user: User) -> None:
        """Удаление остатков товара"""
        inventory = await self.get_inventory_by_id(inventory_id)
        if not inventory:
            raise NotFoundException("Остатки не найдены")
        
        # Проверяем права - поставщик может удалять только свои остатки
        if current_user.user_type != UserType.ADMIN and inventory.supplier_id != current_user.id:
            raise ForbiddenException("Вы можете удалять только свои остатки")
        
        self.db.delete(inventory)
        self.db.commit()

