use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::{routing::post, Json, Router};
use sqlx::query_as;
use uuid::Uuid;

use crate::dto::{validate_checkout, CheckoutIn, CheckoutOut, ChocolateOut};
use crate::error::AppError;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/checkout", post(checkout))
}

async fn checkout(
    State(state): State<AppState>,
    Json(body): Json<CheckoutIn>,
) -> Result<Response, AppError> {
    if let Err(resp) = validate_checkout(&body) {
        return Ok(resp);
    }

    let name = body.customer_name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest(
            "customer_name must not be empty or whitespace".to_string(),
        ));
    }

    let email = body.customer_email.to_lowercase();

    let mut tx = state.pool.begin().await?;

    let order_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO orders (customer_name, customer_email, total_cents, status)
        VALUES ($1, $2, 0, 'paid')
        RETURNING id
        "#,
    )
    .bind(name)
    .bind(&email)
    .fetch_one(&mut *tx)
    .await?;

    let mut total = 0i32;

    for line in &body.items {
        let ch = query_as::<_, ChocolateOut>(
            r#"
            SELECT id, name, slug, description, origin, cacao_percentage,
                   price_cents, image_url, churrito_quote, tags, in_stock, created_at
            FROM chocolates
            WHERE id = $1
            "#,
        )
        .bind(line.chocolate_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| {
            AppError::BadRequest(format!("Unknown chocolate {}", line.chocolate_id))
        })?;

        if !ch.in_stock {
            return Err(AppError::BadRequest(format!("{} is out of stock", ch.name)));
        }

        let line_total = ch.price_cents * line.quantity;
        total += line_total;

        sqlx::query(
            r#"
            INSERT INTO order_items (order_id, chocolate_id, quantity, unit_price_cents)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(order_id)
        .bind(ch.id)
        .bind(line.quantity)
        .bind(ch.price_cents)
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
    })
    .into_response())
}
