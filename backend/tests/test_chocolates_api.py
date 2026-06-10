from __future__ import annotations

import os
import uuid

from sqlalchemy import create_engine, text
from starlette.testclient import TestClient

from app.routers.chocolates import _list_cache_key


def _sync_engine():
    raw = os.environ["DATABASE_URL"]
    sync_url = raw.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    return create_engine(sync_url)


def _set_in_stock_sync(cid: uuid.UUID, in_stock: bool) -> None:
    eng = _sync_engine()
    try:
        with eng.begin() as conn:
            conn.execute(
                text("UPDATE chocolates SET in_stock = :flag WHERE id = :cid"),
                {"flag": in_stock, "cid": cid},
            )
    finally:
        eng.dispose()


def test_list_chocolates_returns_items(api_client: TestClient) -> None:
    r = api_client.get("/api/chocolates")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    first = items[0]
    assert "id" in first and "name" in first and "price_cents" in first
    assert "churrito_quote" in first
    assert first["churrito_quote"]


def test_list_chocolates_tag_filter_or_semantics(api_client: TestClient) -> None:
    r = api_client.get("/api/chocolates", params=[("tag", "dark"), ("tag", "milk")])
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    for row in items:
        tags = {t.lower() for t in row.get("tags", [])}
        assert "dark" in tags or "milk" in tags


def test_list_chocolates_available_filter(api_client: TestClient) -> None:
    r = api_client.get("/api/chocolates", params={"available": "true"})
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    for row in items:
        assert row["in_stock"] is True


def test_list_cache_key_distinguishes_available_filter() -> None:
    unfiltered = _list_cache_key(None, "name", None)
    in_stock_only = _list_cache_key(None, "name", True)
    assert unfiltered != in_stock_only
    assert unfiltered.endswith(":all")
    assert in_stock_only.endswith(":in_stock")


def test_list_chocolates_available_uses_separate_list_cache(
    api_client: TestClient,
) -> None:
    """Regression: list Redis keys must include available or caches cross-contaminate."""
    listed = api_client.get("/api/chocolates")
    assert listed.status_code == 200
    cid = uuid.UUID(listed.json()[0]["id"])
    _set_in_stock_sync(cid, False)
    try:
        unfiltered_first = api_client.get("/api/chocolates")
        assert unfiltered_first.status_code == 200
        assert any(row["id"] == str(cid) for row in unfiltered_first.json())

        available_after_unfiltered = api_client.get(
            "/api/chocolates", params={"available": "true"}
        )
        assert available_after_unfiltered.status_code == 200
        available_rows = available_after_unfiltered.json()
        assert all(row["in_stock"] for row in available_rows)
        assert not any(row["id"] == str(cid) for row in available_rows)

        available_first = api_client.get(
            "/api/chocolates", params={"available": "true"}
        )
        assert available_first.status_code == 200

        unfiltered_after_available = api_client.get("/api/chocolates")
        assert unfiltered_after_available.status_code == 200
        assert any(
            row["id"] == str(cid) for row in unfiltered_after_available.json()
        )
    finally:
        _set_in_stock_sync(cid, True)


def test_list_chocolates_sort_price_asc(api_client: TestClient) -> None:
    r = api_client.get("/api/chocolates", params={"sort": "price_asc"})
    assert r.status_code == 200
    items = r.json()
    prices = [row["price_cents"] for row in items]
    assert prices == sorted(prices)


def test_get_chocolate_detail_and_404(api_client: TestClient) -> None:
    listed = api_client.get("/api/chocolates")
    assert listed.status_code == 200
    cid = listed.json()[0]["id"]

    r = api_client.get(f"/api/chocolates/{cid}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == cid
    assert "churrito_quote" in body
    assert body["churrito_quote"]

    missing = api_client.get(f"/api/chocolates/{uuid.uuid4()}")
    assert missing.status_code == 404
    assert missing.json().get("detail")
