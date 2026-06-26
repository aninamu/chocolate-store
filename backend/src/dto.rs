use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::error::validation_error_response;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
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

#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct CartLineIn {
    pub chocolate_id: Uuid,
    #[validate(range(min = 1, max = 99))]
    pub quantity: i32,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CheckoutIn {
    #[validate(length(min = 1, max = 200))]
    pub customer_name: String,
    #[validate(email)]
    pub customer_email: String,
    #[validate(length(min = 1))]
    #[validate(nested)]
    pub items: Vec<CartLineIn>,
}

#[derive(Debug, Serialize)]
pub struct CheckoutOut {
    pub order_id: Uuid,
    pub total_cents: i32,
}

#[derive(Debug, Serialize)]
pub struct HealthOut {
    pub ok: bool,
    pub database: bool,
    pub redis: bool,
}

pub fn validate_checkout(body: &CheckoutIn) -> Result<(), axum::response::Response> {
    body.validate()
        .map_err(validation_error_response)
}
