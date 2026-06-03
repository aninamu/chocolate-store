use axum::extract::State;
use axum::Json;
use sqlx::Row;
use uuid::Uuid;

use crate::dto::{CheckoutIn, CheckoutOut};
use crate::error::AppError;
use crate::AppState;

fn is_valid_email(email: &str) -> bool {
    let email = email.trim();
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty() && !domain.is_empty() && domain.contains('.')
}

fn validate_checkout(body: &CheckoutIn) -> Result<(), AppError> {
    let name = body.customer_name.trim();
    if name.is_empty() {
        return Err(AppError::bad_request(
            "customer_name must not be empty or whitespace",
        ));
    }
    if name.len() > 200 {
        return Err(AppError::unprocessable(
            "customer_name must be at most 200 characters",
        ));
    }
    if body.customer_name.is_empty() {
        return Err(AppError::unprocessable("customer_name must have at least 1 character"));
    }
    if !is_valid_email(&body.customer_email) {
        return Err(AppError::unprocessable("Invalid email address"));
    }
    if body.items.is_empty() {
        return Err(AppError::unprocessable("items must contain at least one line"));
    }
    for line in &body.items {
        if line.quantity < 1 || line.quantity > 99 {
            return Err(AppError::unprocessable(
                "quantity must be between 1 and 99",
            ));
        }
    }
    Ok(())
}

pub async fn checkout(
    State(state): State<AppState>,
    Json(body): Json<CheckoutIn>,
) -> Result<Json<CheckoutOut>, AppError> {
    validate_checkout(&body)?;
    let name = body.customer_name.trim().to_string();
    let email = body.customer_email.trim().to_lowercase();

    let mut tx = state.pool.begin().await?;

    let order_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO orders (id, customer_name, customer_email, total_cents, status)
        VALUES ($1, $2, $3, 0, 'paid')
        "#,
    )
    .bind(order_id)
    .bind(&name)
    .bind(&email)
    .execute(&mut *tx)
    .await?;

    let mut total: i32 = 0;
    for line in &body.items {
        let row = sqlx::query(
            r#"
            SELECT id, name, price_cents, in_stock
            FROM chocolates WHERE id = $1
            "#,
        )
        .bind(line.chocolate_id)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(row) = row else {
            return Err(AppError::bad_request(format!(
                "Unknown chocolate {}",
                line.chocolate_id
            )));
        };

        let ch_id: Uuid = row.get("id");
        let ch_name: String = row.get("name");
        let price_cents: i32 = row.get("price_cents");
        let in_stock: bool = row.get("in_stock");

        if !in_stock {
            return Err(AppError::bad_request(format!(
                "{ch_name} is out of stock"
            )));
        }

        let line_total = price_cents * line.quantity;
        total += line_total;

        let item_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO order_items (id, order_id, chocolate_id, quantity, unit_price_cents)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(item_id)
        .bind(order_id)
        .bind(ch_id)
        .bind(line.quantity)
        .bind(price_cents)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query("UPDATE orders SET total_cents = $1 WHERE id = $2")
        .bind(total)
        .bind(order_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(CheckoutOut {
        order_id,
        total_cents: total,
    }))
}
