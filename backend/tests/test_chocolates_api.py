from __future__ import annotations

import uuid

from starlette.testclient import TestClient


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


def test_search_chocolates_by_name(api_client: TestClient) -> None:
    r = api_client.get("/api/chocolates/search", params={"q": "Milk"})
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    for row in items:
        assert "milk" in row["name"].lower()
        assert "id" in row and "name" in row and "price_cents" in row


def test_search_chocolates_requires_non_empty_q(api_client: TestClient) -> None:
    r = api_client.get("/api/chocolates/search", params={"q": ""})
    assert r.status_code == 422


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
