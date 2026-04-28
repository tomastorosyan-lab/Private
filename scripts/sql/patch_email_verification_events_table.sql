-- Идемпотентно: журнал запросов, отправок и успешных подтверждений email-кодов.
CREATE TABLE IF NOT EXISTS email_verification_events (
  id SERIAL PRIMARY KEY,
  email VARCHAR NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ NULL,
  validated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_email_verification_events_email
  ON email_verification_events(email);

CREATE INDEX IF NOT EXISTS ix_email_verification_events_requested_at
  ON email_verification_events(requested_at);

CREATE INDEX IF NOT EXISTS ix_email_verification_events_sent_at
  ON email_verification_events(sent_at);

CREATE INDEX IF NOT EXISTS ix_email_verification_events_validated_at
  ON email_verification_events(validated_at);
