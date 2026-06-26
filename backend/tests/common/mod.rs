use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use chocolate_store_api::cache::RedisClient;
use chocolate_store_api::config::Settings;
use chocolate_store_api::db::create_pool;
use chocolate_store_api::{build_router, AppState};
use http_body_util::BodyExt;
use tower::ServiceExt;

pub fn services_ports_open() -> bool {
    for (host, port) in [("127.0.0.1", 55432), ("127.0.0.1", 63790)] {
        if TcpStream::connect_timeout(
            &format!("{host}:{port}").parse().expect("socket addr"),
            Duration::from_millis(1500),
        )
        .is_err()
        {
            return false;
        }
    }
    true
}

pub fn skip_if_services_down() -> bool {
    if services_ports_open() {
        return true;
    }

    eprintln!(
        "Postgres (55432) / Redis (63790) not reachable; \
         run `make services-up` (or `make dev`) first."
    );

    if std::env::var_os("CI").is_some() {
        panic!(
            "integration tests require Postgres (55432) and Redis (63790); \
             services are not reachable"
        );
    }

    false
}

pub async fn test_app() -> Router {
    let settings = Arc::new(Settings::from_env().expect("settings"));
    let pool = create_pool(&settings).await.expect("pool");
    let redis = RedisClient::new(&settings.redis_url).expect("redis");
    build_router(AppState {
        pool,
        redis,
        settings,
    })
}

pub async fn get_json(app: &Router, uri: &str) -> (StatusCode, serde_json::Value) {
    let response = app
        .clone()
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .expect("request");

    let status = response.status();
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap_or(serde_json::Value::Null);
    (status, json)
}

pub async fn post_json(
    app: &Router,
    uri: &str,
    payload: serde_json::Value,
) -> (StatusCode, serde_json::Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .expect("request");

    let status = response.status();
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap_or(serde_json::Value::Null);
    (status, json)
}
