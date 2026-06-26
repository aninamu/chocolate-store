use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Settings {
    pub database_url: String,
    pub redis_url: String,
    pub cache_ttl_seconds: u64,
    pub backend_port: u16,
}

impl Settings {
    pub fn from_env() -> Self {
        load_dotenv_files();

        let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
        let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL must be set");
        let cache_ttl_seconds = std::env::var("CACHE_TTL_SECONDS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);
        let backend_port = std::env::var("BACKEND_PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(8000);

        Self {
            database_url: normalize_database_url(&database_url),
            redis_url,
            cache_ttl_seconds,
            backend_port,
        }
    }
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("backend has a parent directory")
        .to_path_buf()
}

fn load_dotenv_files() {
    let root = repo_root();
    let _ = dotenvy::from_path(root.join(".env"));
    let _ = dotenvy::from_path(root.join(".env.local"));
}

/// Strip SQLAlchemy dialect suffixes (e.g. postgresql+asyncpg:// → postgresql://).
pub fn normalize_database_url(url: &str) -> String {
    if let Some(scheme_end) = url.find("://") {
        let scheme = &url[..scheme_end];
        if let Some(plus) = scheme.find('+') {
            return format!("{}{}", &scheme[..plus], &url[scheme_end..]);
        }
    }
    url.to_string()
}

#[cfg(test)]
mod tests {
    use super::normalize_database_url;

    #[test]
    fn strips_asyncpg_dialect() {
        assert_eq!(
            normalize_database_url("postgresql+asyncpg://user@localhost/db"),
            "postgresql://user@localhost/db"
        );
    }
}
