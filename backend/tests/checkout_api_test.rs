mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use common::{response_json, services_ports_open, set_in_stock, test_app};

#[tokio::test]
async fn test_checkout_success() {
    if !services_ports_open() {
        eprintln!("skip: Postgres (55432) / Redis (63790) not reachable");
        return;
    }

    let app = test_app().await;
    let (_, listed) = response_json(
        &app,
        Request::builder()
            .uri("/api/chocolates")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    let ch = &listed[0];
    let payload = serde_json::json!({
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": ch["id"], "quantity": 2}],
    });

    let (status, out) = response_json(
        &app,
        Request::builder()
            .method("POST")
            .uri("/api/checkout")
            .header("content-type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(out.get("order_id").is_some());
    assert!(out.get("total_cents").is_some());
    assert_eq!(
        out["total_cents"].as_i64().unwrap(),
        ch["price_cents"].as_i64().unwrap() * 2
    );
}

#[tokio::test]
async fn test_checkout_unknown_chocolate() {
    if !services_ports_open() {
        eprintln!("skip: Postgres (55432) / Redis (63790) not reachable");
        return;
    }

    let app = test_app().await;
    let bad_id = uuid::Uuid::new_v4();
    let payload = serde_json::json!({
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": bad_id.to_string(), "quantity": 1}],
    });

    let (status, body) = response_json(
        &app,
        Request::builder()
            .method("POST")
            .uri("/api/checkout")
            .header("content-type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    let detail = body["detail"].as_str().unwrap_or("").to_lowercase();
    assert!(detail.contains("unknown"));
}

#[tokio::test]
async fn test_checkout_out_of_stock() {
    if !services_ports_open() {
        eprintln!("skip: Postgres (55432) / Redis (63790) not reachable");
        return;
    }

    let app = test_app().await;
    let (_, listed) = response_json(
        &app,
        Request::builder()
            .uri("/api/chocolates")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    let ch = &listed[0];
    let cid = uuid::Uuid::parse_str(ch["id"].as_str().unwrap()).unwrap();

    set_in_stock(cid, false).await;
    let payload = serde_json::json!({
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": cid.to_string(), "quantity": 1}],
    });

    let (status, body) = response_json(
        &app,
        Request::builder()
            .method("POST")
            .uri("/api/checkout")
            .header("content-type", "application/json")
            .body(Body::from(payload.to_string()))
            .unwrap(),
    )
    .await;

    set_in_stock(cid, true).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    let detail = body["detail"].as_str().unwrap_or("").to_lowercase();
    assert!(detail.contains("stock"));
}
