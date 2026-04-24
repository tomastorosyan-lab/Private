"""
Сервис отправки email-уведомлений
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from typing import Iterable

from app.core.config import settings
from app.models.order import Order
from app.models.user import User

logger = logging.getLogger(__name__)


class EmailService:
    @staticmethod
    def is_configured() -> bool:
        return all(
            [
                settings.EMAIL_NOTIFICATIONS_ENABLED,
                settings.ORDER_NOTIFICATION_EMAIL,
                settings.SMTP_HOST,
                settings.SMTP_FROM_EMAIL,
            ]
        )

    @staticmethod
    def is_verification_configured() -> bool:
        return all(
            [
                settings.EMAIL_VERIFICATION_ENABLED,
                settings.SMTP_HOST,
                settings.SMTP_FROM_EMAIL,
            ]
        )

    @staticmethod
    def send_registration_verification_code(email: str, code: str) -> None:
        """
        Отправляет 6-значный код подтверждения для регистрации.
        """
        if not EmailService.is_verification_configured():
            logger.warning("Email verification is not configured")
            raise RuntimeError("Email verification is not configured")

        msg = EmailMessage()
        msg["Subject"] = "Код подтверждения регистрации"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = email
        msg.set_content(
            "\n".join(
                [
                    "Здравствуйте!",
                    "",
                    f"Ваш код подтверждения: {code}",
                    f"Код действует {settings.EMAIL_VERIFICATION_CODE_TTL_MINUTES} минут.",
                    "",
                    "Если вы не запрашивали регистрацию, просто проигнорируйте это письмо.",
                ]
            )
        )
        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
        except Exception:
            logger.exception("Failed to send registration verification email")
            raise

    @staticmethod
    def send_new_order_notification(
        order: Order,
        customer: User,
        supplier: User,
        item_lines: Iterable[str],
    ) -> None:
        """
        Отправляет email магазину о новом заказе.
        """
        if not EmailService.is_configured():
            logger.info("Email notifications are disabled or not fully configured")
            return

        to_email = settings.ORDER_NOTIFICATION_EMAIL
        assert to_email is not None

        msg = EmailMessage()
        msg["Subject"] = f"Новый заказ №{order.id} в DIS"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        body = [
            f"Поступил новый заказ №{order.id}.",
            "",
            f"Заказчик: {customer.full_name} ({customer.email})",
            f"Поставщик: {supplier.full_name} ({supplier.email})",
            f"Сумма: {order.total_amount} ₽",
            f"Адрес доставки: {order.delivery_address}",
            f"Телефон: {order.contact_phone or 'не указан'}",
            f"Комментарий: {order.notes or 'нет'}",
            "",
            "Позиции заказа:",
            *item_lines,
            "",
            "Письмо отправлено автоматически из DIS.",
        ]
        msg.set_content("\n".join(body))

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
        except Exception:
            logger.exception("Failed to send new order notification email")
