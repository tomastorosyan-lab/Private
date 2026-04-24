"""
Сервис для работы с товарами
"""
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone
from app.models.product import Product
from app.models.category import Category
from app.models.inventory import Inventory
from app.schemas.product import ProductResponse, ProductSearch, ProductCreate, ProductUpdate
from app.core.exceptions import NotFoundException, ForbiddenException, BusinessLogicException
from app.models.user import User, UserType
from app.core.categories import CATEGORY_PATH_BY_LEAF, sync_categories_to_db


class ProductService:
    def __init__(self, db: Session):
        self.db = db
    
    def _resolve_category_data(
        self,
        category_id: Optional[int],
        category_name: Optional[str],
    ) -> tuple[Optional[int], Optional[str], Optional[str]]:
        """
        Приводит категорию к консистентному виду:
        - category_id
        - category (leaf name)
        - category_path
        """
        sync_categories_to_db(self.db)
        if category_id is not None:
            row = self.db.query(Category).filter(Category.id == category_id, Category.is_active == True).first()
            if not row:
                raise BusinessLogicException(f"Категория с ID {category_id} не найдена")
            name = row.name
            return row.id, name, CATEGORY_PATH_BY_LEAF.get(name, name)

        if category_name:
            row = self.db.query(Category).filter(Category.name == category_name, Category.is_active == True).first()
            if row:
                name = row.name
                return row.id, name, CATEGORY_PATH_BY_LEAF.get(name, name)
            # fallback для обратной совместимости
            return None, category_name, CATEGORY_PATH_BY_LEAF.get(category_name, category_name)

        return None, None, None

    async def get_products(
        self,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        supplier_id: Optional[int] = None,
        category: Optional[str] = None,
        category_id: Optional[int] = None,
    ) -> List[Product]:
        """Получение списка товаров"""
        query = self.db.query(Product)
        
        if search:
            query = query.filter(
                or_(
                    Product.name.ilike(f"%{search}%"),
                    Product.description.ilike(f"%{search}%")
                )
            )
        
        if supplier_id:
            query = query.filter(Product.supplier_id == supplier_id)
        
        if category_id is not None:
            query = query.filter(Product.category_id == category_id)
        elif category:
            query = query.filter(Product.category == category)
        
        return query.offset(skip).limit(limit).all()
    
    async def get_product_by_id(self, product_id: int) -> Optional[Product]:
        """Получение товара по ID"""
        return self.db.query(Product).filter(Product.id == product_id).first()
    
    async def search_products(self, search_params: ProductSearch) -> List[Product]:
        """Расширенный поиск товаров"""
        query = self.db.query(Product)
        
        if search_params.query:
            query = query.filter(
                or_(
                    Product.name.ilike(f"%{search_params.query}%"),
                    Product.description.ilike(f"%{search_params.query}%")
                )
            )
        
        if search_params.category_id is not None:
            query = query.filter(Product.category_id == search_params.category_id)
        elif search_params.category:
            query = query.filter(Product.category == search_params.category)
        
        if search_params.supplier_id:
            query = query.filter(Product.supplier_id == search_params.supplier_id)
        
        # TODO: Добавить фильтрацию по цене и наличию через Inventory
        
        return query.all()
    
    async def create_product(self, product_data: ProductCreate, supplier_id: int, current_user: User) -> Product:
        """Создание нового товара"""
        # Проверяем, что поставщик существует и является пользователем типа supplier
        supplier = self.db.query(User).filter(
            User.id == supplier_id,
            User.user_type == UserType.SUPPLIER,
            User.is_active == True
        ).first()
        if not supplier:
            raise NotFoundException(f"Поставщик с ID {supplier_id} не найден или неактивен")
        
        # Проверка прав - поставщик может создавать товары только для себя
        if current_user.user_type != UserType.ADMIN and current_user.id != supplier_id:
            raise ForbiddenException("Вы можете создавать товары только для своего аккаунта")
        
        new_product = Product(
            name=product_data.name,
            description=product_data.description,
            category=None,
            category_path=None,
            category_id=None,
            unit=product_data.unit or "шт",  # По умолчанию "шт"
            items_per_box=product_data.items_per_box,
            supplier_id=supplier_id
        )
        resolved_id, resolved_name, resolved_path = self._resolve_category_data(
            product_data.category_id,
            product_data.category,
        )
        new_product.category_id = resolved_id
        new_product.category = resolved_name
        new_product.category_path = product_data.category_path or resolved_path
        
        self.db.add(new_product)
        self.db.commit()
        self.db.refresh(new_product)
        
        # Если указаны quantity и price, создаем остатки автоматически
        if product_data.quantity is not None and product_data.price is not None:
            # Проверяем, что значения больше нуля
            if product_data.quantity > 0 and product_data.price > 0:
                new_inventory = Inventory(
                    product_id=new_product.id,
                    supplier_id=supplier_id,
                    quantity=product_data.quantity,
                    price=product_data.price,
                    sync_source="manual"
                )
                self.db.add(new_inventory)
                self.db.commit()
                self.db.refresh(new_inventory)
        
        return new_product
    
    async def update_product(self, product_id: int, product_data: ProductUpdate, current_user: User) -> Product:
        """Обновление товара"""
        product = await self.get_product_by_id(product_id)
        if not product:
            raise NotFoundException("Товар не найден")
        
        # Проверка прав - поставщик может изменять только свои товары
        if current_user.user_type != UserType.ADMIN and product.supplier_id != current_user.id:
            raise ForbiddenException("Вы можете изменять только свои товары")
        
        # Явно читаем остаток/цену по полям, участвовавшим в запросе (надёжнее, чем только model_dump)
        fields_set = product_data.model_fields_set
        inv_quantity = (
            product_data.quantity if "quantity" in fields_set else None
        )
        inv_price = product_data.price if "price" in fields_set else None

        payload = product_data.model_dump(
            exclude_unset=True,
            exclude={"quantity", "price"},
        )

        if "name" in payload and payload["name"] is not None:
            product.name = payload["name"]
        if "description" in payload:
            product.description = payload["description"] or None
        if "category" in payload:
            product.category = payload["category"] or None
        if "category_id" in payload:
            product.category_id = payload["category_id"]
        if "category_path" in payload:
            product.category_path = payload["category_path"] or None
        if "category_id" in payload or "category" in payload:
            resolved_id, resolved_name, resolved_path = self._resolve_category_data(
                payload.get("category_id"),
                payload.get("category"),
            )
            product.category_id = resolved_id
            product.category = resolved_name
            if payload.get("category_path") is None:
                product.category_path = resolved_path
        if "unit" in payload and payload["unit"] is not None:
            product.unit = payload["unit"] or "шт"
        if "items_per_box" in payload:
            product.items_per_box = payload["items_per_box"]
        if "image_url" in payload:
            product.image_url = payload["image_url"]

        if inv_quantity is not None or inv_price is not None:
            inv_rows = (
                self.db.query(Inventory)
                .filter(
                    Inventory.product_id == product_id,
                    Inventory.supplier_id == product.supplier_id,
                )
                .all()
            )
            # Старые данные: строка inventory с тем же product_id, но другим supplier_id
            if not inv_rows:
                inv_rows = (
                    self.db.query(Inventory)
                    .filter(Inventory.product_id == product_id)
                    .all()
                )
            if inv_rows:
                for inv in inv_rows:
                    if inv_quantity is not None:
                        inv.quantity = inv_quantity
                    if inv_price is not None:
                        inv.price = inv_price
                    inv.sync_source = "manual"
                    inv.updated_at = datetime.now(timezone.utc)
            else:
                if inv_quantity is not None and inv_price is not None:
                    self.db.add(
                        Inventory(
                            product_id=product_id,
                            supplier_id=product.supplier_id,
                            quantity=inv_quantity,
                            price=inv_price,
                            sync_source="manual",
                        )
                    )
                else:
                    raise BusinessLogicException(
                        "Для создания остатков укажите и количество, и цену в одном запросе"
                    )
        
        self.db.commit()
        self.db.refresh(product)
        return product
    
    async def delete_product(self, product_id: int, current_user: User) -> None:
        """Удаление товара"""
        product = await self.get_product_by_id(product_id)
        if not product:
            raise NotFoundException("Товар не найден")
        
        # Проверка прав - поставщик может удалять только свои товары
        if current_user.user_type != UserType.ADMIN and product.supplier_id != current_user.id:
            raise ForbiddenException("Вы можете удалять только свои товары")
        
        # Удаляем связанные записи inventory
        from app.models.inventory import Inventory
        inventory_items = self.db.query(Inventory).filter(Inventory.product_id == product_id).all()
        for inventory_item in inventory_items:
            self.db.delete(inventory_item)
        
        # Удаляем связанные записи order_items
        from app.models.order import OrderItem
        order_items = self.db.query(OrderItem).filter(OrderItem.product_id == product_id).all()
        for order_item in order_items:
            self.db.delete(order_item)
        
        # Удаляем товар
        self.db.delete(product)
        self.db.commit()

