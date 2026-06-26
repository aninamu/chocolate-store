use axum::extract::State;
use axum::Json;
use tracing::warn;

use crate::cache;
use crate::models::HealthOut;
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/health",
    responses((status = 200, description = "Health status", body = HealthOut)),
    tag = "health"
)]
pub async fn health(State(state): State<AppState>) -> Json<HealthOut> {
    let mut db_ok = false;
    match sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
    {
        Ok(_) => db_ok = true,
        Err(e) => warn!("health db: {e}"),
    }

    let redis_ok = cache::ping_redis().await;

    Json(HealthOut {
        ok: db_ok && redis_ok,
        database: db_ok,
        redis: redis_ok,
    })
}
