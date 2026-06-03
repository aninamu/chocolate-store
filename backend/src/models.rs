use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct ChocolateRow {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub origin: Option<String>,
    pub cacao_percentage: Option<i32>,
    pub price_cents: i32,
    pub image_url: String,
    pub tags: Vec<String>,
    pub in_stock: bool,
    pub created_at: DateTime<Utc>,
}
