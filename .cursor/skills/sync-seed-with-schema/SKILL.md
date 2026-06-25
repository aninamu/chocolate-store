---
name: sync-seed-with-schema
description: When schema updates are made in backend/app/schemas, update backend/app/seed.py to ensure seeded db items match the schema. Use whenever editing, adding, or removing fields in any file under backend/app/schemas/, or when the user mentions Pydantic schemas, ChocolateOut, seed data, or seed.py drift.
---

# Sync seed.py with backend schema changes

When any file under `backend/app/schemas/` is modified, the seed catalog in `backend/app/seed.py` (and the wiring in `backend/app/init_db.py`) can drift. This skill makes sure seeded DB rows still satisfy the schema after every change.

## Files involved

- `backend/app/schemas/` — Pydantic API schemas (e.g. `ChocolateOut`).
- `backend/app/models/chocolate.py` — Beanie `Document` models (catalog + orders). The seed feeds `Chocolate` directly.
- `backend/app/seed.py` — `SEED: list[dict]` of catalog rows.
- `backend/app/init_db.py` — constructs `Chocolate(...)` from each `SEED` row.

The DB is wiped and reseeded on every `make dev`, so `seed.py` is the single source of truth for catalog data.

## The audit's central question

For every field on the `*Out` schema, ask the **contract** question, not the **presence** question:

- ❌ Wrong (presence): "Does some value of the right type reach the model?"
- ✅ Right (contract): "Can `seed.py` express every value the schema permits for this field?"

A literal in `init_db.py` (e.g. `in_stock=True`, `status="paid"`) passes the presence check but **fails the contract check** because the seed dict cannot override it. Treat any literal in the `Chocolate(...)` / model constructor for a non-server-generated field as drift, exactly like a missing seed key.

## Field categories

Classify every schema field into exactly one bucket. The expected wiring is different for each, and confusing them is how literals slip in.

| Category | Examples | Where the value comes from | Seed key required? |
|---|---|---|---|
| **Server-generated** | `id` (`default_factory=uuid4`), `created_at` (default to `datetime.now(timezone.utc)`) | DB / model default — never passed by `init_db.py` | No |
| **Derived** | `slug` (computed from `name`) | Computed inline in `init_db.py` (e.g. `slug=slugify(row["name"])`) | No, but the source field (e.g. `name`) is required |
| **Row-sourced required** | `name`, `description`, `price_cents`, `image_url`, `tags`, `in_stock` (bool exposed in schema as required) | `row["field"]` in `init_db.py` | Yes, on every dict |
| **Row-sourced optional** | `origin`, `cacao_percentage` | `row.get("field")` in `init_db.py` | Optional per dict |

**Rule:** a field is row-sourced unless it's clearly server-generated or derived. Booleans and other low-cardinality enums (`in_stock`, `status`) are the easiest trap — schema-required booleans are still row-sourced; defaulting them in the model does not make them server-generated.

## When to apply

Apply this skill any time a change in `backend/app/schemas/` could affect what an out-bound model exposes — typically schemas suffixed `*Out` like `ChocolateOut`. Also apply if the user explicitly asks to "update seed", "fix seed drift", or "make seed match the schema".

Do NOT apply for input-only schemas (e.g. `CartLineIn`, `CheckoutIn`, `CheckoutOut`) — those describe request/response payloads, not seeded rows.

## Workflow

1. **Diff the schema change.** Identify added, removed, renamed, or retyped fields on any `*Out` schema that maps to a seeded table (today: `ChocolateOut` → `chocolates`).

2. **Propagate to the Beanie model.** Open the matching file in `backend/app/models/` and confirm the field exists with a compatible type, nullability, and default. Add/edit the field if missing. Required fields without defaults must get values from seed rows.

3. **Update every entry in `SEED`.** In `backend/app/seed.py`:
   - For an **added required field**: add a realistic value to every dict in `SEED`.
   - For an **added optional field**: only add it where it makes sense; leave others to fall through to `row.get(...)`.
   - For a **removed field**: delete the key from every dict.
   - For a **renamed field**: rename the key in every dict.
   - For a **retyped field**: update every value to the new type and verify Pydantic constraints (e.g. `Field(ge=..., le=...)`, `EmailStr`, length bounds).
   - Keep entries internally consistent (e.g. `cacao_percentage` in `0..100`, `price_cents` as integer cents, `tags` as a list of short strings).

