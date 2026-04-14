"""
Скрипт для создания тестовых товаров для каждого поставщика
"""
import sys
import os

# Добавляем путь к приложению
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User, UserType
from app.models.product import Product
from app.services.product_service import ProductService
from app.schemas.product import ProductCreate
import random

# Тестовые данные для товаров
TEST_PRODUCTS = [
    # Молочные продукты
    {"name": "Молоко цельное 3.2%", "description": "Свежее цельное молоко", "category": "Молочные продукты", "unit": "л"},
    {"name": "Сметана 20%", "description": "Домашняя сметана", "category": "Молочные продукты", "unit": "кг"},
    {"name": "Творог обезжиренный", "description": "Натуральный творог", "category": "Молочные продукты", "unit": "кг"},
    {"name": "Сыр твердый", "description": "Голландский сыр", "category": "Молочные продукты", "unit": "кг"},
    {"name": "Йогурт натуральный", "description": "Без добавок", "category": "Молочные продукты", "unit": "шт"},
    
    # Мясные продукты
    {"name": "Говядина вырезка", "description": "Премиум качество", "category": "Мясо", "unit": "кг"},
    {"name": "Куриная грудка", "description": "Филе курицы", "category": "Мясо", "unit": "кг"},
    {"name": "Свинина окорок", "description": "Свежая свинина", "category": "Мясо", "unit": "кг"},
    {"name": "Колбаса докторская", "description": "Вареная колбаса", "category": "Мясо", "unit": "кг"},
    {"name": "Фарш говяжий", "description": "Свежий фарш", "category": "Мясо", "unit": "кг"},
    
    # Овощи и фрукты
    {"name": "Картофель", "description": "Отборный картофель", "category": "Овощи", "unit": "кг"},
    {"name": "Морковь", "description": "Свежая морковь", "category": "Овощи", "unit": "кг"},
    {"name": "Лук репчатый", "description": "Желтый лук", "category": "Овощи", "unit": "кг"},
    {"name": "Помидоры", "description": "Спелые помидоры", "category": "Овощи", "unit": "кг"},
    {"name": "Огурцы", "description": "Свежие огурцы", "category": "Овощи", "unit": "кг"},
    {"name": "Яблоки", "description": "Красные яблоки", "category": "Фрукты", "unit": "кг"},
    {"name": "Бананы", "description": "Спелые бананы", "category": "Фрукты", "unit": "кг"},
    {"name": "Апельсины", "description": "Сочные апельсины", "category": "Фрукты", "unit": "кг"},
    
    # Бакалея
    {"name": "Мука пшеничная", "description": "Высший сорт", "category": "Бакалея", "unit": "кг"},
    {"name": "Сахар-песок", "description": "Белый сахар", "category": "Бакалея", "unit": "кг"},
    {"name": "Рис длиннозерный", "description": "Премиум рис", "category": "Бакалея", "unit": "кг"},
    {"name": "Гречка", "description": "Ядрица", "category": "Бакалея", "unit": "кг"},
    {"name": "Макароны", "description": "Спагетти", "category": "Бакалея", "unit": "кг"},
    {"name": "Масло подсолнечное", "description": "Рафинированное", "category": "Бакалея", "unit": "л"},
    {"name": "Соль поваренная", "description": "Экстра", "category": "Бакалея", "unit": "кг"},
    
    # Напитки
    {"name": "Вода минеральная", "description": "Газированная", "category": "Напитки", "unit": "шт"},
    {"name": "Сок апельсиновый", "description": "100% сок", "category": "Напитки", "unit": "л"},
    {"name": "Чай черный", "description": "Листовой чай", "category": "Напитки", "unit": "шт"},
    {"name": "Кофе молотый", "description": "Арабика", "category": "Напитки", "unit": "кг"},
    
    # Хлебобулочные
    {"name": "Хлеб белый", "description": "Нарезной", "category": "Хлебобулочные", "unit": "шт"},
    {"name": "Хлеб черный", "description": "Ржаной", "category": "Хлебобулочные", "unit": "шт"},
    {"name": "Булочки сдобные", "description": "Свежие булочки", "category": "Хлебобулочные", "unit": "шт"},
    
    # Консервы
    {"name": "Тушенка говяжья", "description": "Высший сорт", "category": "Консервы", "unit": "шт"},
    {"name": "Горошек зеленый", "description": "Консервированный", "category": "Консервы", "unit": "шт"},
    {"name": "Кукуруза консервированная", "description": "Сладкая кукуруза", "category": "Консервы", "unit": "шт"},
    
    # Заморозка
    {"name": "Овощи замороженные", "description": "Смесь овощей", "category": "Заморозка", "unit": "кг"},
    {"name": "Пельмени", "description": "Домашние пельмени", "category": "Заморозка", "unit": "кг"},
    {"name": "Рыба замороженная", "description": "Филе трески", "category": "Заморозка", "unit": "кг"},
]

def create_test_products():
    """Создает по 10 тестовых товаров для каждого поставщика"""
    db: Session = SessionLocal()
    
    try:
        # Получаем всех поставщиков
        suppliers = db.query(User).filter(
            User.user_type == UserType.SUPPLIER,
            User.is_active == True
        ).all()
        
        if not suppliers:
            print("Поставщики не найдены в базе данных")
            return
        
        print(f"Найдено поставщиков: {len(suppliers)}")
        
        service = ProductService(db)
        total_created = 0
        
        for supplier in suppliers:
            print(f"\nСоздание товаров для поставщика: {supplier.full_name} (ID: {supplier.id})")
            
            # Выбираем случайные 10 товаров из списка
            selected_products = random.sample(TEST_PRODUCTS, min(10, len(TEST_PRODUCTS)))
            
            created_count = 0
            for product_data in selected_products:
                try:
                    # Проверяем, не существует ли уже такой товар у этого поставщика
                    existing = db.query(Product).filter(
                        Product.name == product_data["name"],
                        Product.supplier_id == supplier.id
                    ).first()
                    
                    if existing:
                        print(f"  Товар '{product_data['name']}' уже существует, пропускаем")
                        continue
                    
                    # Создаем товар через сервис
                    product_create = ProductCreate(
                        name=product_data["name"],
                        description=product_data["description"],
                        category=product_data["category"],
                        unit=product_data["unit"]
                    )
                    
                    # Используем сервис для создания (нужен current_user, но для скрипта используем supplier)
                    # Обходим проверки прав, создавая напрямую
                    new_product = Product(
                        name=product_data["name"],
                        description=product_data["description"],
                        category=product_data["category"],
                        unit=product_data["unit"],
                        supplier_id=supplier.id
                    )
                    
                    db.add(new_product)
                    created_count += 1
                    print(f"  ✓ Создан товар: {product_data['name']}")
                    
                except Exception as e:
                    print(f"  ✗ Ошибка при создании товара '{product_data['name']}': {e}")
            
            db.commit()
            print(f"  Создано товаров для {supplier.full_name}: {created_count}")
            total_created += created_count
        
        print(f"\n✅ Всего создано товаров: {total_created}")
        
    except Exception as e:
        print(f"Ошибка: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_products()





