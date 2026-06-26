use chocolate_store_api::openapi::{openapi_json, openapi_title};

#[test]
fn test_openapi_on_app() {
    let title = openapi_title();
    assert!(title.to_lowercase().contains("chocolate"));
}

#[test]
fn test_list_chocolates_exposes_repeated_tag_query_param() {
    let doc: serde_json::Value = serde_json::from_str(&openapi_json()).expect("valid openapi json");
    let params = doc["paths"]["/api/chocolates"]["get"]["parameters"]
        .as_array()
        .expect("parameters array");
    let tag = params
        .iter()
        .find(|p| p["name"] == "tag")
        .expect("tag parameter");
    assert_eq!(tag["schema"]["type"], "array");
    let desc = tag["description"].as_str().unwrap_or("").to_lowercase();
    assert!(desc.contains("at least one"));
    assert!(desc.contains("or semantics"));
}
