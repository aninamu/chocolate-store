---
name: sync-seed-with-schema
description: When schema updates are made in backend/src/models.rs (ChocolateOut), update backend/src/seed.rs to ensure seeded db items match the schema. Use whenever editing, adding, or removing fields on ChocolateOut or the chocolates table, or when the user mentions seed data or seed.rs drift.
---

# Sync seed.rs with backend schema changes

When `ChocolateOut` in `backend/src/models.rs` or the `chocolates` table in `backend/src/schema.sql` is modified, the seed catalog in `backend/src/seed.rs` (and the wiring in `backend/src/init_db_lib.rs`) can drift. This skill makes sure seeded DB rows still satisfy the schema after every change.

## Files involved

- `backend/src/models.rs` — API types (e.g. `ChocolateOut`).
- `backend/src/schema.sql` — Postgres DDL for `chocolates`, `orders`, `order_items`.
- `backend/src/seed.rs` — `SEED` slice of catalog rows + `slugify()`.
- `backend/src/init_db_lib.rs` — inserts each `SEED` row into Postgres.

The DB is wiped and reseeded on every `make dev`, so `seed.rs` is the single source of truth for catalog data.

## The audit's central question

For every field on `ChocolateOut`, ask the **contract** question, not the **presence** question:

- ❌ Wrong (presence): "Does some value of the right type reach the DB?"
- ✅ Right (contract): "Can `seed.rs` express every value the schema permits for this field?"

A literal in `init_db_lib.rs` (e.g. `in_stock=true` hardcoded in SQL bind) passes the presence check but **fails the contract check** when the seed struct cannot override it. Treat any literal in the insert for a non-server-generated field as drift.

## Field categories

| Category | Examples | Where the value comes from | Seed key required? |
|---|---|---|---|
| **Server-generated** | `id`, `created_at` | DB default — not passed by seed insert | No |
| **Derived** | `slug` (from `name`) | `slugify(row.name)` in init | No, but `name` is required |
| **Row-sourced required** | `name`, `description`, `price_cents`, `image_url`, `tags`, `in_stock` | `SeedRow` fields / insert binds | Yes |
| **Row-sourced optional** | `origin`, `cacao_percentage`, `churrito_quote` | Optional `SeedRow` fields | Optional per row |

## When to apply

Apply when `ChocolateOut` or `chocolates` schema changes could affect seeded catalog rows. Do NOT apply for checkout-only types (`CartLineIn`, `CheckoutIn`, `CheckoutOut`).

## Workflow

1. Diff the schema/model change on `ChocolateOut` and `schema.sql`.
2. Update `SeedRow` in `models.rs` if the seed struct needs new fields.
3. Add the field to every relevant entry in `SEED` in `seed.rs` (or mark optional with `Option`).
4. Wire the field through the INSERT in `init_db_lib.rs` using seed row values, not literals.
5. Run `make services-up` and confirm `init-db` succeeds.

## Checklist

- [ ] Updated `schema.sql` if column added/removed
- [ ] Updated `ChocolateOut` and `SeedRow`
- [ ] Updated all `SEED` entries in `seed.rs`
- [ ] Updated `init_db_lib.rs` INSERT binds
- [ ] No literals in init for row-sourced fields
