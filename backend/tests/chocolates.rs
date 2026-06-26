mod common;

use axum::http::StatusCode;
use common::{get_json, skip_if_services_down, test_app};
use uuid::Uuid;

#[tokio::test]
async fn list_chocolates_returns_items() {
    skip_if_services_down();
    let app = test_app().await;

    let (status, items) = get_json(&app, "/api/chocolates").await;
    assert_eq!(status, StatusCode::OK);
    let items = items.as_array().expect("array");
    assert!(!items.is_empty());
    let first = &items[0];
    assert!(first.get("id").is_some());
    assert!(first.get("name").is_some());
    assert!(first.get("price_cents").is_some());
    assert!(first.get("churrito_quote").is_some());
    assert!(!first["churrito_quote"].as_str().unwrap_or("").is_empty());
}

#[tokio::test]
async fn list_chocolates_tag_filter_or_semantics() {
    skip_if_services_down();
    let app = test_app().await;

    let (status, items) = get_json(&app, "/api/chocolates?tag=dark&tag=milk").await;
    assert_eq!(status, StatusCode::OK);
    for row in items.as_array().unwrap() {
        let tags: Vec<String> = row["tags"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|t| t.as_str().map(str::to_lowercase))
            .collect();
        assert!(tags.contains(&"dark".to_string()) || tags.contains(&"milk".to_string()));
    }
}

#[tokio::test]
async fn list_chocolates_sort_price_asc() {
    skip_if_services_down();
    let app = test_app().await;

    let (status, items) = get_json(&app, "/api/chocolates?sort=price_asc").await;
    assert_eq!(status, StatusCode::OK);
    let prices: Vec<i64> = items
        .as_array()
        .unwrap()
        .iter()
        .map(|row| row["price_cents"].as_i64().unwrap())
        .collect();
    let mut sorted = prices.clone();
    sorted.sort();
    assert_eq!(prices, sorted);
}

#[tokio::test]
async fn get_chocolate_detail_and_404() {
    skip_if_services_down();
    let app = test_app().await;

    let (listed_status, listed) = get_json(&app, "/api/chocolates").await;
    assert_eq!(listed_status, StatusCode::OK);
    let cid = listed.as_array().unwrap()[0]["id"]
        .as_str()
        .expect("id");

    let (status, body) = get_json(&app, &format!("/api/chocolates/{cid}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"], cid);
    assert!(body.get("churrito_quote").is_some());
    assert!(!body["churrito_quote"].as_str().unwrap_or("").is_empty());

    let missing_id = Uuid::new_v4();
    let (missing_status, err) =
        get_json(&app, &format!("/api/chocolates/{missing_id}")).await;
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert!(err.get("detail").is_some());
}
