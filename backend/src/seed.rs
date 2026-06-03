use unicode_normalization::UnicodeNormalization;
use uuid::Uuid;

pub struct SeedRow {
    pub name: &'static str,
    pub description: &'static str,
    pub origin: Option<&'static str>,
    pub cacao_percentage: Option<i32>,
    pub price_cents: i32,
    pub image_url: &'static str,
    pub tags: &'static [&'static str],
}

pub fn slugify(name: &str) -> String {
    let normalized: String = name
        .nfkd()
        .filter(|c| c.is_ascii())
        .collect();
    let slug: String = normalized
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = slug.trim_matches('-');
    if trimmed.is_empty() {
        "chocolate".to_string()
    } else {
        trimmed.to_string()
    }
}

pub const SEED: &[SeedRow] = &[
    SeedRow {
        name: "Ecuador Single-Origin 70%",
        description: "Stone-ground dark from high-elevation Nacional beans. Notes of black tea, fig, and toasted almond.",
        origin: Some("Ecuador"),
        cacao_percentage: Some(70),
        price_cents: 899,
        image_url: "https://images.unsplash.com/photo-1493925410384-84f842e616fb?w=600&q=80",
        tags: &["dark", "single-origin", "70%"],
    },
    SeedRow {
        name: "Madagascar Sambirano 85%",
        description: "Intense and bright with red fruit, a touch of smoke, and a long finish.",
        origin: Some("Madagascar"),
        cacao_percentage: Some(85),
        price_cents: 1099,
        image_url: "https://images.unsplash.com/photo-1511381939415-e44015466834?w=600&q=80",
        tags: &["dark", "single-origin", "85%"],
    },
    SeedRow {
        name: "Sea Salt Caramel Dark",
        description: "Silky caramel folded into 64% dark with flaked sea salt for balance.",
        origin: Some("California, USA"),
        cacao_percentage: Some(64),
        price_cents: 749,
        image_url: "https://images.unsplash.com/photo-1772985433602-f2725a31d547?w=600&q=80",
        tags: &["dark", "caramel", "salt"],
    },
    SeedRow {
        name: "Hazelnut Praline Milk",
        description: "Roasted hazelnut praline and milk chocolate — smooth, nutty, crowd-pleasing.",
        origin: Some("Piedmont, Italy"),
        cacao_percentage: Some(40),
        price_cents: 799,
        image_url: "https://images.unsplash.com/photo-1630953900279-8efae9d0e4d9?w=600&q=80",
        tags: &["milk", "nutty", "praline"],
    },
    SeedRow {
        name: "Classic Milk Bar",
        description: "The everyday bar: creamy, sweet, and balanced for hot cocoa or snacking.",
        origin: Some("Vermont, USA"),
        cacao_percentage: Some(38),
        price_cents: 499,
        image_url: "https://images.unsplash.com/photo-1619848566843-9027f3c7aac2?w=600&q=80",
        tags: &["milk", "classic"],
    },
    SeedRow {
        name: "Ruby Berry Bar",
        description: "Naturally pink ruby cocoa with tart berry notes — no added color.",
        origin: Some("Belgium"),
        cacao_percentage: Some(47),
        price_cents: 949,
        image_url: "https://images.unsplash.com/photo-1608932586368-b4266fe7f98c?w=600&q=80",
        tags: &["ruby", "fruity"],
    },
    SeedRow {
        name: "White Chocolate & Pistachio",
        description: "Creamy white chocolate studded with pistachio and a whisper of vanilla.",
        origin: Some("Turkey"),
        cacao_percentage: Some(0),
        price_cents: 899,
        image_url: "https://images.unsplash.com/photo-1706167754832-78f1fda7226c?w=600&q=80",
        tags: &["white", "nutty"],
    },
    SeedRow {
        name: "Vegan Almond Dark",
        description: "72% dark with almond butter and oat milk — bold, nutty, fully plant-based.",
        origin: Some("Oregon, USA"),
        cacao_percentage: Some(72),
        price_cents: 849,
        image_url: "https://images.unsplash.com/photo-1720029106261-0d0396bb270d?w=600&q=80",
        tags: &["dark", "vegan", "almond"],
    },
    SeedRow {
        name: "Raspberry Truffle Box (12)",
        description: "A dozen velvety ganache truffles with raspberry confit centers.",
        origin: Some("France"),
        cacao_percentage: Some(55),
        price_cents: 2499,
        image_url: "https://images.unsplash.com/photo-1526823127573-0fda76b6c24f?w=600&q=80",
        tags: &["gift", "truffle", "fruit"],
    },
    SeedRow {
        name: "Chili & Cinnamon Dark",
        description: "Warm spices and a gentle heat that builds into a smooth dark finish.",
        origin: Some("Mexico"),
        cacao_percentage: Some(68),
        price_cents: 799,
        image_url: "https://images.unsplash.com/photo-1601876819169-9ddf6f214a47?w=600&q=80",
        tags: &["dark", "spicy"],
    },
    SeedRow {
        name: "Orange Zest 65%",
        description: "Infused with cold-pressed orange oil — like a marmalade memory in each bite.",
        origin: Some("Spain"),
        cacao_percentage: Some(65),
        price_cents: 729,
        image_url: "https://images.unsplash.com/photo-1611625309355-44750e8b3498?w=600&q=80",
        tags: &["dark", "citrus"],
    },
    SeedRow {
        name: "Fresh Mint Dark Bites",
        description: "Encapsulated mint essence in 60% dark — cool, not toothpaste.",
        origin: Some("Switzerland"),
        cacao_percentage: Some(60),
        price_cents: 899,
        image_url: "https://images.unsplash.com/photo-1636450525985-f38e86fd4759?w=600&q=80",
        tags: &["dark", "mint", "bites"],
    },
    SeedRow {
        name: "Gianduja Spread Jar",
        description: "Hazelnut and cocoa in spreadable form — perfect on toast or off a spoon.",
        origin: Some("Piedmont, Italy"),
        cacao_percentage: Some(32),
        price_cents: 1299,
        image_url: "https://images.unsplash.com/photo-1551578657-a7e74acb0135?w=600&q=80",
        tags: &["spread", "hazelnut"],
    },
    SeedRow {
        name: "Cocoa Nibs Crunch 72%",
        description: "Extra cocoa nibs folded in for snap and a slow chocolate bloom.",
        origin: Some("Peru"),
        cacao_percentage: Some(72),
        price_cents: 819,
        image_url: "https://images.unsplash.com/photo-1587271644048-2fbb187de8d8?w=600&q=80",
        tags: &["dark", "nibs", "textured"],
    },
];

pub async fn insert_seed_rows(pool: &sqlx::PgPool) -> Result<usize, sqlx::Error> {
    let mut count = 0usize;
    for row in SEED {
        let id = Uuid::new_v4();
        let slug = slugify(row.name);
        let tags: Vec<String> = row.tags.iter().map(|s| (*s).to_string()).collect();
        sqlx::query(
            r#"
            INSERT INTO chocolates (
                id, name, slug, description, origin, cacao_percentage,
                price_cents, image_url, tags, in_stock
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
            "#,
        )
        .bind(id)
        .bind(row.name)
        .bind(slug)
        .bind(row.description)
        .bind(row.origin)
        .bind(row.cacao_percentage)
        .bind(row.price_cents)
        .bind(row.image_url)
        .bind(&tags)
        .execute(pool)
        .await?;
        count += 1;
    }
    Ok(count)
}

pub async fn run_init(pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
    for statement in crate::schema::CREATE_SCHEMA.split(';') {
        let s = statement.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(pool).await?;
        }
    }
    let n = insert_seed_rows(pool).await?;
    tracing::info!("init_db: created schema and inserted {} chocolates", n);
    Ok(())
}
