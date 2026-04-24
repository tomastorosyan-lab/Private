-- Идемпотентно: скрытие товаров из витрины.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE products
SET is_hidden = FALSE
WHERE is_hidden IS NULL;
