"""
Фоновый polling для Telegram-бота.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import suppress

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.telegram_service import TelegramService

logger = logging.getLogger(__name__)


class TelegramPollingWorker:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._offset: int | None = None

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        if not settings.TELEGRAM_POLLING_ENABLED:
            logger.info("Telegram polling is disabled")
            return
        if not TelegramService.is_configured():
            logger.info("Telegram polling is disabled: bot token is not configured")
            return
        self._task = asyncio.create_task(self._run(), name="telegram-polling")
        logger.info("Telegram polling started")

    async def stop(self) -> None:
        if not self._task:
            return
        self._task.cancel()
        with suppress(asyncio.CancelledError):
            await self._task
        self._task = None
        logger.info("Telegram polling stopped")

    async def _run(self) -> None:
        while True:
            try:
                updates = await asyncio.to_thread(
                    TelegramService.get_updates,
                    self._offset,
                    settings.TELEGRAM_POLLING_TIMEOUT_SECONDS,
                )
                for update in updates:
                    update_id = update.get("update_id")
                    if isinstance(update_id, int):
                        self._offset = update_id + 1
                    self._process_update(update)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Telegram polling iteration failed")
                await asyncio.sleep(2)

    def _process_update(self, update: dict) -> None:
        db = SessionLocal()
        try:
            TelegramService.handle_update(db, update)
        finally:
            db.close()
