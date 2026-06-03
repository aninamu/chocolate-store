use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use tracing::warn;

use crate::config::Settings;

pub async fn create_redis_manager(settings: &Settings) -> Result<ConnectionManager, redis::RedisError> {
    let client = redis::Client::open(settings.redis_url.as_str())?;
    ConnectionManager::new(client).await
}

pub async fn cache_get(conn: &mut ConnectionManager, key: &str) -> Option<String> {
    match conn.get::<_, Option<String>>(key).await {
        Ok(v) => v,
        Err(e) => {
            warn!("redis get {}: {}", key, e);
            None
        }
    }
}

pub async fn cache_set(
    conn: &mut ConnectionManager,
    key: &str,
    value: &str,
    ttl: u64,
) {
    if let Err(e) = conn.set_ex::<_, _, ()>(key, value, ttl).await {
        warn!("redis set {}: {}", key, e);
    }
}

pub async fn redis_ping(conn: &mut ConnectionManager) -> bool {
    redis::cmd("PING")
        .query_async::<String>(conn)
        .await
        .is_ok()
}
