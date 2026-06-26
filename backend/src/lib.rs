pub mod cache;
pub mod config;
pub mod db;
pub mod error;
pub mod init_db_lib;
pub mod models;
pub mod openapi;
pub mod routes;
pub mod seed;

use axum::routing::{get, post};
use axum::{Json, Router};
use sqlx::PgPool;
use tower_http::cors::{AllowHeaders, AllowMethods, CorsLayer};

use crate::cache::init_redis;
use crate::config::Settings;
use crate::openapi::openapi_json;
use crate::routes::checkout::checkout;
use crate::routes::chocolates::{get_chocolate, list_chocolates};
use crate::routes::health::health;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub settings: Settings,
}

async fn openapi_handler() -> Json<serde_json::Value> {
    let json: serde_json::Value =
        serde_json::from_str(&openapi_json()).unwrap_or(serde_json::json!({}));
    Json(json)
}

pub async fn build_app(settings: Settings, pool: PgPool) -> Router {
    init_redis(&settings).await;

    let state = AppState {
        pool,
        settings,
    };

    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
        ])
        .allow_credentials(true)
        .allow_methods(AllowMethods::mirror_request())
        .allow_headers(AllowHeaders::mirror_request());

    Router::new()
        .route("/api/health", get(health))
        .route("/api/chocolates", get(list_chocolates))
        .route("/api/chocolates/:chocolate_id", get(get_chocolate))
        .route("/api/checkout", post(checkout))
        .route("/openapi.json", get(openapi_handler))
        .with_state(state)
        .layer(cors)
}

pub async fn build_app_from_env() -> Router {
    let settings = Settings::from_env();
    let pool = db::create_pool(&settings).await;
    build_app(settings, pool).await
}
