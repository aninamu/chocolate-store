use std::net::TcpStream;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use chocolate_store_api::build_app_from_env;
use http_body_util::BodyExt;
use tower::ServiceExt;

pub fn services_ports_open() -> bool {
    for port in [55432_u16, 63790] {
        if TcpStream::connect_timeout(
            &format!("127.0.0.1:{port}").parse().unwrap(),
            Duration::from_millis(1500),
        )
        .is_err()
        {
            return false;
        }
    }
    true
}

pub async fn test_app() -> axum::Router {
    build_app_from_env().await
}

pub async fn response_json(app: &axum::Router, req: Request<Body>) -> (StatusCode, serde_json::Value) {
    let response = app.clone().oneshot(req).await.expect("request failed");
    let status = response.status();
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = if body.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::from_slice(&body).unwrap_or(serde_json::Value::Null)
    };
    (status, json)
}

#[allow(dead_code)]
pub async fn set_in_stock(chocolate_id: uuid::Uuid, in_stock: bool) {
    let settings = chocolate_store_api::config::Settings::from_env();
    let pool = chocolate_store_api::db::create_pool(&settings).await;
    sqlx::query("UPDATE chocolates SET in_stock = $1 WHERE id = $2")
        .bind(in_stock)
        .bind(chocolate_id)
        .execute(&pool)
        .await
        .expect("update in_stock");
}
