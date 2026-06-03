use axum::extract::State;
use axum::Json;
use serde::Serialize;
use crate::cache::redis_ping;
use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub ok: bool,
    pub database: bool,
    pub redis: bool,
}

pub async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let mut db_ok = false;
    if sqlx::query("SELECT 1")
        .execute(&state.pool)
        .await
        .is_ok()
    {
        db_ok = true;
    }

    let mut redis_ok = false;
    let mut conn = state.redis.clone();
    if redis_ping(&mut conn).await {
        redis_ok = true;
    }

    Json(HealthResponse {
        ok: db_ok && redis_ok,
        database: db_ok,
        redis: redis_ok,
    })
}
