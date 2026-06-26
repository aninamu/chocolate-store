use axum::{
    extract::{Path, Query, RawQuery, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use tracing::debug;
use uuid::Uuid;

use crate::dto::ChocolateOut;
use crate::error::AppError;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub sort: Option<String>,
}

fn parse_repeated_param(raw: Option<&str>, key: &str) -> Vec<String> {
    raw.map(|q| {
        url::form_urlencoded::parse(q.as_bytes())
            .filter_map(|(k, v)| (k == key).then(|| v.trim().to_string()))
            .filter(|s| !s.is_empty())
            .collect()
    })
    .unwrap_or_default()
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/chocolates", get(list_chocolates))
        .route("/api/chocolates/{chocolate_id}", get(get_chocolate))
}

fn normalize_sort_key(sort: Option<&str>) -> &'static str {
    match sort.unwrap_or("name") {
        "price_asc" => "price_asc",
        "price_desc" => "price_desc",
        "cacao_desc" => "cacao_desc",
        "name" => "name",
        _ => "name",
    }
}

fn list_cache_key(tags: &[String], sort: Option<&str>) -> String {
    let mut cleaned: Vec<String> = tags
        .iter()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .collect();
    cleaned.sort();
    let tkey = cleaned.join(",");
    format!("chocolates:list:{tkey}:{}", normalize_sort_key(sort))
}

fn detail_cache_key(id: Uuid) -> String {
    format!("chocolates:id:{id}")
}

async fn list_chocolates(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
    RawQuery(raw_query): RawQuery,
) -> Result<Json<Vec<ChocolateOut>>, AppError> {
    let tag = parse_repeated_param(raw_query.as_deref(), "tag");
    let key = list_cache_key(&tag, query.sort.as_deref());

    if let Some(raw) = state.redis.get(&key).await {
        match serde_json::from_str::<Vec<ChocolateOut>>(&raw) {
            Ok(items) => return Ok(Json(items)),
            Err(e) => debug!("cache miss parse {key}: {e}"),
        }
    }

    let cleaned: Vec<String> = tag;

    let sort = normalize_sort_key(query.sort.as_deref());

    let rows = if cleaned.is_empty() {
        fetch_chocolates_sorted(&state, sort, None).await?
    } else {
        fetch_chocolates_sorted(&state, sort, Some(&cleaned)).await?
    };

    if let Ok(json) = serde_json::to_string(&rows) {
        state
            .redis
            .setex(&key, &json, state.settings.cache_ttl_seconds)
            .await;
    }

    Ok(Json(rows))
}

async fn get_chocolate(
    State(state): State<AppState>,
    Path(chocolate_id): Path<Uuid>,
) -> Result<Json<ChocolateOut>, AppError> {
    let key = detail_cache_key(chocolate_id);

    if let Some(raw) = state.redis.get(&key).await {
        match serde_json::from_str::<ChocolateOut>(&raw) {
            Ok(item) => return Ok(Json(item)),
            Err(e) => debug!("detail cache miss {key}: {e}"),
        }
    }

    let row = sqlx::query_as::<_, ChocolateOut>(
        r#"
        SELECT id, name, slug, description, origin, cacao_percentage,
               price_cents, image_url, churrito_quote, tags, in_stock, created_at
        FROM chocolates
        WHERE id = $1
        "#,
    )
    .bind(chocolate_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Chocolate not found".to_string()))?;

    if let Ok(json) = serde_json::to_string(&row) {
        state
            .redis
            .setex(&key, &json, state.settings.cache_ttl_seconds)
            .await;
    }

    Ok(Json(row))
}

async fn fetch_chocolates_sorted(
    state: &AppState,
    sort: &str,
    tags: Option<&[String]>,
) -> Result<Vec<ChocolateOut>, AppError> {
    let base = r#"
        SELECT id, name, slug, description, origin, cacao_percentage,
               price_cents, image_url, churrito_quote, tags, in_stock, created_at
        FROM chocolates
    "#;

    let sql = match (tags, sort) {
        (Some(_), "price_asc") => format!(
            "{base} WHERE tags && $1::text[] ORDER BY price_cents ASC, name ASC"
        ),
        (Some(_), "price_desc") => format!(
            "{base} WHERE tags && $1::text[] ORDER BY price_cents DESC, name ASC"
        ),
        (Some(_), "cacao_desc") => format!(
            "{base} WHERE tags && $1::text[] ORDER BY cacao_percentage DESC NULLS LAST, name ASC"
        ),
        (Some(_), _) => format!("{base} WHERE tags && $1::text[] ORDER BY name ASC"),
        (None, "price_asc") => format!("{base} ORDER BY price_cents ASC, name ASC"),
        (None, "price_desc") => format!("{base} ORDER BY price_cents DESC, name ASC"),
        (None, "cacao_desc") => {
            format!("{base} ORDER BY cacao_percentage DESC NULLS LAST, name ASC")
        }
        (None, _) => format!("{base} ORDER BY name ASC"),
    };

    let rows = if let Some(tag_list) = tags {
        sqlx::query_as::<_, ChocolateOut>(&sql)
            .bind(tag_list)
            .fetch_all(&state.pool)
            .await?
    } else {
        sqlx::query_as::<_, ChocolateOut>(&sql)
            .fetch_all(&state.pool)
            .await?
    };

    Ok(rows)
}
