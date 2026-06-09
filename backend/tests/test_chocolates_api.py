from __future__ import annotations

import os
import uuid

from sqlalchemy import create_engine, text
from starlette.testclient import TestClient


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


def _clear_list_cache_sync() -> None:
    import redis

    r = redis.Redis.from_url(
        os.environ.get("REDIS_URL", "redis://127.0.0.1:63790/0"),
        decode_responses=True,
    )
    try:
        for key in r.scan_iter("chocolates:list:*"):
            r.delete(key)
    finally:
        r.close()


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


def test_list_chocolates_sort_price_asc(api_client: TestClient) -> None:
    r = api_client.get("/api/chocolates", params={"sort": "price_asc"})
    assert r.status_code == 200
    items = r.json()
    prices = [row["price_cents"] for row in items]
    assert prices == sorted(prices)


def test_list_chocolates_in_stock_only(api_client: TestClient) -> None:
    eng = _sync_engine()
    try:
        with eng.connect() as conn:
            row = conn.execute(
                text("SELECT id FROM chocolates ORDER BY name LIMIT 1")
            ).one()
            out_of_stock_id = uuid.UUID(str(row[0]))
    finally:
        eng.dispose()

    _set_in_stock_sync(out_of_stock_id, False)
    try:
        _clear_list_cache_sync()
        r = api_client.get("/api/chocolates", params={"in_stock_only": "true"})
        assert r.status_code == 200
        items = r.json()
        ids = {row["id"] for row in items}
        assert str(out_of_stock_id) not in ids
        assert all(row["in_stock"] for row in items)
    finally:
        _set_in_stock_sync(out_of_stock_id, True)


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
