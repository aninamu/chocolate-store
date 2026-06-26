use chocolate_store_api::config::Settings;
use chocolate_store_api::db::create_pool;
use chocolate_store_api::seed::{slugify, SEED};
use sqlx::PgPool;

const SCHEMA: &str = include_str!("../schema.sql");

async fn run(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    for statement in SCHEMA.split(';').map(str::trim).filter(|s| !s.is_empty()) {
        sqlx::query(statement).execute(pool).await?;
    }

    for row in SEED {
        let slug = slugify(row.name);
        let tags: Vec<&str> = row.tags.to_vec();
        sqlx::query(
            r#"
            INSERT INTO chocolates (
                name, slug, description, origin, cacao_percentage,
                price_cents, image_url, churrito_quote, tags, in_stock
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
            "#,
        )
        .bind(row.name)
        .bind(&slug)
        .bind(row.description)
        .bind(row.origin)
        .bind(row.cacao_percentage)
        .bind(row.price_cents)
        .bind(row.image_url)
        .bind(row.churrito_quote)
        .bind(&tags)
        .execute(pool)
        .await?;
    }

    println!("init_db: created schema and inserted {} chocolates", SEED.len());
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let settings = Settings::from_env()?;
    let pool = create_pool(&settings).await?;
    run(&pool).await?;
    pool.close().await;
    Ok(())
}
