mod common;

use axum::http::StatusCode;
use common::{get_json, post_json, skip_if_services_down, test_app};
use serde_json::json;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

fn database_url() -> String {
    let raw = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql+asyncpg://chocolate@127.0.0.1:55432/chocolate_store".to_string()
    });
    raw.replace("postgresql+asyncpg://", "postgres://")
        .replace("postgresql://", "postgres://")
}

async fn set_in_stock(cid: Uuid, in_stock: bool) {
    let pool = PgPoolOptions::new()
        .connect(&database_url())
        .await
        .expect("db connect");
    sqlx::query("UPDATE chocolates SET in_stock = $1 WHERE id = $2")
        .bind(in_stock)
        .bind(cid)
        .execute(&pool)
        .await
        .expect("update in_stock");
    pool.close().await;
}

#[tokio::test]
async fn checkout_success() {
    skip_if_services_down();
    let app = test_app().await;

    let (_, items) = get_json(&app, "/api/chocolates").await;
    let ch = &items.as_array().unwrap()[0];

    let payload = json!({
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": ch["id"], "quantity": 2}]
    });

    let (status, out) = post_json(&app, "/api/checkout", payload).await;
    assert_eq!(status, StatusCode::OK);
    assert!(out.get("order_id").is_some());
    assert!(out.get("total_cents").is_some());
    assert_eq!(
        out["total_cents"].as_i64().unwrap(),
        ch["price_cents"].as_i64().unwrap() * 2
    );
}

#[tokio::test]
async fn checkout_unknown_chocolate() {
    skip_if_services_down();
    let app = test_app().await;

    let bad_id = Uuid::new_v4();
    let payload = json!({
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": bad_id.to_string(), "quantity": 1}]
    });

    let (status, err) = post_json(&app, "/api/checkout", payload).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let detail = err["detail"].as_str().unwrap_or("").to_lowercase();
    assert!(detail.contains("unknown"));
}

#[tokio::test]
async fn checkout_out_of_stock() {
    skip_if_services_down();
    let app = test_app().await;

    let (_, items) = get_json(&app, "/api/chocolates").await;
    let ch = &items.as_array().unwrap()[0];
    let cid = Uuid::parse_str(ch["id"].as_str().unwrap()).unwrap();

    set_in_stock(cid, false).await;
    let payload = json!({
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": cid.to_string(), "quantity": 1}]
    });

    let (status, err) = post_json(&app, "/api/checkout", payload).await;
    set_in_stock(cid, true).await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    let detail = err["detail"].as_str().unwrap_or("").to_lowercase();
    assert!(detail.contains("stock"));
}
