from __future__ import annotations

import os
import uuid

from pymongo import MongoClient
from starlette.testclient import TestClient


def _mongo_client() -> MongoClient:
    return MongoClient(os.environ["MONGODB_URL"])


def _set_in_stock_sync(cid: uuid.UUID, in_stock: bool) -> None:
    client = _mongo_client()
    try:
        db = client.get_default_database()
        db.chocolates.update_one(
            {"id": str(cid)},
            {"$set": {"in_stock": in_stock}},
        )
    finally:
        client.close()


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
