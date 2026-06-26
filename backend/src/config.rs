use std::env;
use std::path::PathBuf;

use thiserror::Error;

#[derive(Debug, Clone)]
pub struct Settings {
    pub database_url: String,
    pub redis_url: String,
    pub cache_ttl_seconds: u64,
    pub backend_port: u16,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("missing required environment variable: {0}")]
    Missing(&'static str),
    #[error("invalid {0}: {1}")]
    Invalid(&'static str, String),
}

fn load_dotenv() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));

    let _ = dotenvy::from_path(root.join(".env"));
    let _ = dotenvy::from_path(root.join(".env.local"));
}

fn normalize_database_url(raw: &str) -> String {
    raw.replace("postgresql+asyncpg://", "postgres://")
        .replace("postgresql://", "postgres://")
}

fn parse_u64(name: &'static str, raw: &str) -> Result<u64, ConfigError> {
    raw.parse()
        .map_err(|_| ConfigError::Invalid(name, raw.to_string()))
}

fn parse_u16(name: &'static str, raw: &str) -> Result<u16, ConfigError> {
    raw.parse()
        .map_err(|_| ConfigError::Invalid(name, raw.to_string()))
}

impl Settings {
    pub fn from_env() -> Result<Self, ConfigError> {
        load_dotenv();

        let database_url = env::var("DATABASE_URL")
            .map_err(|_| ConfigError::Missing("DATABASE_URL"))?;
        let redis_url =
            env::var("REDIS_URL").map_err(|_| ConfigError::Missing("REDIS_URL"))?;

        let cache_ttl_seconds = env::var("CACHE_TTL_SECONDS")
            .unwrap_or_else(|_| "60".to_string())
            .pipe(|v| parse_u64("CACHE_TTL_SECONDS", &v))?;

        let backend_port = env::var("BACKEND_PORT")
            .unwrap_or_else(|_| "8000".to_string())
            .pipe(|v| parse_u16("BACKEND_PORT", &v))?;

        Ok(Self {
            database_url: normalize_database_url(&database_url),
            redis_url,
            cache_ttl_seconds,
            backend_port,
        })
    }
}

trait Pipe: Sized {
    fn pipe<F, R>(self, f: F) -> R
    where
        F: FnOnce(Self) -> R,
    {
        f(self)
    }
}

impl<T> Pipe for T {}
