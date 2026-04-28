"""
Простой in-memory rate limit для защиты публичных auth-endpoints.

Важно: лимит живет в памяти процесса backend. Для одного контейнера этого достаточно;
если позже будет несколько backend-инстансов, лучше заменить на Redis.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, *, limit: int, window_seconds: int, detail: str) -> None:
        if limit <= 0 or window_seconds <= 0:
            return

        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= limit:
                retry_after = max(1, int(events[0] + window_seconds - now + 0.999))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"{detail}. Повторите через {retry_after} сек.",
                    headers={"Retry-After": str(retry_after)},
                )

            events.append(now)


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


auth_rate_limiter = InMemoryRateLimiter()
