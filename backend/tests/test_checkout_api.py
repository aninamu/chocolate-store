from __future__ import annotations

import uuid

from bson.binary import Binary, UuidRepresentation
from pymongo import MongoClient
from starlette.testclient import TestClient

from app.config import settings


def _set_in_stock(cid: uuid.UUID, in_stock: bool) -> None:
    """Flip stock via sync PyMongo to avoid AsyncMongoClient event-loop binding."""
    client = MongoClient(
        settings.mongodb_url,
        uuidRepresentation="standard",
    )
    try:
        db_name = settings.mongodb_url.rsplit("/", 1)[-1] or "chocolate_store"
        result = client[db_name]["chocolates"].update_one(
            {"_id": Binary.from_uuid(cid, UuidRepresentation.STANDARD)},
            {"$set": {"in_stock": in_stock}},
        )
        if result.matched_count == 0:
            # Fallback: Beanie may store UUID as a string depending on config.
            result = client[db_name]["chocolates"].update_one(
                {"_id": str(cid)},
                {"$set": {"in_stock": in_stock}},
            )
        if result.matched_count == 0:
            raise AssertionError(f"chocolate {cid} not found in Mongo")
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
