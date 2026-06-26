mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use common::{response_json, services_ports_open, test_app};

#[tokio::test]
async fn test_list_chocolates_returns_items() {
    if !services_ports_open() {
        eprintln!("skip: Postgres (55432) / Redis (63790) not reachable");
        return;
    }

    let app = test_app().await;
    let (status, data) = response_json(
        &app,
        Request::builder()
            .uri("/api/chocolates")
            .body(Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let items = data.as_array().expect("array");
    assert!(!items.is_empty());
    let first = &items[0];
    assert!(first.get("id").is_some());
    assert!(first.get("name").is_some());
    assert!(first.get("price_cents").is_some());
    assert!(first.get("churrito_quote").is_some());
    assert!(!first["churrito_quote"].as_str().unwrap_or("").is_empty());
}

#[tokio::test]
async fn test_list_chocolates_tag_filter_or_semantics() {
    if !services_ports_open() {
        eprintln!("skip: Postgres (55432) / Redis (63790) not reachable");
        return;
    }

    let app = test_app().await;
    let (status, data) = response_json(
        &app,
        Request::builder()
            .uri("/api/chocolates?tag=dark&tag=milk")
            .body(Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let items = data.as_array().expect("array");
    for row in items {
        let tags: std::collections::HashSet<String> = row["tags"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t.as_str().unwrap().to_lowercase())
            .collect();
        assert!(tags.contains("dark") || tags.contains("milk"));
    }
}

#[tokio::test]
async fn test_list_chocolates_sort_price_asc() {
    if !services_ports_open() {
        eprintln!("skip: Postgres (55432) / Redis (63790) not reachable");
        return;
    }

    let app = test_app().await;
    let (status, data) = response_json(
        &app,
        Request::builder()
            .uri("/api/chocolates?sort=price_asc")
            .body(Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let items = data.as_array().expect("array");
    let prices: Vec<i64> = items
        .iter()
        .map(|row| row["price_cents"].as_i64().unwrap())
        .collect();
    let mut sorted = prices.clone();
    sorted.sort();
    assert_eq!(prices, sorted);
}

#[tokio::test]
async fn test_get_chocolate_detail_and_404() {
    if !services_ports_open() {
        eprintln!("skip: Postgres (55432) / Redis (63790) not reachable");
        return;
    }

    let app = test_app().await;
    let (list_status, listed) = response_json(
        &app,
        Request::builder()
            .uri("/api/chocolates")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    let cid = listed[0]["id"].as_str().unwrap();

    let (status, body) = response_json(
        &app,
        Request::builder()
            .uri(format!("/api/chocolates/{cid}"))
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"].as_str().unwrap(), cid);
    assert!(body.get("churrito_quote").is_some());
    assert!(!body["churrito_quote"].as_str().unwrap_or("").is_empty());

    let missing_id = uuid::Uuid::new_v4();
    let (missing_status, missing) = response_json(
        &app,
        Request::builder()
            .uri(format!("/api/chocolates/{missing_id}"))
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert!(missing.get("detail").is_some());
}
