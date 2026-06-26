pub mod cache;
pub mod config;
pub mod db;
pub mod dto;
pub mod error;
pub mod routes;
pub mod seed;

use std::sync::Arc;

use axum::Router;
use sqlx::PgPool;
use tower_http::cors::{Any, CorsLayer};

use crate::cache::RedisClient;
use crate::config::Settings;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub redis: RedisClient,
    pub settings: Arc<Settings>,
}

pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
        ])
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .merge(routes::router())
        .layer(cors)
        .with_state(state)
}
