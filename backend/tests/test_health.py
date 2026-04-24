from __future__ import annotations

from starlette.testclient import TestClient


def test_health_returns_shape(api_client: TestClient) -> None:
    r = api_client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert "ok" in data and "database" in data and "redis" in data
    assert isinstance(data["ok"], bool)
    assert isinstance(data["database"], bool)
    assert isinstance(data["redis"], bool)
    assert data["ok"] is True
