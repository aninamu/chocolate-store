use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use chocolate_store::config::settings_from_env;
use chocolate_store::{app_state_from_settings, build_app};
use http_body_util::BodyExt;
use tower::ServiceExt;
use uuid::Uuid;

fn services_ports_open() -> bool {
    for port in [55432u16, 63790] {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        if TcpStream::connect_timeout(&addr, Duration::from_millis(1500)).is_err() {
            return false;
        }
    }
    true
}

async fn app() -> Option<axum::Router> {
    if !services_ports_open() {
        eprintln!(
            "skip: Postgres (55432) / Redis (63790) not reachable; run make services-up first"
        );
        return None;
    }
    let settings = settings_from_env().ok()?;
    let state = app_state_from_settings(settings).await.ok()?;
    Some(build_app(state))
}

async fn body_json(response: axum::response::Response) -> serde_json::Value {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null)
}

#[tokio::test]
async fn test_health_returns_shape() {
    let Some(app) = app().await else {
        return;
    };
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let data = body_json(response).await;
    assert!(data.get("ok").and_then(|v| v.as_bool()).is_some());
    assert!(data.get("database").and_then(|v| v.as_bool()).is_some());
    assert!(data.get("redis").and_then(|v| v.as_bool()).is_some());
    assert_eq!(data["ok"], true);
}

#[tokio::test]
async fn test_list_chocolates_returns_items() {
    let Some(app) = app().await else {
        return;
    };
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/chocolates")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let items = body_json(response).await;
    let arr = items.as_array().expect("array");
    assert!(!arr.is_empty());
    let first = &arr[0];
    assert!(first.get("id").is_some());
    assert!(first.get("name").is_some());
    assert!(first.get("price_cents").is_some());
}

#[tokio::test]
async fn test_list_chocolates_tag_filter_or_semantics() {
    let Some(app) = app().await else {
        return;
    };
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/chocolates?tag=dark&tag=milk")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let items = body_json(response).await.as_array().unwrap().clone();
    for row in items {
        let tags: Vec<String> = row["tags"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|t| t.as_str().map(|s| s.to_lowercase()))
            .collect();
        assert!(tags.iter().any(|t| t == "dark") || tags.iter().any(|t| t == "milk"));
    }
}

#[tokio::test]
async fn test_list_chocolates_sort_price_asc() {
    let Some(app) = app().await else {
        return;
    };
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/chocolates?sort=price_asc")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let items = body_json(response).await.as_array().unwrap().clone();
    let prices: Vec<i64> = items
        .iter()
        .map(|r| r["price_cents"].as_i64().unwrap())
        .collect();
    let mut sorted = prices.clone();
    sorted.sort();
    assert_eq!(prices, sorted);
}

#[tokio::test]
async fn test_get_chocolate_detail_and_404() {
    let Some(app) = app().await else {
        return;
    };
    let listed = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/chocolates")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let items = body_json(listed).await.as_array().unwrap().clone();
    let cid = items[0]["id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/chocolates/{cid}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_json(response).await;
    assert_eq!(body["id"].as_str().unwrap(), cid);

    let missing_id = Uuid::new_v4();
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/chocolates/{missing_id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let err = body_json(response).await;
    assert!(err.get("detail").is_some());
}

#[tokio::test]
async fn test_checkout_success() {
    let Some(app) = app().await else {
        return;
    };
    let listed = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/chocolates")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let ch = &body_json(listed).await.as_array().unwrap()[0];
    let cid = ch["id"].as_str().unwrap();
    let price = ch["price_cents"].as_i64().unwrap();

    let payload = serde_json::json!({
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": cid, "quantity": 2}]
    });
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/checkout")
                .header("content-type", "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let out = body_json(response).await;
    assert!(out.get("order_id").is_some());
    assert_eq!(out["total_cents"].as_i64().unwrap(), price * 2);
}

#[tokio::test]
async fn test_checkout_unknown_chocolate() {
    let Some(app) = app().await else {
        return;
    };
    let bad_id = Uuid::new_v4();
    let payload = serde_json::json!({
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": bad_id.to_string(), "quantity": 1}]
    });
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/checkout")
                .header("content-type", "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let err = body_json(response).await;
    let detail = err["detail"].as_str().unwrap_or("").to_lowercase();
    assert!(detail.contains("unknown"));
}

#[tokio::test]
async fn test_checkout_out_of_stock() {
    let Some(app) = app().await else {
        return;
    };
    let settings = settings_from_env().unwrap();
    let pool = chocolate_store::db::create_pool(&settings).await.unwrap();

    let listed = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/chocolates")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let ch = &body_json(listed).await.as_array().unwrap()[0];
    let cid: Uuid = ch["id"].as_str().unwrap().parse().unwrap();

    sqlx::query("UPDATE chocolates SET in_stock = FALSE WHERE id = $1")
        .bind(cid)
        .execute(&pool)
        .await
        .unwrap();

    let payload = serde_json::json!({
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "items": [{"chocolate_id": cid.to_string(), "quantity": 1}]
    });
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/checkout")
                .header("content-type", "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let detail = body_json(response).await["detail"]
        .as_str()
        .unwrap_or("")
        .to_lowercase();
    assert!(detail.contains("stock"));

    sqlx::query("UPDATE chocolates SET in_stock = TRUE WHERE id = $1")
        .bind(cid)
        .execute(&pool)
        .await
        .unwrap();
}
