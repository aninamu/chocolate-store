pub mod cache;
pub mod config;
pub mod db;
pub mod dto;
pub mod error;
pub mod models;
pub mod routes;
pub mod schema;
pub mod seed;

use std::sync::Arc;

use axum::routing::{get, post};
use axum::Router;
use redis::aio::ConnectionManager;
use sqlx::PgPool;
use tower_http::cors::{Any, CorsLayer};

use crate::config::Settings;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub redis: ConnectionManager,
    pub settings: Arc<Settings>,
}

pub fn build_app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
        ])
        .allow_credentials(true)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/health", get(routes::health::health))
        .route(
            "/api/chocolates",
            get(routes::chocolates::list_chocolates),
        )
        .route(
            "/api/chocolates/{chocolate_id}",
            get(routes::chocolates::get_chocolate),
        )
        .route("/api/checkout", post(routes::checkout::checkout))
        .layer(cors)
        .with_state(state)
}

pub async fn app_state_from_settings(settings: Settings) -> Result<AppState, Box<dyn std::error::Error + Send + Sync>> {
    let pool = db::create_pool(&settings).await?;
    let redis = cache::create_redis_manager(&settings).await?;
    Ok(AppState {
        pool,
        redis,
        settings: Arc::new(settings),
    })
}
