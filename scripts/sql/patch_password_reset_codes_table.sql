-- Идемпотентно: активные коды сброса пароля.
CREATE TABLE IF NOT EXISTS password_reset_codes (
  email VARCHAR PRIMARY KEY,
  code_hash VARCHAR NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS ix_password_reset_codes_expires_at
  ON password_reset_codes(expires_at);
