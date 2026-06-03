pub const CREATE_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS chocolates (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    origin VARCHAR(120),
    cacao_percentage INTEGER,
    price_cents INTEGER NOT NULL,
    image_url VARCHAR(2000) NOT NULL,
    tags VARCHAR(64)[] NOT NULL DEFAULT '{}',
    in_stock BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(320) NOT NULL,
    total_cents INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'paid',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    chocolate_id UUID NOT NULL REFERENCES chocolates(id),
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_chocolate_id ON order_items(chocolate_id);
"#;
