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


def test_checkout_success(api_client: TestClient) -> None:
    listed = api_client.get("/api/chocolates")
    assert listed.status_code == 200
    ch = listed.json()[0]

    payload = {
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": ch["id"], "quantity": 2}],
    }
    r = api_client.post("/api/checkout", json=payload)
    assert r.status_code == 200
    out = r.json()
    assert "order_id" in out and "total_cents" in out
    assert out["total_cents"] == ch["price_cents"] * 2


def test_checkout_multi_item(api_client: TestClient) -> None:
    listed = api_client.get("/api/chocolates")
    assert listed.status_code == 200
    items = listed.json()[:3]
    assert len(items) >= 2

    payload = {
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [
            {"chocolate_id": items[0]["id"], "quantity": 1},
            {"chocolate_id": items[1]["id"], "quantity": 2},
            {"chocolate_id": items[2]["id"], "quantity": 1},
        ],
    }
    r = api_client.post("/api/checkout", json=payload)
    assert r.status_code == 200
    out = r.json()
    expected = (
        items[0]["price_cents"]
        + items[1]["price_cents"] * 2
        + items[2]["price_cents"]
    )
    assert out["total_cents"] == expected


def test_checkout_unknown_chocolate(api_client: TestClient) -> None:
    bad_id = str(uuid.uuid4())
    payload = {
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": bad_id, "quantity": 1}],
    }
    r = api_client.post("/api/checkout", json=payload)
    assert r.status_code == 400
    assert "unknown" in (r.json().get("detail") or "").lower()


def test_checkout_out_of_stock(api_client: TestClient) -> None:
    listed = api_client.get("/api/chocolates")
    assert listed.status_code == 200
    ch = listed.json()[0]
    cid = uuid.UUID(str(ch["id"]))

    _set_in_stock_sync(cid, False)
    try:
        payload = {
            "customer_name": "Test User",
            "customer_email": "test@example.com",
            "items": [{"chocolate_id": str(cid), "quantity": 1}],
        }
        r = api_client.post("/api/checkout", json=payload)
        assert r.status_code == 400
        detail = (r.json().get("detail") or "").lower()
        assert "stock" in detail
    finally:
        _set_in_stock_sync(cid, True)
