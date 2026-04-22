-- Идемпотентно: минимальная сумма заказа у поставщика (₽), 0 = без ограничения.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
