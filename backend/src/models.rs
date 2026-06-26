use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct ChocolateOut {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub origin: Option<String>,
    pub cacao_percentage: Option<i32>,
    pub price_cents: i32,
    pub image_url: String,
    pub churrito_quote: Option<String>,
    pub tags: Vec<String>,
    pub in_stock: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct CartLineIn {
    pub chocolate_id: Uuid,
    #[validate(range(min = 1, max = 99))]
    pub quantity: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate, ToSchema)]
pub struct CheckoutIn {
    #[validate(length(min = 1, max = 200))]
    pub customer_name: String,
    #[validate(email)]
    pub customer_email: String,
    #[validate(length(min = 1))]
    pub items: Vec<CartLineIn>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CheckoutOut {
    pub order_id: Uuid,
    pub total_cents: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct HealthOut {
    pub ok: bool,
    pub database: bool,
    pub redis: bool,
}

#[derive(Debug, Clone)]
pub struct SeedRow {
    pub name: &'static str,
    pub description: &'static str,
    pub origin: Option<&'static str>,
    pub cacao_percentage: Option<i32>,
    pub price_cents: i32,
    pub image_url: &'static str,
    pub churrito_quote: Option<&'static str>,
    pub tags: &'static [&'static str],
}
