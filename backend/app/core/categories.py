"""
Иерархия категорий товаров в формате узлов (id/parent_id/slug/name)
и утилиты синхронизации в таблицу categories.
"""
from __future__ import annotations

from typing import Dict, List, Optional, TypedDict

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.category import Category


class CategoryNode(TypedDict):
    id: int
    parent_id: Optional[int]
    slug: str
    name: str


CATEGORY_TREE: List[CategoryNode] = [
    {"id": 1, "parent_id": None, "slug": "food", "name": "Продукты питания"},
    {"id": 2, "parent_id": None, "slug": "drinks", "name": "Напитки"},
    {"id": 3, "parent_id": None, "slug": "home", "name": "Товары для дома"},
    {"id": 4, "parent_id": None, "slug": "hygiene", "name": "Личная гигиена и уход"},
    {"id": 5, "parent_id": None, "slug": "kids", "name": "Товары для детей"},
    {"id": 6, "parent_id": None, "slug": "pets", "name": "Товары для животных"},
    {"id": 7, "parent_id": None, "slug": "seasonal", "name": "Сезонные товары и акции"},
    {"id": 101, "parent_id": 1, "slug": "vegetables-fruits-greens", "name": "Овощи, фрукты, зелень"},
    {"id": 102, "parent_id": 1, "slug": "meat-poultry-fish", "name": "Мясо, птица, рыба"},
    {"id": 103, "parent_id": 1, "slug": "dairy-eggs", "name": "Молочные продукты и яйца"},
    {"id": 104, "parent_id": 1, "slug": "grocery", "name": "Бакалея"},
    {"id": 105, "parent_id": 1, "slug": "bakery", "name": "Хлеб и выпечка"},
    {"id": 106, "parent_id": 1, "slug": "frozen", "name": "Заморозка"},
    {"id": 107, "parent_id": 1, "slug": "ready-meals", "name": "Готовая еда и кулинария"},
    {"id": 108, "parent_id": 1, "slug": "sausages-deli", "name": "Колбасы и деликатесы"},
    {"id": 109, "parent_id": 1, "slug": "sweets-desserts", "name": "Сладости и десерты"},
    {"id": 110, "parent_id": 1, "slug": "snacks", "name": "Снеки"},
    {"id": 111, "parent_id": 1, "slug": "baby-food", "name": "Детское питание"},
    {"id": 112, "parent_id": 1, "slug": "diet-special", "name": "Диетическое и специализированное питание"},
    {"id": 113, "parent_id": 1, "slug": "eco-farm", "name": "Эко и фермерские продукты"},
    {"id": 114, "parent_id": 1, "slug": "pasta-cereals", "name": "Макароны и крупы"},
    {"id": 115, "parent_id": 1, "slug": "flour-baking", "name": "Мука и выпечка для дома"},
    {"id": 116, "parent_id": 1, "slug": "spices-sauces", "name": "Специи, соусы и приправы"},
    {"id": 117, "parent_id": 1, "slug": "canned-food", "name": "Консервация"},
    {"id": 118, "parent_id": 1, "slug": "breakfast", "name": "Завтраки и каши"},
    {"id": 119, "parent_id": 1, "slug": "jams-honey", "name": "Мед, варенье, сиропы"},
    {"id": 120, "parent_id": 1, "slug": "fresh-herbs", "name": "Свежая зелень"},
    {"id": 121, "parent_id": 1, "slug": "salads-ready", "name": "Салаты и закуски"},
    {"id": 122, "parent_id": 1, "slug": "dumplings-pelmeni", "name": "Пельмени и вареники"},
    {"id": 123, "parent_id": 1, "slug": "pizza-frozen", "name": "Пицца и тесто (заморозка)"},
    {"id": 124, "parent_id": 1, "slug": "asian-cuisine", "name": "Товары для азиатской кухни"},
    {"id": 125, "parent_id": 1, "slug": "healthy-snacks", "name": "Полезные снеки"},
    {"id": 201, "parent_id": 2, "slug": "water", "name": "Вода"},
    {"id": 202, "parent_id": 2, "slug": "juices-nectars-fruit-drinks", "name": "Соки, нектары, морсы"},
    {"id": 203, "parent_id": 2, "slug": "carbonated", "name": "Газированные напитки"},
    {"id": 204, "parent_id": 2, "slug": "coffee", "name": "Кофе"},
    {"id": 205, "parent_id": 2, "slug": "tea", "name": "Чай"},
    {"id": 206, "parent_id": 2, "slug": "cocoa-hot-chocolate", "name": "Какао и горячий шоколад"},
    {"id": 207, "parent_id": 2, "slug": "non-alcoholic", "name": "Безалкогольные напитки"},
    {"id": 208, "parent_id": 2, "slug": "kvass", "name": "Квас и холодный чай"},
    {"id": 209, "parent_id": 2, "slug": "energy-drinks", "name": "Энергетические напитки"},
    {"id": 210, "parent_id": 2, "slug": "sport-drinks", "name": "Спортивные напитки"},
    {"id": 211, "parent_id": 2, "slug": "plant-milk", "name": "Растительное молоко"},
    {"id": 212, "parent_id": 2, "slug": "lemonades", "name": "Лимонады"},
    {"id": 213, "parent_id": 2, "slug": "compotes", "name": "Компоты и узвары"},
    {"id": 214, "parent_id": 2, "slug": "water-kids", "name": "Детская вода и напитки"},
    {"id": 301, "parent_id": 3, "slug": "household-chemicals", "name": "Бытовая химия"},
    {"id": 302, "parent_id": 3, "slug": "paper-products", "name": "Бумажная продукция"},
    {"id": 303, "parent_id": 3, "slug": "household-goods", "name": "Хозяйственные товары"},
    {"id": 304, "parent_id": 3, "slug": "storage-goods", "name": "Товары для хранения"},
    {"id": 305, "parent_id": 3, "slug": "kitchen-goods", "name": "Товары для кухни"},
    {"id": 306, "parent_id": 3, "slug": "disposable-tableware", "name": "Одноразовая посуда"},
    {"id": 307, "parent_id": 3, "slug": "foil-baking-paper", "name": "Фольга, пергамент, пленка"},
    {"id": 308, "parent_id": 3, "slug": "sponges-cloths", "name": "Губки и салфетки"},
    {"id": 309, "parent_id": 3, "slug": "cleaning-tools", "name": "Инвентарь для уборки"},
    {"id": 310, "parent_id": 3, "slug": "air-fresheners", "name": "Освежители воздуха"},
    {"id": 311, "parent_id": 3, "slug": "laundry-care", "name": "Стирка и уход за тканью"},
    {"id": 312, "parent_id": 3, "slug": "dishwasher-products", "name": "Средства для посудомоек"},
    {"id": 401, "parent_id": 4, "slug": "body-care", "name": "Уход за телом"},
    {"id": 402, "parent_id": 4, "slug": "hair-care", "name": "Уход за волосами"},
    {"id": 403, "parent_id": 4, "slug": "oral-care", "name": "Уход за полостью рта"},
    {"id": 404, "parent_id": 4, "slug": "shaving-depilation", "name": "Бритье и депиляция"},
    {"id": 405, "parent_id": 4, "slug": "feminine-hygiene", "name": "Женская гигиена"},
    {"id": 406, "parent_id": 4, "slug": "deodorants", "name": "Дезодоранты и антиперспиранты"},
    {"id": 407, "parent_id": 4, "slug": "face-care", "name": "Уход за лицом"},
    {"id": 408, "parent_id": 4, "slug": "hand-care", "name": "Уход за руками"},
    {"id": 409, "parent_id": 4, "slug": "feet-care", "name": "Уход за ногами"},
    {"id": 410, "parent_id": 4, "slug": "cotton-products", "name": "Ватные диски и палочки"},
    {"id": 411, "parent_id": 4, "slug": "sanitizers", "name": "Антисептики"},
    {"id": 412, "parent_id": 4, "slug": "mens-care", "name": "Уход для мужчин"},
    {"id": 413, "parent_id": 4, "slug": "travel-hygiene", "name": "Дорожный формат"},
    {"id": 501, "parent_id": 5, "slug": "diapers", "name": "Подгузники и пеленки"},
    {"id": 502, "parent_id": 5, "slug": "kids-hygiene", "name": "Детская гигиена"},
    {"id": 503, "parent_id": 5, "slug": "feeding-accessories", "name": "Аксессуары для кормления"},
    {"id": 504, "parent_id": 5, "slug": "kids-snacks", "name": "Детские перекусы"},
    {"id": 505, "parent_id": 5, "slug": "puree", "name": "Пюре и каши"},
    {"id": 506, "parent_id": 5, "slug": "baby-milk", "name": "Детские смеси"},
    {"id": 507, "parent_id": 5, "slug": "bottles", "name": "Бутылочки и соски"},
    {"id": 508, "parent_id": 5, "slug": "wipes", "name": "Влажные салфетки"},
    {"id": 509, "parent_id": 5, "slug": "kids-dishes", "name": "Детская посуда"},
    {"id": 510, "parent_id": 5, "slug": "kids-care-cosmetics", "name": "Детская косметика"},
    {"id": 601, "parent_id": 6, "slug": "cat-food", "name": "Корма для кошек"},
    {"id": 602, "parent_id": 6, "slug": "dog-food", "name": "Корма для собак"},
    {"id": 603, "parent_id": 6, "slug": "pet-care-accessories", "name": "Уход и аксессуары"},
    {"id": 604, "parent_id": 6, "slug": "wet-food", "name": "Влажные корма"},
    {"id": 605, "parent_id": 6, "slug": "dry-food", "name": "Сухие корма"},
    {"id": 606, "parent_id": 6, "slug": "fillers", "name": "Наполнители"},
    {"id": 607, "parent_id": 6, "slug": "pet-treats", "name": "Лакомства"},
    {"id": 701, "parent_id": 7, "slug": "picnic-grill", "name": "Пикник и гриль"},
    {"id": 702, "parent_id": 7, "slug": "holiday-goods", "name": "Праздничные товары"},
    {"id": 703, "parent_id": 7, "slug": "discounted", "name": "Товары по акции"},
    {"id": 704, "parent_id": 7, "slug": "summer-goods", "name": "Летние товары"},
    {"id": 705, "parent_id": 7, "slug": "winter-goods", "name": "Зимние товары"},
    {"id": 706, "parent_id": 7, "slug": "school-season", "name": "Школьный сезон"},
    {"id": 707, "parent_id": 7, "slug": "new-year", "name": "Новый год"},
    {"id": 708, "parent_id": 7, "slug": "easter", "name": "Пасхальные товары"},
]


