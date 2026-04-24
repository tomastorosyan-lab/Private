-- Идемпотентно: таблица кодов подтверждения email при регистрации.
CREATE TABLE IF NOT EXISTS email_verifications (
  email VARCHAR PRIMARY KEY,
  code_hash VARCHAR NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS ix_email_verifications_expires_at ON email_verifications(expires_at);
