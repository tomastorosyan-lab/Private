"""
Отдельный процесс Telegram polling для production.
"""
from __future__ import annotations

import logging
import socket
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

    # Быстрая диагностика исходящего доступа внутри контейнера.
    # Это помогает понять, блокирует ли VDS/контейнер сеть до Telegram API.
    host = "api.telegram.org"
    port = 443
    started = time.time()
    resolved_ipv4: list[str] = []
    connect_attempts: list[dict] = []
    connect_ok = False
    connect_error: str | None = None
    try:
        infos = socket.getaddrinfo(host, port, family=socket.AF_INET, type=socket.SOCK_STREAM)
        for info in infos[:5]:
            addr = info[4][0]
            if addr not in resolved_ipv4:
                resolved_ipv4.append(addr)
    except Exception as exc:
        resolved_ipv4 = [f"DNS_ERROR:{type(exc).__name__}:{exc}"]

    try:
        for ip in resolved_ipv4[:10]:
            if ip.startswith("DNS_ERROR"):
                continue
            try:
                with socket.create_connection((ip, port), timeout=3):
                    connect_ok = True
                connect_attempts.append({"ip": ip, "ok": True})
                break
            except Exception as exc:
                connect_attempts.append({"ip": ip, "ok": False, "error": f"{type(exc).__name__}:{exc}"})
    except Exception as exc:
        connect_error = f"{type(exc).__name__}:{exc}"

    elapsed_ms = int((time.time() - started) * 1000)
    logger.info(
        "Telegram net diagnostics: host=%s port=%s resolved_ipv4=%s connect_ok=%s connect_error=%s connect_attempts=%s elapsed_ms=%s",
        host,
        port,
        resolved_ipv4,
        connect_ok,
        connect_error,
        connect_attempts,
        elapsed_ms,
    )

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
