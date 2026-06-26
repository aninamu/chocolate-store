use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use tracing::error;
use validator::ValidationErrors;

#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub detail: serde_json::Value,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    NotFound(String),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

impl AppError {
    pub fn status(&self) -> StatusCode {
        match self {
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub fn detail(&self) -> String {
        match self {
            AppError::BadRequest(msg) | AppError::NotFound(msg) => msg.clone(),
            AppError::Database(_) => "Internal server error".to_string(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        if let AppError::Database(ref e) = self {
            error!("database error: {e}");
        }
        let status = self.status();
        let body = ErrorBody {
            detail: serde_json::Value::String(self.detail()),
        };
        (status, Json(body)).into_response()
    }
}

pub fn validation_error_response(errors: ValidationErrors) -> Response {
    let detail: Vec<serde_json::Value> = errors
        .field_errors()
        .into_iter()
        .flat_map(|(field, field_errors)| {
            field_errors.iter().map(move |e| {
                let msg = e
                    .message
                    .as_ref()
                    .map(|m| m.to_string())
                    .unwrap_or_else(|| format!("Invalid value for {field}"));
                serde_json::json!({ "loc": [field], "msg": msg, "type": "value_error" })
            })
        })
        .collect();

    (
        StatusCode::UNPROCESSABLE_ENTITY,
        Json(ErrorBody {
            detail: serde_json::Value::Array(detail),
        }),
    )
        .into_response()
}
