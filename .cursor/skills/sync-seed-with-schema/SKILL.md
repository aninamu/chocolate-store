---
name: sync-seed-with-schema
description: When schema updates are made in the Rust backend DTOs or SQL schema, update backend/src/seed.rs to ensure seeded db items match. Use whenever editing ChocolateOut, schema.sql, seed data, or seed drift.
---

# Sync seed.rs with backend schema changes

When `backend/src/dto.rs` (`ChocolateOut`), `backend/src/schema.sql`, or related API shapes change, the seed catalog in `backend/src/seed.rs` (and the wiring in `backend/src/bin/init_db.rs`) can drift. This skill makes sure seeded DB rows still satisfy the schema after every change.

## Files involved

- `backend/src/dto.rs` — serde API DTOs (e.g. `ChocolateOut`).
- `backend/src/schema.sql` — Postgres DDL for `chocolates`, `orders`, `order_items`.
- `backend/src/seed.rs` — `SEED: &[SeedRow]` catalog rows.
- `backend/src/bin/init_db.rs` — runs `schema.sql` and inserts each `SEED` row.

The DB is wiped and reseeded on every `make dev`, so `seed.rs` is the single source of truth for catalog data.

## Workflow

1. Update `schema.sql` if the database column set changed.
2. Update `ChocolateOut` in `dto.rs` if the HTTP response shape changed.
3. Add the field to every `SeedRow` in `seed.rs` (or mark optional in schema and use `Option`).
4. Wire the field through the `INSERT` in `init_db.rs`.
5. Run `make services-up && make test-backend`.

## Field categories

| Category | Examples | Seed | init_db wiring |
|----------|----------|------|----------------|
| Server-generated | `id`, `created_at` | Omit | DB default |
| Derived | `slug` from `name` | Omit | `slugify(row.name)` |
| Row-sourced required | `name`, `price_cents`, `tags` | Required on every row | `$n` bind from row |
| Row-sourced optional | `origin`, `cacao_percentage`, `churrito_quote` | `Option` on `SeedRow` | bind optional |

Never hardcode row-sourced literals in `init_db.rs` (e.g. always `in_stock = TRUE` in SQL is OK only if the schema has no per-row override requirement; prefer binding from seed when the shop needs varied stock states).

## Checklist

- [ ] `schema.sql` column matches DTO + seed
- [ ] Every `SEED` entry has required fields
- [ ] `init_db.rs` INSERT lists all non-generated columns
- [ ] `make test-backend` passes
