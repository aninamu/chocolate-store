use std::net::SocketAddr;
use std::sync::Arc;

use chocolate_store_api::config::Settings;
use chocolate_store_api::db::create_pool;
use chocolate_store_api::cache::RedisClient;
use chocolate_store_api::{build_router, AppState};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let settings = Arc::new(Settings::from_env()?);
    let pool = create_pool(&settings).await?;
    let redis = RedisClient::new(&settings.redis_url)?;

    let state = AppState {
        pool,
        redis,
        settings: Arc::clone(&settings),
    };

    let app = build_router(state);
    let addr = SocketAddr::from(([127, 0, 0, 1], settings.backend_port));
    tracing::info!("listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
