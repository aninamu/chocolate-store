from __future__ import annotations

import os
import uuid

import redis
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


def _flush_chocolates_list_cache() -> None:
    client = redis.Redis.from_url(
        os.environ.get("REDIS_URL", "redis://127.0.0.1:63790/0"),
        decode_responses=True,
    )
    try:
        for key in client.scan_iter(match="chocolates:list:*"):
            client.delete(key)
    finally:
        client.close()


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


def test_list_chocolates_available_filter_excludes_out_of_stock(
    api_client: TestClient,
) -> None:
    _flush_chocolates_list_cache()
    listed = api_client.get("/api/chocolates")
    assert listed.status_code == 200
    all_items = listed.json()
    assert len(all_items) >= 1
    cid = uuid.UUID(all_items[0]["id"])

    _set_in_stock_sync(cid, False)
    try:
        _flush_chocolates_list_cache()
        unfiltered = api_client.get("/api/chocolates")
        filtered = api_client.get("/api/chocolates", params={"available": "true"})
        assert unfiltered.status_code == 200
        assert filtered.status_code == 200

        unfiltered_ids = {row["id"] for row in unfiltered.json()}
        filtered_ids = {row["id"] for row in filtered.json()}
        assert str(cid) in unfiltered_ids
        assert str(cid) not in filtered_ids
        assert len(filtered.json()) < len(unfiltered.json())
    finally:
        _set_in_stock_sync(cid, True)


def test_list_chocolates_available_cache_key_not_unfiltered_list(
    api_client: TestClient,
) -> None:
    """available=true must not reuse the unfiltered list cache entry."""
    _flush_chocolates_list_cache()
    listed = api_client.get("/api/chocolates")
    assert listed.status_code == 200
    cid = uuid.UUID(listed.json()[0]["id"])

    try:
        api_client.get("/api/chocolates")
        _set_in_stock_sync(cid, False)
        filtered = api_client.get("/api/chocolates", params={"available": "true"})
        assert filtered.status_code == 200
        assert str(cid) not in {row["id"] for row in filtered.json()}
    finally:
        _set_in_stock_sync(cid, True)


def test_list_chocolates_unfiltered_cache_key_not_available_list(
    api_client: TestClient,
) -> None:
    """Unfiltered list must not reuse the in-stock-only cache entry."""
    _flush_chocolates_list_cache()
    listed = api_client.get("/api/chocolates")
    assert listed.status_code == 200
    cid = uuid.UUID(listed.json()[0]["id"])

    _set_in_stock_sync(cid, False)
    try:
        _flush_chocolates_list_cache()
        api_client.get("/api/chocolates", params={"available": "true"})
        unfiltered = api_client.get("/api/chocolates")
        assert unfiltered.status_code == 200
        row = next(r for r in unfiltered.json() if r["id"] == str(cid))
        assert row["in_stock"] is False
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
