"""Базовые проверки, что приложение поднимается и отвечает."""
from fastapi.testclient import TestClient

from app.main import app


def test_health():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"


def test_openapi_available():
    with TestClient(app) as client:
        r = client.get("/openapi.json")
        assert r.status_code == 200
        body = r.json()
        assert "openapi" in body
        assert "paths" in body
