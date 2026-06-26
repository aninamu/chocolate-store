use redis::aio::MultiplexedConnection;
use redis::{AsyncCommands, Client};
use tracing::warn;

#[derive(Clone)]
pub struct RedisClient {
    client: Client,
}

impl RedisClient {
    pub fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        Ok(Self {
            client: Client::open(redis_url)?,
        })
    }

    async fn connection(&self) -> Result<MultiplexedConnection, redis::RedisError> {
        self.client.get_multiplexed_async_connection().await
    }

    pub async fn get(&self, key: &str) -> Option<String> {
        let mut conn = match self.connection().await {
            Ok(c) => c,
            Err(e) => {
                warn!("redis get {key}: {e}");
                return None;
            }
        };
        match conn.get(key).await {
            Ok(v) => v,
            Err(e) => {
                warn!("redis get {key}: {e}");
                None
            }
        }
    }

    pub async fn setex(&self, key: &str, value: &str, ttl: u64) {
        let mut conn = match self.connection().await {
            Ok(c) => c,
            Err(e) => {
                warn!("redis set {key}: {e}");
                return;
            }
        };
        if let Err(e) = conn.set_ex::<_, _, ()>(key, value, ttl).await {
            warn!("redis set {key}: {e}");
        }
    }

    pub async fn ping(&self) -> bool {
        let mut conn = match self.connection().await {
            Ok(c) => c,
            Err(e) => {
                warn!("redis ping: {e}");
                return false;
            }
        };
        redis::cmd("PING")
            .query_async::<String>(&mut conn)
            .await
            .is_ok()
    }
}