def get_leaf_categories() -> List[str]:
    ids_with_children = {node["parent_id"] for node in CATEGORY_TREE if node["parent_id"] is not None}
    out: List[str] = []
    for node in CATEGORY_TREE:
        if node["id"] not in ids_with_children:
            out.append(node["name"])
    return out


def build_category_path_by_leaf() -> Dict[str, str]:
    by_id = {node["id"]: node for node in CATEGORY_TREE}
    ids_with_children = {node["parent_id"] for node in CATEGORY_TREE if node["parent_id"] is not None}
    out: Dict[str, str] = {}
    for node in CATEGORY_TREE:
        if node["id"] in ids_with_children:
            continue
        parent = by_id.get(node["parent_id"]) if node["parent_id"] is not None else None
        out[node["name"]] = f'{parent["name"]} > {node["name"]}' if parent else node["name"]
    return out


PRODUCT_CATEGORIES: List[str] = get_leaf_categories()
CATEGORY_PATH_BY_LEAF: Dict[str, str] = build_category_path_by_leaf()


def _leaf_ids() -> set[int]:
    ids_with_children = {node["parent_id"] for node in CATEGORY_TREE if node["parent_id"] is not None}
    return {node["id"] for node in CATEGORY_TREE if node["id"] not in ids_with_children}


