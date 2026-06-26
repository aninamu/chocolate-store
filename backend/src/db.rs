use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

use crate::config::Settings;

pub async fn create_pool(settings: &Settings) -> PgPool {
    PgPoolOptions::new()
        .test_before_acquire(true)
        .connect(&settings.database_url)
        .await
        .expect("failed to connect to Postgres")
}
