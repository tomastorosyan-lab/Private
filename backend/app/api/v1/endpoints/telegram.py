"""
Webhook Telegram-бота.
"""
import json
from urllib import error, request

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.database import SessionLocal
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


@router.get(
    "/polling-status/{secret}",
    summary="Статус Telegram polling",
    tags=["Telegram"],
)
async def telegram_polling_status(secret: str = Path(..., description="Секрет webhook")):
    if not settings.TELEGRAM_WEBHOOK_SECRET or secret != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return {
        "configured": TelegramService.is_configured(),
        "polling_enabled": settings.TELEGRAM_POLLING_ENABLED,
        "polling_timeout_seconds": settings.TELEGRAM_POLLING_TIMEOUT_SECONDS,
    }


@router.post(
    "/poll-once/{secret}",
    summary="Однократная обработка Telegram updates",
    tags=["Telegram"],
)
async def telegram_poll_once(secret: str = Path(..., description="Секрет webhook")):
    if not settings.TELEGRAM_WEBHOOK_SECRET or secret != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    updates = TelegramService.get_updates(timeout=0)
    processed = 0
    max_update_id = None
    for update in updates:
        update_id = update.get("update_id")
        if isinstance(update_id, int):
            max_update_id = update_id if max_update_id is None else max(max_update_id, update_id)
    if max_update_id is not None:
        TelegramService.get_updates(offset=max_update_id + 1, timeout=0)

    db = SessionLocal()
    try:
        for update in updates:
            if TelegramService.handle_update(db, update):
                processed += 1
    finally:
        db.close()

    return {"ok": True, "received": len(updates), "processed": processed}


@router.get(
    "/bot-debug/{secret}",
    summary="Диагностика Telegram Bot API",
    tags=["Telegram"],
)
async def telegram_bot_debug(secret: str = Path(..., description="Секрет webhook")):
    if not settings.TELEGRAM_WEBHOOK_SECRET or secret != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if not settings.TELEGRAM_BOT_TOKEN:
        return {"configured": False}

    def call(method: str, payload: dict | None = None) -> dict:
        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}"
        data = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
        req = request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=20) as resp:
                body = json.loads(resp.read().decode("utf-8", errors="replace"))
                if isinstance(body.get("result"), list):
                    body["result_count"] = len(body["result"])
                    body["result"] = [
                        {
                            "update_id": item.get("update_id"),
                            "text": (
                                (item.get("message") or item.get("edited_message") or {}).get("text")
                            ),
                        }
                        for item in body["result"][:5]
                    ]
                return body
        except error.HTTPError as exc:
            return {
                "ok": False,
                "http_status": exc.code,
                "body": exc.read().decode("utf-8", errors="replace")[:500],
            }
        except Exception as exc:
            return {"ok": False, "error": type(exc).__name__, "message": str(exc)}

    return {
        "configured": True,
        "get_me": call("getMe"),
        "get_updates": call("getUpdates", {"timeout": 0, "allowed_updates": ["message", "edited_message"]}),
    }
