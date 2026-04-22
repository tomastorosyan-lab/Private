"""
Создает тестовых поставщиков и товары с остатками.

Что делает:
- Создает 3 поставщика (если их еще нет)
- Для каждого поставщика создает 10 товаров (если их еще нет)
- Для каждого товара создает/обновляет запись остатков (inventory)
"""
import os
import sys
import random
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserType
from app.models.product import Product
from app.models.inventory import Inventory


TEST_PASSWORD = "Test12345!"
SUPPLIER_COUNT = 3
PRODUCTS_PER_SUPPLIER = 10


def ensure_supplier(db: Session, idx: int) -> User:
    email = f"supplier_test_{idx}@example.com"
    full_name = f"Тест Поставщик {idx}"

    supplier = db.query(User).filter(User.email == email).first()
    if supplier:
        return supplier

    supplier = User(
        email=email,
        hashed_password=get_password_hash(TEST_PASSWORD),
        full_name=full_name,
        user_type=UserType.SUPPLIER,
        is_active=True,
        description=f"Автосозданный тестовый поставщик #{idx}",
        contact_phone=f"+7999000000{idx}",
        integration_type="manual",
    )
    db.add(supplier)
    db.flush()
    return supplier


def ensure_product_with_inventory(db: Session, supplier: User, idx: int) -> None:
    name = f"Тестовый товар {supplier.id}-{idx}"
    category = random.choice(
        ["Бакалея", "Молочные продукты", "Мясо", "Овощи", "Напитки"]
    )
    unit = random.choice(["шт", "кг", "л"])

    product = (
        db.query(Product)
        .filter(Product.supplier_id == supplier.id, Product.name == name)
        .first()
    )
    if not product:
        product = Product(
            name=name,
            description=f"Тестовый товар №{idx} для поставщика {supplier.full_name}",
            category=category,
            unit=unit,
            supplier_id=supplier.id,
        )
        db.add(product)
        db.flush()

    inventory = (
        db.query(Inventory)
        .filter(
            Inventory.supplier_id == supplier.id,
            Inventory.product_id == product.id,
        )
        .first()
    )
    if not inventory:
        inventory = Inventory(
            supplier_id=supplier.id,
            product_id=product.id,
            quantity=Decimal(random.randint(20, 300)),
            price=Decimal(random.randint(100, 2500)),
            sync_source="manual",
        )
        db.add(inventory)
    else:
        # Небольшое обновление значений, чтобы данные были живыми
        inventory.quantity = Decimal(random.randint(20, 300))
        inventory.price = Decimal(random.randint(100, 2500))
        inventory.sync_source = "manual"


def main() -> None:
    db: Session = SessionLocal()
    try:
        suppliers = []
        for i in range(1, SUPPLIER_COUNT + 1):
            suppliers.append(ensure_supplier(db, i))
        db.commit()

        created_products = 0
        for supplier in suppliers:
            for i in range(1, PRODUCTS_PER_SUPPLIER + 1):
                before = (
                    db.query(Product)
                    .filter(
                        Product.supplier_id == supplier.id,
                        Product.name == f"Тестовый товар {supplier.id}-{i}",
                    )
                    .first()
                )
                ensure_product_with_inventory(db, supplier, i)
                if before is None:
                    created_products += 1
            db.commit()

        print("✅ Готово")
        print(f"Поставщиков обработано: {SUPPLIER_COUNT}")
        print(f"Новых товаров создано: {created_products}")
        print("Логины поставщиков:")
        for i in range(1, SUPPLIER_COUNT + 1):
            print(f" - supplier_test_{i}@example.com")
        print(f"Пароль для всех: {TEST_PASSWORD}")
    except Exception as exc:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

