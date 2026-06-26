mod common;

use axum::http::StatusCode;
use common::{get_json, skip_if_services_down, test_app};

#[tokio::test]
async fn health_returns_shape() {
    skip_if_services_down();
    let app = test_app().await;

    let (status, data) = get_json(&app, "/api/health").await;
    assert_eq!(status, StatusCode::OK);
    assert!(data.get("ok").and_then(|v| v.as_bool()).is_some());
    assert!(data.get("database").and_then(|v| v.as_bool()).is_some());
    assert!(data.get("redis").and_then(|v| v.as_bool()).is_some());
    assert_eq!(data["ok"], true);
}
