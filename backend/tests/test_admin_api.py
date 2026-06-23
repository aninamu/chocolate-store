from __future__ import annotations

from starlette.testclient import TestClient


def test_admin_search_orders_by_email(api_client: TestClient) -> None:
    listed = api_client.get("/api/chocolates")
    assert listed.status_code == 200
    chocolates = listed.json()
    assert len(chocolates) >= 2

    email = "admin-search@example.com"
    payload = {
        "customer_name": "Admin Search",
        "customer_email": email,
        "items": [
            {"chocolate_id": chocolates[0]["id"], "quantity": 1},
            {"chocolate_id": chocolates[1]["id"], "quantity": 2},
        ],
    }
    checkout = api_client.post("/api/checkout", json=payload)
    assert checkout.status_code == 200
    expected_total = (
        chocolates[0]["price_cents"] + chocolates[1]["price_cents"] * 2
    )
    assert checkout.json()["total_cents"] == expected_total

    r = api_client.get(
        "/api/admin/orders",
        params={"filter": f'{{"customer_email": "{email}"}}'},
    )
    assert r.status_code == 200
    orders = r.json()
    assert isinstance(orders, list)
    assert len(orders) >= 1
    match = next(o for o in orders if o["customer_email"] == email)
    assert match["total_cents"] == expected_total
    assert "_id" not in match
