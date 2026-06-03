use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::cache::{cache_get, cache_set};
use crate::dto::ChocolateOut;
use crate::error::AppError;
use crate::models::ChocolateRow;
use crate::AppState;

const CHOCOLATE_SELECT: &str = r#"
SELECT id, name, slug, description, origin, cacao_percentage, price_cents,
       image_url, tags, in_stock, created_at
FROM chocolates
"#;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub tag: Vec<String>,
    pub sort: Option<String>,
}

fn normalize_sort_key(sort: Option<&str>) -> &'static str {
    match sort.unwrap_or("name") {
        "price_asc" => "price_asc",
        "price_desc" => "price_desc",
        "cacao_desc" => "cacao_desc",
        _ => "name",
    }
}

fn list_cache_key(tags: &[String], sort: Option<&str>) -> String {
    let mut cleaned: Vec<String> = tags
        .iter()
        .filter_map(|t| {
            let s = t.trim();
            if s.is_empty() {
                None
            } else {
                Some(s.to_string())
            }
        })
        .collect();
    cleaned.sort();
    let tkey = cleaned.join(",");
    format!(
        "chocolates:list:{}:{}",
        tkey,
        normalize_sort_key(sort)
    )
}

fn detail_cache_key(id: Uuid) -> String {
    format!("chocolates:id:{id}")
}

fn order_clause(sort: &'static str) -> &'static str {
    match sort {
        "price_asc" => " ORDER BY price_cents ASC, name ASC",
        "price_desc" => " ORDER BY price_cents DESC, name ASC",
        "cacao_desc" => " ORDER BY cacao_percentage DESC NULLS LAST, name ASC",
        _ => " ORDER BY name ASC",
    }
}

pub async fn list_chocolates(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<ChocolateOut>>, AppError> {
    let sort_key = normalize_sort_key(q.sort.as_deref());
    let key = list_cache_key(&q.tag, q.sort.as_deref());
    let mut conn = state.redis.clone();
    if let Some(raw) = cache_get(&mut conn, &key).await {
        if let Ok(data) = serde_json::from_str::<Vec<ChocolateOut>>(&raw) {
            return Ok(Json(data));
        }
    }

    let cleaned: Vec<String> = q
        .tag
        .iter()
        .filter_map(|t| {
            let s = t.trim();
            if s.is_empty() {
                None
            } else {
                Some(s.to_string())
            }
        })
        .collect();

    let order = order_clause(sort_key);
    let rows: Vec<ChocolateRow> = if cleaned.is_empty() {
        let sql = format!("{CHOCOLATE_SELECT}{order}");
        sqlx::query_as(&sql).fetch_all(&state.pool).await?
    } else {
        let sql = format!("{CHOCOLATE_SELECT} WHERE tags && $1::varchar[]{order}");
        sqlx::query_as(&sql)
            .bind(&cleaned)
            .fetch_all(&state.pool)
            .await?
    };

    let out: Vec<ChocolateOut> = rows.into_iter().map(ChocolateOut::from).collect();
    if let Ok(json) = serde_json::to_string(&out) {
        cache_set(
            &mut conn,
            &key,
            &json,
            state.settings.cache_ttl_seconds,
        )
        .await;
    }
    Ok(Json(out))
}

pub async fn get_chocolate(
    State(state): State<AppState>,
    Path(chocolate_id): Path<Uuid>,
) -> Result<Json<ChocolateOut>, AppError> {
    let key = detail_cache_key(chocolate_id);
    let mut conn = state.redis.clone();
    if let Some(raw) = cache_get(&mut conn, &key).await {
        if let Ok(data) = serde_json::from_str::<ChocolateOut>(&raw) {
            return Ok(Json(data));
        }
    }

    let sql = format!("{CHOCOLATE_SELECT} WHERE id = $1");
    let row: Option<ChocolateRow> = sqlx::query_as(&sql)
        .bind(chocolate_id)
        .fetch_optional(&state.pool)
        .await?;

    let row = row.ok_or_else(|| AppError::not_found("Chocolate not found"))?;
    let out = ChocolateOut::from(row);
    if let Ok(json) = serde_json::to_string(&out) {
        cache_set(
            &mut conn,
            &key,
            &json,
            state.settings.cache_ttl_seconds,
        )
        .await;
    }
    Ok(Json(out))
}
