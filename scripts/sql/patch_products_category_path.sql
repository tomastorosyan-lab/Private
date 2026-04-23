-- Идемпотентно: хранить полный путь категории в products.category_path.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_path VARCHAR;

UPDATE products
SET category_path = category
WHERE category_path IS NULL AND category IS NOT NULL;
