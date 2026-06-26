use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use serde_json::{json, Value};
use validator::ValidationErrors;

#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub detail: Value,
}

pub struct AppError {
    pub status: StatusCode,
    pub detail: Value,
}

impl AppError {
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            detail: json!(message.into()),
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            detail: json!(message.into()),
        }
    }

    pub fn validation(errors: ValidationErrors) -> Self {
        let detail: Vec<Value> = errors
            .field_errors()
            .into_iter()
            .flat_map(|(field, field_errors)| {
                field_errors.iter().map(move |error| {
                    json!({
                        "type": error.code,
                        "loc": ["body", field],
                        "msg": error.message.as_ref().map(|m| m.to_string()).unwrap_or_else(|| error.code.to_string()),
                        "input": Value::Null,
                    })
                })
            })
            .collect();

        Self {
            status: StatusCode::UNPROCESSABLE_ENTITY,
            detail: json!(detail),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(ErrorBody { detail: self.detail })).into_response()
    }
}

pub fn validation_json(errors: ValidationErrors) -> (StatusCode, Json<ErrorBody>) {
    let err = AppError::validation(errors);
    (err.status, Json(ErrorBody { detail: err.detail }))
}
