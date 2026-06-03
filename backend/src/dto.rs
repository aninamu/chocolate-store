use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::ChocolateRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChocolateOut {
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

impl From<ChocolateRow> for ChocolateOut {
    fn from(r: ChocolateRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            slug: r.slug,
            description: r.description,
            origin: r.origin,
            cacao_percentage: r.cacao_percentage,
            price_cents: r.price_cents,
            image_url: r.image_url,
            tags: r.tags,
            in_stock: r.in_stock,
            created_at: r.created_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CartLineIn {
    pub chocolate_id: Uuid,
    pub quantity: i32,
}

#[derive(Debug, Deserialize)]
pub struct CheckoutIn {
    pub customer_name: String,
    pub customer_email: String,
    pub items: Vec<CartLineIn>,
}

#[derive(Debug, Serialize)]
pub struct CheckoutOut {
    pub order_id: Uuid,
    pub total_cents: i32,
}
