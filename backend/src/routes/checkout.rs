use axum::extract::State;
use axum::Json;
use uuid::Uuid;
use validator::Validate;

use crate::error::AppError;
use crate::models::{CheckoutIn, CheckoutOut, ChocolateOut};
use crate::AppState;

#[utoipa::path(
    post,
    path = "/api/checkout",
    request_body = CheckoutIn,
    responses(
        (status = 200, description = "Order created", body = CheckoutOut),
        (status = 400, description = "Bad request"),
        (status = 422, description = "Validation error"),
    ),
    tag = "checkout"
)]
pub async fn checkout(
    State(state): State<AppState>,
    Json(body): Json<CheckoutIn>,
) -> Result<Json<CheckoutOut>, AppError> {
    if let Err(errors) = body.validate() {
        return Err(AppError::validation(errors));
    }

    for line in &body.items {
        if let Err(errors) = line.validate() {
            return Err(AppError::validation(errors));
        }
    }

    let name = body.customer_name.trim();
    if name.is_empty() {
        return Err(AppError::bad_request(
            "customer_name must not be empty or whitespace",
        ));
    }

    let email = body.customer_email.trim().to_lowercase();

    let mut tx = state.pool.begin().await.map_err(AppError::from_db_error)?;

    let order_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO orders (id, customer_name, customer_email, total_cents, status) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(order_id)
    .bind(name)
    .bind(&email)
    .bind(0_i32)
    .bind("paid")
    .execute(&mut *tx)
    .await
    .map_err(AppError::from_db_error)?;

    let mut total = 0_i64;

    for line in &body.items {
        let ch = sqlx::query_as::<_, ChocolateOut>(
            "SELECT id, name, slug, description, origin, cacao_percentage, price_cents, image_url, churrito_quote, tags, in_stock, created_at FROM chocolates WHERE id = $1",
        )
        .bind(line.chocolate_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::from_db_error)?;

        let Some(ch) = ch else {
            return Err(AppError::bad_request(format!(
                "Unknown chocolate {}",
                line.chocolate_id
            )));
        };

        if !ch.in_stock {
            return Err(AppError::bad_request(format!(
                "{} is out of stock",
                ch.name
            )));
        }

        let line_total = (ch.price_cents as i64)
            .checked_mul(line.quantity as i64)
            .ok_or_else(|| AppError::bad_request("line total overflow"))?;
        total = total
            .checked_add(line_total)
            .ok_or_else(|| AppError::bad_request("order total overflow"))?;

        sqlx::query(
            "INSERT INTO order_items (id, order_id, chocolate_id, quantity, unit_price_cents) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(Uuid::new_v4())
        .bind(order_id)
        .bind(ch.id)
        .bind(line.quantity)
        .bind(ch.price_cents)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from_db_error)?;
    }

    let total_cents: i32 = total
        .try_into()
        .map_err(|_| AppError::bad_request("order total overflow"))?;

    sqlx::query("UPDATE orders SET total_cents = $1 WHERE id = $2")
        .bind(total_cents)
        .bind(order_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from_db_error)?;

    tx.commit().await.map_err(AppError::from_db_error)?;

    Ok(Json(CheckoutOut {
        order_id,
        total_cents,
    }))
}
