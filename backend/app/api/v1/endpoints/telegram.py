"""
Webhook Telegram-бота.
"""
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
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
    if chat_id is None:
        return {"ok": True}

    TelegramService.handle_start_command(db, str(chat_id), text)
    return {"ok": True}
