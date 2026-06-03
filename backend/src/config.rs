use std::path::PathBuf;

use thiserror::Error;

#[derive(Debug, Clone)]
pub struct Settings {
    pub database_url: String,
    pub redis_url: String,
    pub cache_ttl_seconds: u64,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("DATABASE_URL is required")]
    MissingDatabaseUrl,
    #[error("REDIS_URL is required")]
    MissingRedisUrl,
}

fn normalize_database_url(raw: &str) -> String {
    raw.replace("postgresql+asyncpg://", "postgresql://")
}

pub fn load_env_files() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest.parent().unwrap_or(&manifest);
    let _ = dotenvy::from_path(root.join(".env"));
    let _ = dotenvy::from_path(root.join(".env.local"));
}

pub fn settings_from_env() -> Result<Settings, ConfigError> {
    load_env_files();
    let database_url = std::env::var("DATABASE_URL")
        .map(|u| normalize_database_url(&u))
        .map_err(|_| ConfigError::MissingDatabaseUrl)?;
    let redis_url =
        std::env::var("REDIS_URL").map_err(|_| ConfigError::MissingRedisUrl)?;
    let cache_ttl_seconds = std::env::var("CACHE_TTL_SECONDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(60);
    Ok(Settings {
        database_url,
        redis_url,
        cache_ttl_seconds,
    })
}
