use utoipa::OpenApi;

use crate::models::{CartLineIn, CheckoutIn, CheckoutOut, ChocolateOut, HealthOut};
use crate::routes::chocolates::tag_filter_description;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "chocolate store API",
        version = "0.1.0",
    ),
    paths(
        crate::routes::health::health,
        crate::routes::chocolates::list_chocolates,
        crate::routes::chocolates::get_chocolate,
        crate::routes::checkout::checkout,
    ),
    components(schemas(ChocolateOut, CartLineIn, CheckoutIn, CheckoutOut, HealthOut)),
    tags(
        (name = "chocolates", description = "Chocolate catalog"),
        (name = "checkout", description = "Mock checkout"),
        (name = "health", description = "Health checks"),
    )
)]
pub struct ApiDoc;

/// OpenAPI JSON for `/openapi.json`.
pub fn openapi_json() -> String {
    let mut doc: serde_json::Value =
        serde_json::from_str(&ApiDoc::openapi().to_pretty_json().unwrap_or_default())
            .unwrap_or(serde_json::json!({}));

    if let Some(params) = doc
        .pointer_mut("/paths/~1api~1chocolates/get/parameters")
        .and_then(|v| v.as_array_mut())
    {
        params.push(serde_json::json!({
            "name": "tag",
            "in": "query",
            "required": false,
            "description": tag_filter_description(),
            "schema": {
                "type": "array",
                "items": { "type": "string" }
            }
        }));
    }

    serde_json::to_string_pretty(&doc).unwrap_or_default()
}

pub fn openapi_title() -> String {
    ApiDoc::openapi().info.title.clone()
}
