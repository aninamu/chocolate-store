use chocolate_store::config::settings_from_env;
use chocolate_store::db::create_pool;
use chocolate_store::seed::run_init;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt::init();
    let settings = settings_from_env().map_err(|e| format!("config: {e}"))?;
    let pool = create_pool(&settings).await?;
    run_init(&pool).await?;
    println!(
        "init_db: created schema and inserted {} chocolates",
        chocolate_store::seed::SEED.len()
    );
    Ok(())
}
