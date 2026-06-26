use axum::{routing::get, Json, Router};
use sqlx::query_scalar;
use tracing::warn;

use crate::dto::HealthOut;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/health", get(health))
}

async fn health(state: axum::extract::State<AppState>) -> Json<HealthOut> {
    let db_ok = match query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
    {
        Ok(_) => true,
        Err(e) => {
            warn!("health db: {e}");
            false
        }
    };

    let redis_ok = state.redis.ping().await;

    Json(HealthOut {
        ok: db_ok && redis_ok,
        database: db_ok,
        redis: redis_ok,
    })
}
