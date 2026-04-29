"""
Отдельный процесс Telegram polling для production.
"""
from __future__ import annotations

import logging
import time

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.telegram_service import TelegramService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def process_update(update: dict) -> None:
    db = SessionLocal()
    try:
        TelegramService.handle_update(db, update)
    finally:
        db.close()


def main() -> None:
    if not settings.TELEGRAM_POLLING_ENABLED:
        logger.info("Telegram polling disabled")
        return
    if not TelegramService.is_configured():
        logger.info("Telegram polling disabled: bot token is not configured")
        return

    logger.info("Telegram polling runner started")
    offset: int | None = None
    while True:
        try:
            updates = TelegramService.get_updates(
                offset=offset,
                timeout=settings.TELEGRAM_POLLING_TIMEOUT_SECONDS,
            )
            max_update_id = None
            for update in updates:
                update_id = update.get("update_id")
                if isinstance(update_id, int):
                    max_update_id = update_id if max_update_id is None else max(max_update_id, update_id)
            if max_update_id is not None:
                offset = max_update_id + 1
                # Подтверждаем Telegram получение пачки до обработки, чтобы старые сообщения не зависали.
                TelegramService.get_updates(offset=offset, timeout=0)
            for update in updates:
                process_update(update)
        except Exception:
            logger.exception("Telegram polling runner iteration failed")
            time.sleep(2)


if __name__ == "__main__":
    main()
