"""
Сервис Telegram-уведомлений.
"""
from __future__ import annotations

import json
import logging
from typing import Iterable
from urllib import error, request

from app.core.config import settings
from app.models.order import Order
from app.models.user import User

logger = logging.getLogger(__name__)


class TelegramService:
    @staticmethod
    def is_configured() -> bool:
        return bool(settings.TELEGRAM_BOT_TOKEN)

    @staticmethod
    def _request(method: str, payload: dict) -> None:
        if not settings.TELEGRAM_BOT_TOKEN:
            logger.info("Telegram bot token is not configured")
            return

        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=10) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                if resp.status >= 400:
                    logger.warning("Telegram API returned HTTP %s: %s", resp.status, body)
        except (error.URLError, TimeoutError, OSError):
            logger.exception("Telegram API request failed: %s", method)

    @staticmethod
    def send_message(chat_id: str, text: str) -> None:
        TelegramService._request(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": text,
                "disable_web_page_preview": True,
            },
        )

    @staticmethod
    def send_new_order_notification(
        order: Order,
        customer: User,
        supplier: User,
        item_lines: Iterable[str],
    ) -> None:
        if not TelegramService.is_configured():
            logger.info("Telegram notifications are disabled: token is not configured")
            return
        if not supplier.telegram_chat_id or not supplier.telegram_notifications_enabled:
            logger.info("Supplier %s has no enabled Telegram notifications", supplier.id)
            return

        site_url = settings.PUBLIC_SITE_URL.rstrip("/")
        text = "\n".join(
            [
                f"Новый заказ №{order.id}",
                "",
                f"Заказчик: {customer.full_name} ({customer.email})",
                f"Сумма: {order.total_amount} ₽",
                f"Адрес: {order.delivery_address}",
                f"Телефон: {order.contact_phone or 'не указан'}",
                f"Комментарий: {order.notes or 'нет'}",
                "",
                "Позиции:",
                *item_lines,
                "",
                f"Открыть заказ: {site_url}/orders/{order.id}",
            ]
        )
        TelegramService.send_message(supplier.telegram_chat_id, text)
