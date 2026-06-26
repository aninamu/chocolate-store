mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use common::{response_json, services_ports_open, test_app};

#[tokio::test]
async fn test_health_returns_shape() {
    if !services_ports_open() {
        eprintln!("skip: Postgres (55432) / Redis (63790) not reachable");
        return;
    }

    let app = test_app().await;
    let (status, data) = response_json(
        &app,
        Request::builder()
            .uri("/api/health")
            .body(Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(data.get("ok").is_some());
    assert!(data.get("database").is_some());
    assert!(data.get("redis").is_some());
    assert!(data["ok"].is_boolean());
    assert!(data["database"].is_boolean());
    assert!(data["redis"].is_boolean());
    assert_eq!(data["ok"], true);
}
