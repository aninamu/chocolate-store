use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

use crate::config::Settings;

pub async fn create_pool(settings: &Settings) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        .connect(&settings.database_url)
        .await
}
