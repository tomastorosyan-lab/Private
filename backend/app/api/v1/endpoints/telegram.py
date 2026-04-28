"""
Webhook Telegram-бота.
"""
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserType
from app.services.telegram_service import TelegramService

router = APIRouter()


@router.post(
    "/webhook/{secret}",
    summary="Webhook Telegram-бота",
    tags=["Telegram"],
)
async def telegram_webhook(
    payload: dict,
    secret: str = Path(..., description="Секрет webhook"),
    db: Session = Depends(get_db),
):
    if not settings.TELEGRAM_WEBHOOK_SECRET or secret != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    message = payload.get("message") or payload.get("edited_message") or {}
    text = str(message.get("text") or "").strip()
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    if not text.startswith("/start") or chat_id is None:
        return {"ok": True}

    parts = text.split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        TelegramService.send_message(
            str(chat_id),
            "Для подключения уведомлений откройте профиль поставщика на сайте и отправьте команду /start с кодом.",
        )
        return {"ok": True}

    code = parts[1].strip().upper()
    supplier = (
        db.query(User)
        .filter(
            User.user_type == UserType.SUPPLIER,
            User.telegram_connect_code == code,
            User.is_active == True,
        )
        .first()
    )
    if not supplier:
        TelegramService.send_message(str(chat_id), "Код подключения не найден или уже использован.")
        return {"ok": True}

    supplier.telegram_chat_id = str(chat_id)
    supplier.telegram_notifications_enabled = True
    supplier.telegram_connect_code = None
    db.commit()

    TelegramService.send_message(
        str(chat_id),
        f"Telegram-уведомления подключены для поставщика: {supplier.full_name}.",
    )
    return {"ok": True}
