from __future__ import annotations

import uuid

from starlette.testclient import TestClient

from app.seed import DEMO_USER_ALICE, DEMO_USER_BOB, DEMO_USER_MOD

ALICE = {"X-Demo-User-Id": DEMO_USER_ALICE}
BOB = {"X-Demo-User-Id": DEMO_USER_BOB}
MOD = {"X-Demo-User-Id": DEMO_USER_MOD}


def _first_post_id(client: TestClient) -> str:
    r = client.get("/api/feed")
    assert r.status_code == 200
    items = r.json()["items"]
    assert items
    return items[0]["id"]


def _first_chocolate_id(client: TestClient) -> str:
    r = client.get("/api/chocolates")
    assert r.status_code == 200
    return r.json()[0]["id"]


def test_list_feed_populated(api_client: TestClient) -> None:
    r = api_client.get("/api/feed")
    assert r.status_code == 200
    body = r.json()
    assert len(body["items"]) >= 1
    first = body["items"][0]
    assert "author" in first
    assert "like_count" in first
    assert "comment_count" in first


def test_list_feed_empty_offset(api_client: TestClient) -> None:
    r = api_client.get("/api/feed", params={"offset": 9999})
    assert r.status_code == 200
    assert r.json()["items"] == []


def test_get_post_detail_and_404(api_client: TestClient) -> None:
    pid = _first_post_id(api_client)
    r = api_client.get(f"/api/posts/{pid}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == pid
    assert isinstance(body["comments"], list)

    missing = api_client.get(f"/api/posts/{uuid.uuid4()}")
    assert missing.status_code == 404


def test_create_post_validation_and_success(api_client: TestClient) -> None:
    no_user = api_client.post("/api/posts", json={"text": "hello"})
    assert no_user.status_code == 401

    bad_len = api_client.post(
        "/api/posts", json={"text": ""}, headers=ALICE
    )
    assert bad_len.status_code == 422

    bad_product = api_client.post(
        "/api/posts",
        json={"text": "hi", "chocolate_id": str(uuid.uuid4())},
        headers=ALICE,
    )
    assert bad_product.status_code == 400

    cid = _first_chocolate_id(api_client)
    ok = api_client.post(
        "/api/posts",
        json={
            "text": "Fresh post from tests",
            "chocolate_id": cid,
            "image_url": "https://images.unsplash.com/photo-1511381939415-e44015466834?w=400",
        },
        headers=ALICE,
    )
    assert ok.status_code == 201
    body = ok.json()
    assert body["text"] == "Fresh post from tests"
    assert body["product"]["id"] == cid


def test_like_unlike_and_duplicate(api_client: TestClient) -> None:
    pid = _first_post_id(api_client)
    like1 = api_client.post(f"/api/posts/{pid}/likes", headers=BOB)
    assert like1.status_code == 201
    count1 = like1.json()["like_count"]

    like2 = api_client.post(f"/api/posts/{pid}/likes", headers=BOB)
    assert like2.status_code == 201
    assert like2.json()["like_count"] == count1

    unlike = api_client.delete(f"/api/posts/{pid}/likes", headers=BOB)
    assert unlike.status_code == 200
    assert unlike.json()["like_count"] <= count1


def test_comments_create_list_and_validation(api_client: TestClient) -> None:
    pid = _first_post_id(api_client)
    bad = api_client.post(
        f"/api/posts/{pid}/comments", json={"text": ""}, headers=ALICE
    )
    assert bad.status_code == 422

    created = api_client.post(
        f"/api/posts/{pid}/comments",
        json={"text": "Nice pick!"},
        headers=ALICE,
    )
    assert created.status_code == 201
    assert created.json()["text"] == "Nice pick!"

    listed = api_client.get(f"/api/posts/{pid}/comments")
    assert listed.status_code == 200
    assert any(c["text"] == "Nice pick!" for c in listed.json())


def test_delete_post_permissions(api_client: TestClient) -> None:
    created = api_client.post(
        "/api/posts",
        json={"text": "Delete me"},
        headers=ALICE,
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    denied = api_client.delete(f"/api/posts/{pid}", headers=BOB)
    assert denied.status_code == 403

    ok = api_client.delete(f"/api/posts/{pid}", headers=ALICE)
    assert ok.status_code == 204

    detail = api_client.get(f"/api/posts/{pid}")
    assert detail.status_code == 200
    assert detail.json()["text"] == "[removed]"


def test_delete_comment(api_client: TestClient) -> None:
    pid = _first_post_id(api_client)
    created = api_client.post(
        f"/api/posts/{pid}/comments",
        json={"text": "temp comment"},
        headers=BOB,
    )
    cid = created.json()["id"]
    ok = api_client.delete(f"/api/comments/{cid}", headers=BOB)
    assert ok.status_code == 204


def test_users_and_profile(api_client: TestClient) -> None:
    users = api_client.get("/api/users")
    assert users.status_code == 200
    assert len(users.json()) >= 2

    profile = api_client.get(f"/api/users/{DEMO_USER_ALICE}")
    assert profile.status_code == 200
    assert profile.json()["user"]["name"] == "Alice Chen"
    assert profile.json()["post_count"] >= 1

    posts = api_client.get(f"/api/users/{DEMO_USER_ALICE}/posts")
    assert posts.status_code == 200
    assert len(posts.json()["items"]) >= 1


def test_reports_and_moderation(api_client: TestClient) -> None:
    pid = _first_post_id(api_client)
    report = api_client.post(
        "/api/reports",
        json={"entity_type": "post", "entity_id": pid, "reason": "spam"},
        headers=BOB,
    )
    assert report.status_code == 201
    assert report.json()["status"] == "open"

    denied = api_client.get("/api/reports", headers=ALICE)
    assert denied.status_code == 403

    open_reports = api_client.get("/api/reports", headers=MOD)
    assert open_reports.status_code == 200
    rid = open_reports.json()[0]["id"]

    resolved = api_client.post(f"/api/reports/{rid}/resolve", headers=MOD)
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"

    mod_delete = api_client.delete(f"/api/posts/{pid}", headers=MOD)
    assert mod_delete.status_code == 204
