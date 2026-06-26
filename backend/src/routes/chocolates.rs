use axum::extract::{Path, Query, State};
use axum::http::Uri;
use axum::Json;
use serde::Deserialize;
use tracing::debug;
use utoipa::IntoParams;
use uuid::Uuid;

use crate::cache;
use crate::error::AppError;
use crate::models::ChocolateOut;
use crate::AppState;

#[derive(Debug, Deserialize, IntoParams)]
pub struct ListChocolatesQuery {
    /// Repeat `tag=`; OR semantics: chocolate must include at least one listed tag.
    #[param(style = Form, explode = true)]
    #[serde(skip)]
    pub tag: Vec<String>,
    /// name | price_asc | price_desc | cacao_desc
    pub sort: Option<String>,
}

fn extract_tags(uri: &Uri) -> Vec<String> {
    uri.query()
        .into_iter()
        .flat_map(|query| url::form_urlencoded::parse(query.as_bytes()))
        .filter_map(|(key, value)| {
            if key == "tag" {
                Some(value.into_owned())
            } else {
                None
            }
        })
        .collect()
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
    format!("chocolates:list:{tkey}:{}", normalize_sort_key(sort))
}

fn detail_cache_key(id: Uuid) -> String {
    format!("chocolates:id:{id}")
}

async fn fetch_chocolates(
    pool: &sqlx::PgPool,
    tags: &[String],
    sort: Option<&str>,
) -> Result<Vec<ChocolateOut>, sqlx::Error> {
    let cleaned: Vec<String> = tags
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

    let sort_key = normalize_sort_key(sort);

    let rows = if cleaned.is_empty() {
        match sort_key {
            "price_asc" => {
                sqlx::query_as::<_, ChocolateOut>(
                    "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates ORDER BY price_cents ASC, name ASC",
                )
                .fetch_all(pool)
                .await?
            }
            "price_desc" => {
                sqlx::query_as::<_, ChocolateOut>(
                    "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates ORDER BY price_cents DESC, name ASC",
                )
                .fetch_all(pool)
                .await?
            }
            "cacao_desc" => {
                sqlx::query_as::<_, ChocolateOut>(
                    "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates ORDER BY cacao_percentage DESC NULLS LAST, name ASC",
                )
                .fetch_all(pool)
                .await?
            }
            _ => {
                sqlx::query_as::<_, ChocolateOut>(
                    "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates ORDER BY name ASC",
                )
                .fetch_all(pool)
                .await?
            }
        }
    } else {
        match sort_key {
            "price_asc" => {
                sqlx::query_as::<_, ChocolateOut>(
                    "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates WHERE tags && $1::text[] ORDER BY price_cents ASC, name ASC",
                )
                .bind(&cleaned)
                .fetch_all(pool)
                .await?
            }
            "price_desc" => {
                sqlx::query_as::<_, ChocolateOut>(
                    "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates WHERE tags && $1::text[] ORDER BY price_cents DESC, name ASC",
                )
                .bind(&cleaned)
                .fetch_all(pool)
                .await?
            }
            "cacao_desc" => {
                sqlx::query_as::<_, ChocolateOut>(
                    "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates WHERE tags && $1::text[] ORDER BY cacao_percentage DESC NULLS LAST, name ASC",
                )
                .bind(&cleaned)
                .fetch_all(pool)
                .await?
            }
            _ => {
                sqlx::query_as::<_, ChocolateOut>(
                    "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates WHERE tags && $1::text[] ORDER BY name ASC",
                )
                .bind(&cleaned)
                .fetch_all(pool)
                .await?
            }
        }
    };

    Ok(rows)
}

#[utoipa::path(
    get,
    path = "/api/chocolates",
    params(ListChocolatesQuery),
    responses((status = 200, description = "List chocolates", body = [ChocolateOut])),
    tag = "chocolates"
)]
pub async fn list_chocolates(
    State(state): State<AppState>,
    uri: Uri,
    Query(mut query): Query<ListChocolatesQuery>,
) -> Result<Json<Vec<ChocolateOut>>, AppError> {
    query.tag = extract_tags(&uri);
    let key = list_cache_key(&query.tag, query.sort.as_deref());
    if let Some(raw) = cache::cache_get(&key).await {
        if let Ok(data) = serde_json::from_str::<Vec<ChocolateOut>>(&raw) {
            return Ok(Json(data));
        }
        debug!("cache miss parse {key}");
    }

    let out = fetch_chocolates(&state.pool, &query.tag, query.sort.as_deref())
        .await
        .map_err(AppError::from_db_error)?;

    if let Ok(json) = serde_json::to_string(&out) {
        cache::cache_set(&key, &json, state.settings.cache_ttl_seconds).await;
    }

    Ok(Json(out))
}

#[utoipa::path(
    get,
    path = "/api/chocolates/{chocolate_id}",
    params(("chocolate_id" = Uuid, Path, description = "Chocolate id")),
    responses(
        (status = 200, description = "Chocolate detail", body = ChocolateOut),
        (status = 404, description = "Not found"),
    ),
    tag = "chocolates"
)]
pub async fn get_chocolate(
    State(state): State<AppState>,
    Path(chocolate_id): Path<Uuid>,
) -> Result<Json<ChocolateOut>, AppError> {
    let key = detail_cache_key(chocolate_id);
    if let Some(raw) = cache::cache_get(&key).await {
        if let Ok(data) = serde_json::from_str::<ChocolateOut>(&raw) {
            return Ok(Json(data));
        }
        debug!("detail cache miss {key}");
    }

    let row = sqlx::query_as::<_, ChocolateOut>(
        "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates WHERE id = $1",
    )
    .bind(chocolate_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::from_db_error)?;

    let Some(out) = row else {
        return Err(AppError::not_found("Chocolate not found"));
    };

    if let Ok(json) = serde_json::to_string(&out) {
        cache::cache_set(&key, &json, state.settings.cache_ttl_seconds).await;
    }

    Ok(Json(out))
}

#[allow(dead_code)]
pub fn tag_filter_description() -> &'static str {
    "Repeat `tag=`; OR semantics: chocolate must include at least one listed tag."
}

#[cfg(test)]
mod tests {
    use super::{list_cache_key, normalize_sort_key};

    #[test]
    fn cache_key_matches_python() {
        assert_eq!(
            list_cache_key(&["dark".into(), "milk".into()], Some("name")),
            "chocolates:list:dark,milk:name"
        );
    }

    #[test]
    fn invalid_sort_falls_back_to_name() {
        assert_eq!(normalize_sort_key(Some("bogus")), "name");
    }
}
