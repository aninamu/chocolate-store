use std::net::SocketAddr;

use chocolate_store_api::config::Settings;
use chocolate_store_api::db;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .init();

    let settings = Settings::from_env();
    let pool = db::create_pool(&settings).await;
    let app = chocolate_store_api::build_app(settings.clone(), pool).await;

    let addr = SocketAddr::from(([127, 0, 0, 1], settings.backend_port));
    tracing::info!("listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind");
    axum::serve(listener, app)
        .await
        .expect("server error");
}