4. **Wire the field through `init_db.py`.** In `_run()`, the `Chocolate(...)` call must pass the new field. Use `row["field"]` for required fields and `row.get("field", <default>)` for optional ones, matching the model's nullability. **Never hardcode a literal** for a row-sourced field — even if every current row would use the same value, the seed must remain authoritative.

5. **Audit every field as a row in a table.** Build (mentally or in a scratchpad) the audit table below for the changed schema. Any row whose `init_db.py wiring` column reads as a literal (e.g. `True`, `"paid"`, `0`) for a non-server-generated, non-derived field is **drift** and must be rewired through `row.get(...)`.

   ```
   | Schema field | Category | Model column | Seed key | init_db.py wiring |
   |---|---|---|---|---|
   ```

   Red flags in the wiring column:
   - A literal value where the category is row-sourced.
   - An em-dash / blank seed key for a row-sourced category.
   - `row.get("field")` (no default) for a NOT NULL column when some rows might omit the key.

6. **Verify with a quick mental round-trip.** For every `SEED` row, the resulting document must serialize cleanly into the updated `*Out` schema (`model_config = {"from_attributes": True}`). Specifically check:
   - All non-`Optional` schema fields are populated.
   - Types match (e.g. `int`, `str`, `List[str]`, `datetime`).
   - Validators pass (`Field(...)` constraints, `EmailStr`, etc.).

7. **Sanity-check the seed loader.** If the schema change implies a new table or relationship, also extend `init_db.py` to create those rows; don't leave the work half-done.

## Quick checklist

Copy this into your scratch space and tick as you go:

```
- [ ] Identified which *Out schema(s) changed
- [ ] Listed added/removed/renamed/retyped fields
- [ ] Categorized every schema field (server-generated / derived / row-sourced required / row-sourced optional)
- [ ] Updated matching Beanie Document field(s)
- [ ] Edited every dict in SEED to match
- [ ] Updated init_db.py constructor call
- [ ] No literals in init_db.py for row-sourced fields (every such field reads from `row[...]` or `row.get(...)`)
- [ ] Confirmed every SEED row validates against the new schema
- [ ] No leftover keys in SEED that no longer exist on the model/schema
```

## Worked example

Schema change: add a required `weight_grams: int` to `ChocolateOut`.

1. `backend/app/schemas/chocolate.py` — add `weight_grams: int` (no default) on `ChocolateOut`.
2. `backend/app/models/chocolate.py` — add `weight_grams: int` on `Chocolate`.
3. `backend/app/seed.py` — add `"weight_grams": <int>` to every dict in `SEED` with a realistic value per product.
4. `backend/app/init_db.py` — pass `weight_grams=row["weight_grams"]` inside the `Chocolate(...)` call.
5. Re-read each `SEED` entry to confirm the new key is present and is an `int`.

If instead the field were optional (`Optional[int] = None`), the model column would be `nullable=True`, `SEED` entries could omit the key, and `init_db.py` would use `row.get("weight_grams")`.

## Anti-patterns

- Editing the schema and stopping there. Seed rows that miss a required field will crash `init_db` on the next `make dev`.
- Leaving stale keys in `SEED` after removing a field — they get silently ignored and mislead future readers.
- Adding a field to only some `SEED` rows when the schema marks it required.
- Putting the new field on the Beanie model but forgetting to thread it through the `Chocolate(...)` call in `init_db.py` — the field will use the default for every row.
- **Hardcoding a literal in `init_db.py` for a row-sourced field** (e.g. `in_stock=True`, `status="paid"`). The model gets a value and the schema validates, but `seed.py` is no longer authoritative and you can't express the "off" case (out-of-stock chocolate, refunded order, etc.) without editing code outside `seed.py`. This is the mirror image of forgetting the constructor call: same drift, different direction.
- **Treating the field-presence check as the audit.** "A value reaches the model" is necessary but not sufficient. The real bar is "every value the schema permits is reachable from a `SEED` dict." Apply the contract question (top of file) field-by-field.
- **Confusing model defaults with server-generated values.** `default=True` on a column makes a value appear if you omit it; it does not make the field server-generated. Server-generated means `id`/`created_at` style — emitted by the DB or the model with no per-row meaning. Everything else is row-sourced.
