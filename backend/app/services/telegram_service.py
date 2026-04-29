"""
Сервис Telegram-уведомлений.
"""
from __future__ import annotations

import json
import logging
import os
import socket
from typing import Iterable
from urllib import error, request

from app.core.config import settings
from app.models.order import Order, OrderStatus
from app.models.user import User

logger = logging.getLogger(__name__)


class TelegramService:
    STATUS_LABELS = {
        OrderStatus.PENDING: "ожидает обработки",
        OrderStatus.CONFIRMED: "подтвержден",
        OrderStatus.PROCESSING: "в обработке",
        OrderStatus.SHIPPED: "отправлен",
        OrderStatus.DELIVERED: "доставлен",
        OrderStatus.CANCELLED: "отменен",
    }

    @staticmethod
    def is_configured() -> bool:
        return bool(settings.TELEGRAM_BOT_TOKEN)

    @staticmethod
    def _request(method: str, payload: dict, request_timeout: int = 10) -> dict | None:
        if not settings.TELEGRAM_BOT_TOKEN:
            logger.info("Telegram bot token is not configured")
            return None

        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        original_getaddrinfo = socket.getaddrinfo

        def ipv4_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
            return original_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)

        try:
            socket.getaddrinfo = ipv4_getaddrinfo
            # Прокси обычно задают на уровне окружения (HTTPS_PROXY/HTTP_PROXY).
            # Явно прокидываем ProxyHandler, чтобы urllib точно использовал их.
            http_proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
            https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
            proxies: dict[str, str] = {}
            if http_proxy:
                proxies["http"] = http_proxy
            if https_proxy:
                proxies["https"] = https_proxy

            opener = request.build_opener(request.ProxyHandler(proxies)) if proxies else None
            resp_status: int | None = None
            if opener is not None:
                logger.info("Telegram API request via proxy (from env)")
                with opener.open(req, timeout=request_timeout) as resp:
                    resp_status = getattr(resp, "status", None)
                    body = resp.read().decode("utf-8", errors="replace")
            else:
                with request.urlopen(req, timeout=request_timeout) as resp:
                    resp_status = getattr(resp, "status", None)
                    body = resp.read().decode("utf-8", errors="replace")

            if resp_status is not None and resp_status >= 400:
                logger.warning("Telegram API returned HTTP %s: %s", resp_status, body)
                return None
            return json.loads(body)
        except (error.URLError, TimeoutError, OSError):
            logger.exception("Telegram API request failed: %s", method)
        except json.JSONDecodeError:
            logger.exception("Telegram API returned invalid JSON: %s", method)
        finally:
            socket.getaddrinfo = original_getaddrinfo
        return None

    @staticmethod
    def get_updates(offset: int | None = None, timeout: int | None = None) -> list[dict]:
        payload: dict = {
            "timeout": timeout if timeout is not None else settings.TELEGRAM_POLLING_TIMEOUT_SECONDS,
            "allowed_updates": ["message", "edited_message"],
        }
        if offset is not None:
            payload["offset"] = offset
        request_timeout = int(payload["timeout"]) + 5
        result = TelegramService._request("getUpdates", payload, request_timeout=request_timeout)
        if not result or not result.get("ok"):
            return []
        updates = result.get("result")
        return updates if isinstance(updates, list) else []

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
    def handle_start_command(db, chat_id: str, text: str) -> bool:
        from app.models.user import User

        text = text.strip()
        if not text.startswith("/start"):
            return False

        parts = text.split(maxsplit=1)
        if len(parts) < 2 or not parts[1].strip():
            return True

        code = parts[1].strip().upper()
        user = (
            db.query(User)
            .filter(
                User.telegram_connect_code == code,
                User.is_active == True,
            )
            .first()
        )
        if not user:
            TelegramService.send_message(chat_id, "Код подключения не найден или уже использован.")
            return True

        user.telegram_chat_id = chat_id
        user.telegram_notifications_enabled = True
        user.telegram_connect_code = None
        db.commit()

        TelegramService.send_message(
            chat_id,
            f"Telegram-уведомления подключены для пользователя: {user.full_name}.",
        )
        return True

    @staticmethod
    def handle_update(db, update: dict) -> bool:
        message = update.get("message") or update.get("edited_message") or {}
        text = str(message.get("text") or "").strip()
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if chat_id is None or not text:
            return False
        return TelegramService.handle_start_command(db, str(chat_id), text)

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

    @staticmethod
    def send_order_status_changed_notification(
        order: Order,
        customer: User,
        supplier: User,
        old_status: OrderStatus,
        new_status: OrderStatus,
    ) -> None:
        if not TelegramService.is_configured():
            logger.info("Telegram notifications are disabled: token is not configured")
            return
        if not customer.telegram_chat_id or not customer.telegram_notifications_enabled:
            logger.info("Customer %s has no enabled Telegram notifications", customer.id)
            return

        site_url = settings.PUBLIC_SITE_URL.rstrip("/")
        old_label = TelegramService.STATUS_LABELS.get(old_status, str(old_status))
        new_label = TelegramService.STATUS_LABELS.get(new_status, str(new_status))
        text = "\n".join(
            [
                f"Статус заказа №{order.id} изменен",
                "",
                f"Было: {old_label}",
                f"Стало: {new_label}",
                f"Поставщик: {supplier.full_name}",
                f"Сумма: {order.total_amount} ₽",
                "",
                f"Открыть заказ: {site_url}/orders/{order.id}",
            ]
        )
        TelegramService.send_message(customer.telegram_chat_id, text)
