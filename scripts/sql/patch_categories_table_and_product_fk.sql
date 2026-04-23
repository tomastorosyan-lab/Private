-- 1) Таблица категорий и самоссылка parent_id.
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER NULL REFERENCES categories(id) ON DELETE SET NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_leaf BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS ix_categories_id ON categories(id);
CREATE INDEX IF NOT EXISTS ix_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS ix_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS ix_categories_name ON categories(name);

-- 2) Ссылка товара на категорию.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id INTEGER;

CREATE INDEX IF NOT EXISTS ix_products_category_id ON products(category_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_category_id_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;
