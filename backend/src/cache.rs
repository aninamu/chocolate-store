use std::sync::Arc;

use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use tokio::sync::OnceCell;
use tracing::warn;

use crate::config::Settings;

static REDIS: OnceCell<Option<ConnectionManager>> = OnceCell::const_new();

pub async fn init_redis(settings: &Settings) {
    REDIS
        .get_or_init(|| async {
            let url = settings.redis_url.clone();
            match redis::Client::open(url) {
                Ok(client) => match ConnectionManager::new(client).await {
                    Ok(conn) => Some(conn),
                    Err(e) => {
                        warn!("failed to connect to Redis: {e}");
                        None
                    }
                },
                Err(e) => {
                    warn!("invalid REDIS_URL: {e}");
                    None
                }
            }
        })
        .await;
}

fn redis_conn() -> Option<ConnectionManager> {
    REDIS.get().and_then(|conn| conn.clone())
}

pub async fn cache_get(key: &str) -> Option<String> {
    let conn = redis_conn()?;
    let mut conn = conn.clone();
    match conn.get::<_, Option<String>>(key).await {
        Ok(value) => value,
        Err(e) => {
            warn!("redis get {key}: {e}");
            None
        }
    }
}

pub async fn cache_set(key: &str, value: &str, ttl: u64) {
    let Some(conn) = redis_conn() else {
        return;
    };
    let mut conn = conn.clone();
    if let Err(e) = conn.set_ex::<_, _, ()>(key, value, ttl).await {
        warn!("redis set {key}: {e}");
    }
}

pub async fn ping_redis() -> bool {
    let Some(conn) = redis_conn() else {
        return false;
    };
    let mut conn = conn.clone();
    match redis::cmd("PING").query_async::<()>(&mut conn).await {
        Ok(()) => true,
        Err(_) => false,
    }
}

pub fn redis_initialized() -> bool {
    redis_conn().is_some()
}

pub struct RedisGuard;

impl RedisGuard {
    pub async fn ensure(settings: &Settings) -> Arc<Self> {
        init_redis(settings).await;
        Arc::new(Self)
    }
}
