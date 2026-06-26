use axum::Router;

use crate::AppState;

mod checkout;
mod chocolates;
mod health;

pub fn router() -> Router<AppState> {
    Router::new()
        .merge(health::router())
        .merge(chocolates::router())
        .merge(checkout::router())
}
