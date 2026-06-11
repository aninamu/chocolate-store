from __future__ import annotations

import asyncio
import uuid

from starlette.testclient import TestClient


async def _set_in_stock_async(cid: uuid.UUID, in_stock: bool) -> None:
    import os

    from motor.motor_asyncio import AsyncIOMotorClient

    client = AsyncIOMotorClient(os.environ["MONGODB_URL"])
    try:
        db = client.get_default_database()
        await db["chocolates"].update_one(
            {"_id": cid},
            {"$set": {"in_stock": in_stock}},
        )
    finally:
        client.close()


def _set_in_stock(cid: uuid.UUID, in_stock: bool) -> None:
    asyncio.run(_set_in_stock_async(cid, in_stock))


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

    _set_in_stock(cid, False)
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
        _set_in_stock(cid, True)
