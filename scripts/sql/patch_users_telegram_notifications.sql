-- Идемпотентно: Telegram-уведомления поставщикам о новых заказах.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR NULL,
  ADD COLUMN IF NOT EXISTS telegram_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telegram_connect_code VARCHAR NULL;

CREATE INDEX IF NOT EXISTS ix_users_telegram_connect_code
  ON users (telegram_connect_code);
