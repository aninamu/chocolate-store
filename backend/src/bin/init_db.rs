use chocolate_store_api::config::Settings;
use chocolate_store_api::db;
use chocolate_store_api::init_db_lib;

#[tokio::main]
async fn main() {
    let settings = Settings::from_env();
    let pool = db::create_pool(&settings).await;
    init_db_lib::run_and_report(&pool)
        .await
        .expect("init_db failed");
}
