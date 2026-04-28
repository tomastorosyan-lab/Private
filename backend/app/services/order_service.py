"""
Сервис для работы с заказами
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
import logging
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.user import User, UserType
from app.models.inventory import Inventory
from app.schemas.order import OrderCreate, OrderUpdate
from app.core.exceptions import NotFoundException, BusinessLogicException, ForbiddenException
from app.core.permissions import can_modify_order, can_view_order
from app.services.email_service import EmailService
from app.services.telegram_service import TelegramService


logger = logging.getLogger(__name__)


class OrderService:
    def __init__(self, db: Session):
        self.db = db
    
    async def create_order(self, order_data: OrderCreate, user_id: int) -> Order:
        """
        Создание нового заказа с проверкой остатков товаров
        
        Проверяет:
        - Существование поставщика
        - Существование товаров
        - Наличие достаточного количества товаров на складе
        - Валидность цен и количеств
        
        Автоматически резервирует товары (уменьшает остатки).
        """
        # Проверка существования поставщика
        supplier = self.db.query(User).filter(
            User.id == order_data.supplier_id,
            User.user_type == UserType.SUPPLIER,
            User.is_active == True
        ).first()
        
        if not supplier:
            raise NotFoundException(f"Поставщик с ID {order_data.supplier_id} не найден или неактивен")
        
        # Проверка наличия товаров и валидация
        if not order_data.items:
            raise BusinessLogicException("Заказ должен содержать хотя бы одну позицию")
        
        total_amount = Decimal(0)
        
        # Валидация товаров и проверка остатков
        inventory_updates = []  # Список для обновления остатков
        
        for item_data in order_data.items:
            product = self.db.query(Product).filter(
                Product.id == item_data.product_id,
                Product.supplier_id == order_data.supplier_id
            ).first()
            
            if not product:
                raise NotFoundException(
                    f"Товар с ID {item_data.product_id} не найден у поставщика {order_data.supplier_id}"
                )
            
            if item_data.quantity <= 0:
                raise BusinessLogicException(f"Количество товара должно быть больше 0")
            
            if item_data.price <= 0:
                raise BusinessLogicException(f"Цена товара должна быть больше 0")
            
            # Проверка остатков товара
            inventory = self.db.query(Inventory).filter(
                Inventory.product_id == item_data.product_id,
                Inventory.supplier_id == order_data.supplier_id
            ).first()
            
            if not inventory:
                raise BusinessLogicException(
                    f"Товар с ID {item_data.product_id} отсутствует на складе поставщика"
                )
            
            if inventory.quantity < item_data.quantity:
                raise BusinessLogicException(
                    f"Недостаточно товара '{product.name}'. "
                    f"Доступно: {inventory.quantity}, запрошено: {item_data.quantity}"
                )
            
            # Используем актуальную цену из остатков, если она не указана в заказе
            if item_data.price != inventory.price:
                # Можно использовать цену из заказа или из остатков
                # Здесь используем цену из заказа, но можно добавить логику сравнения
                pass
            
            # Сохраняем информацию для обновления остатков
            inventory_updates.append({
                'inventory': inventory,
                'quantity_to_reserve': item_data.quantity
            })
        
        computed_total = sum(
            (item.quantity * item.price) for item in order_data.items
        )
        min_required = supplier.min_order_amount
        if min_required is None:
            min_required = Decimal("0")
        else:
            min_required = Decimal(str(min_required))
        if min_required > 0 and computed_total < min_required:
            raise BusinessLogicException(
                f"Минимальная сумма заказа у этого поставщика — {min_required} ₽. "
                f"Сейчас в заказе: {computed_total} ₽."
            )
        
        order = Order(
            user_id=user_id,
            supplier_id=order_data.supplier_id,
            status=OrderStatus.PENDING,
            delivery_address=order_data.delivery_address,
            contact_phone=order_data.contact_phone,
            notes=order_data.notes,
            total_amount=total_amount
        )
        
        self.db.add(order)
        self.db.flush()
        
        # Создание позиций заказа
        for item_data in order_data.items:
            item_total = item_data.quantity * item_data.price
            total_amount += item_total
            
            order_item = OrderItem(
                order_id=order.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                price=item_data.price,
                total=item_total
            )
            self.db.add(order_item)
        
        order.total_amount = total_amount
        
        # Обновление остатков товаров (резервирование)
        for update_info in inventory_updates:
            inventory = update_info['inventory']
            quantity_to_reserve = update_info['quantity_to_reserve']
            
            # Уменьшаем остаток на заказанное количество
            inventory.quantity -= quantity_to_reserve
            
            if inventory.quantity < 0:
                # Это не должно произойти, т.к. мы проверили выше, но на всякий случай
                self.db.rollback()
                raise BusinessLogicException(
                    f"Ошибка при резервировании товара. Остаток стал отрицательным."
                )
        
        # Сохраняем все изменения
        self.db.commit()
        self.db.refresh(order)

        # Уведомление магазина о новом заказе.
        # Не должно ломать оформление заказа, если SMTP недоступен.
        try:
            customer = self.db.query(User).filter(User.id == user_id).first()
            if customer:
                item_lines = [
                    f"- {item.quantity} x {item.product.name if item.product else f'Товар #{item.product_id}'} "
                    f"по {item.price} ₽ = {item.total} ₽"
                    for item in order.items
                ]
                EmailService.send_new_order_notification(
                    order=order,
                    customer=customer,
                    supplier=supplier,
                    item_lines=item_lines,
                )
                TelegramService.send_new_order_notification(
                    order=order,
                    customer=customer,
                    supplier=supplier,
                    item_lines=item_lines,
                )
        except Exception:
            logger.exception("Failed to process new order notification for order_id=%s", order.id)
        
        return order
    
    async def get_orders(
        self,
        skip: int = 0,
        limit: int = 100,
        user_id: int = None,
        current_user: User = None,
        status: Optional[OrderStatus] = None,
    ) -> List[Order]:
        """
        Получение списка заказов

        Для обычных пользователей возвращаются только их заказы.
        Для поставщиков - заказы у них.
        Для администраторов - все заказы.
        """
        query = self.db.query(Order)

        if current_user:
            if current_user.user_type == UserType.ADMIN:
                # Администратор видит все заказы
                pass
            elif current_user.user_type == UserType.SUPPLIER:
                # Поставщик видит только заказы у себя
                query = query.filter(Order.supplier_id == current_user.id)
            else:
                # Заказчики видят только свои заказы
                query = query.filter(Order.user_id == current_user.id)
        elif user_id:
            # Обратная совместимость
            query = query.filter(Order.user_id == user_id)

        if status is not None:
            query = query.filter(Order.status == status)

        return query.offset(skip).limit(limit).all()
    
    async def get_order_by_id(
        self, 
        order_id: int, 
        user_id: int = None,
        current_user: User = None
    ) -> Order:
        """
        Получение заказа по ID с проверкой прав доступа
        """
        order = self.db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            raise NotFoundException("Заказ не найден")
        
        # Проверка прав доступа
        if current_user:
            if not can_view_order(order.user_id, order.supplier_id, current_user):
                # Дополнительная проверка для поставщика
                if current_user.user_type == UserType.SUPPLIER:
                    if order.supplier_id != current_user.id:
                        raise ForbiddenException("Нет доступа к этому заказу")
                else:
                    raise ForbiddenException("Нет доступа к этому заказу")
        elif user_id:
            # Обратная совместимость
            if order.user_id != user_id:
                raise ForbiddenException("Нет доступа к этому заказу")
        
        return order
    
    async def update_order(
        self, 
        order_id: int, 
        order_update: OrderUpdate, 
        user_id: int = None,
        current_user: User = None
    ) -> Order:
        """
        Обновление заказа
        
        При отмене заказа автоматически возвращает товары на склад.
        
        Права доступа:
        - Владелец заказа может изменять только примечания
        - Поставщик может изменять статус заказов у себя
        - Администратор может все
        """
        order = await self.get_order_by_id(order_id, user_id=user_id, current_user=current_user)
        
        # Проверка прав на обновление статуса
        if order_update.status:
            if current_user:
                # Заказчик может отменять только свои заказы со статусом pending
                if current_user.user_type == UserType.CUSTOMER:
                    if order.user_id != current_user.id:
                        raise ForbiddenException("Вы можете отменять только свои заказы")
                    if order.status != OrderStatus.PENDING:
                        raise ForbiddenException("Вы можете отменять только заказы со статусом 'Ожидает обработки'")
                    if order_update.status != OrderStatus.CANCELLED:
                        raise ForbiddenException("Заказчик может только отменять заказы")
                # Поставщик или администратор могут менять статус
                elif current_user.user_type == UserType.SUPPLIER:
                    # Поставщик может изменять статус только своих заказов
                    if order.supplier_id != current_user.id:
                        raise ForbiddenException(
                            "Вы можете изменять статус только заказов у себя"
                        )
                elif current_user.user_type != UserType.ADMIN:
                    raise ForbiddenException(
                        "Нет прав на изменение статуса заказа"
                    )
            elif user_id:
                # Обратная совместимость - проверяем что это владелец
                if order.user_id != user_id:
                    raise ForbiddenException("Нет прав на изменение этого заказа")
        
        if order_update.status:
            # Валидация перехода статуса
            if order.status == OrderStatus.DELIVERED:
                raise BusinessLogicException("Нельзя изменить статус доставленного заказа")
            if order.status == OrderStatus.CANCELLED:
                raise BusinessLogicException("Нельзя изменить статус отмененного заказа")
            
            old_status = order.status
            new_status = order_update.status
            
            # Если заказ отменяется, возвращаем остатки товаров
            if old_status != OrderStatus.CANCELLED and new_status == OrderStatus.CANCELLED:
                await self._return_inventory(order)
            
            order.status = new_status
        
        if order_update.notes is not None:
            order.notes = order_update.notes
        
        self.db.commit()
        self.db.refresh(order)
        
        return order
    
    async def _return_inventory(self, order: Order) -> None:
        """
        Возврат остатков товаров при отмене заказа
        
        Увеличивает остатки товаров на количество из отмененного заказа.
        """
        for order_item in order.items:
            inventory = self.db.query(Inventory).filter(
                Inventory.product_id == order_item.product_id,
                Inventory.supplier_id == order.supplier_id
            ).first()
            
            if inventory:
                # Возвращаем товар на склад
                inventory.quantity += order_item.quantity
            else:
                # Если остатка не было, создаем новый
                # Это может произойти, если товар был удален из остатков
                product = self.db.query(Product).filter(
                    Product.id == order_item.product_id
                ).first()
                
                if product:
                    new_inventory = Inventory(
                        product_id=order_item.product_id,
                        supplier_id=order.supplier_id,
                        quantity=order_item.quantity,
                        price=order_item.price,
                        sync_source="order_cancellation"
                    )
                    self.db.add(new_inventory)
