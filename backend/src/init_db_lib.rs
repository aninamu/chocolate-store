use sqlx::PgPool;
use uuid::Uuid;

use crate::seed::{slugify, SEED};

const SCHEMA_SQL: &str = include_str!("schema.sql");

pub async fn run(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::raw_sql(SCHEMA_SQL).execute(pool).await?;

    for row in SEED {
        let tags: Vec<String> = row.tags.iter().map(|t| (*t).to_string()).collect();
        sqlx::query(
            r#"
            INSERT INTO chocolates (
                id, name, slug, description, origin, cacao_percentage,
                price_cents, image_url, churrito_quote, tags, in_stock
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(row.name)
        .bind(slugify(row.name))
        .bind(row.description)
        .bind(row.origin)
        .bind(row.cacao_percentage)
        .bind(row.price_cents)
        .bind(row.image_url)
        .bind(row.churrito_quote)
        .bind(&tags)
        .bind(true)
        .execute(pool)
        .await?;
    }

    Ok(())
}

pub async fn run_and_report(pool: &PgPool) -> Result<(), sqlx::Error> {
    run(pool).await?;
    println!(
        "init_db: created schema and inserted {} chocolates",
        SEED.len()
    );
    Ok(())
}