def sync_categories_to_db(db: Session) -> None:
    """
    Идемпотентная синхронизация CATEGORY_TREE в таблицу categories.
    """
    existing = {row.id: row for row in db.query(Category).all()}
    leaf_ids = _leaf_ids()

    for node in CATEGORY_TREE:
        is_leaf = node["id"] in leaf_ids
        row = existing.get(node["id"])
        if row is None:
            db.add(
                Category(
                    id=node["id"],
                    parent_id=node["parent_id"],
                    slug=node["slug"],
                    name=node["name"],
                    is_leaf=is_leaf,
                    is_active=True,
                )
            )
            continue
        changed = False
        if row.parent_id != node["parent_id"]:
            row.parent_id = node["parent_id"]
            changed = True
        if row.slug != node["slug"]:
            row.slug = node["slug"]
            changed = True
        if row.name != node["name"]:
            row.name = node["name"]
            changed = True
        if row.is_leaf != is_leaf:
            row.is_leaf = is_leaf
            changed = True
        if not row.is_active:
            row.is_active = True
            changed = True
        if changed:
            db.add(row)

    db.commit()
    # Миграционный backfill для существующих товаров.
    db.execute(
        text(
            """
            UPDATE products p
            SET category_id = c.id
            FROM categories c
            WHERE p.category_id IS NULL
              AND p.category IS NOT NULL
              AND c.name = p.category
            """
        )
    )
    db.commit()





