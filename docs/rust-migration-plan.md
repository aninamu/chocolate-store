# Backend Migration Plan: Python (FastAPI) → Rust

## Goal

Replace the Python/FastAPI backend in `backend/` with a Rust implementation that is
**behaviorally identical**. Every existing HTTP endpoint, response shape, status code,
caching behavior, database schema, seed data, and OpenAPI surface must be preserved.
All current test coverage must be reproduced as equivalent Rust tests. **No existing
functionality is removed and no new functionality is added.**

The frontend (`frontend/`), its tests, and the public API contract are **not** changed.

---

## 1. Current backend inventory (what must be preserved exactly)

### 1.1 HTTP surface

| Method & path | Handler | Behavior to preserve |
|---|---|---|
| `GET /api/health` | `app/main.py:health` | Returns `{"ok": bool, "database": bool, "redis": bool}`. `ok = database && redis`. DB checked via `SELECT 1`; Redis via `PING`. Never throws; failures degrade to `false`. |
| `GET /api/chocolates` | `routers/chocolates.py:list_chocolates` | Query params: repeatable `tag` (OR semantics), `sort` (`name`\|`price_asc`\|`price_desc`\|`cacao_desc`, default `name`). Returns `list[ChocolateOut]`. Redis-cached. |
| `GET /api/chocolates/{chocolate_id}` | `routers/chocolates.py:get_chocolate` | UUID path param. `200` with `ChocolateOut` or `404 {"detail": "Chocolate not found"}`. Redis-cached. |
| `POST /api/checkout` | `routers/checkout.py:checkout` | Body `CheckoutIn`. Returns `CheckoutOut {order_id, total_cents}`. Writes `orders` + `order_items` in a transaction. |
| `GET /openapi.json` | FastAPI auto | OpenAPI 3 doc; title contains "chocolate"; `tag` param is `array` with description containing "at least one" and "or semantics". |
| `GET /docs`, `GET /redoc` | FastAPI auto | Swagger/ReDoc UI (auto-generated; keep equivalent). |

### 1.2 App config

- Title `"chocolate store API"`, version `"0.1.0"`.
- CORS: `allow_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]`,
  `allow_credentials = true`, `allow_methods = ["*"]`, `allow_headers = ["*"]`.
- Lifespan shutdown: close Redis connection and dispose DB pool.

### 1.3 Data model (`app/models/chocolate.py`)

- **`chocolates`**: `id uuid PK (default uuid4)`, `name varchar(200) NOT NULL`,
  `slug varchar(200) UNIQUE NOT NULL`, `description text NOT NULL`,
  `origin varchar(120) NULL`, `cacao_percentage integer NULL`,
  `price_cents integer NOT NULL`, `image_url varchar(2000) NOT NULL`,
  `tags varchar(64)[] DEFAULT '{}'`, `in_stock boolean NOT NULL DEFAULT true`,
  `created_at timestamptz NOT NULL DEFAULT now()`.
- **`orders`**: `id uuid PK`, `customer_name varchar(200) NOT NULL`,
  `customer_email varchar(320) NOT NULL`, `total_cents integer NOT NULL`,
  `status varchar(32) NOT NULL DEFAULT 'paid'`, `created_at timestamptz NOT NULL DEFAULT now()`.
- **`order_items`**: `id uuid PK`,
  `order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE (indexed)`,
  `chocolate_id uuid NOT NULL REFERENCES chocolates(id) (indexed)`,
  `quantity integer NOT NULL`, `unit_price_cents integer NOT NULL`.

Schema is created from the models on each boot (no migration history) and seeded
from `app/seed.py`. The DB is dropped/recreated every `make services-up`/`make dev`.

### 1.4 Response/request schemas (`app/schemas/chocolate.py`)

- `ChocolateOut`: `id, name, slug, description, origin?, cacao_percentage?, price_cents, image_url, tags[], in_stock, created_at`.
- `CartLineIn`: `chocolate_id: uuid`, `quantity: int` (`1..=99`).
- `CheckoutIn`: `customer_name` (`1..=200` chars), `customer_email` (valid email), `items` (≥1).
- `CheckoutOut`: `order_id: uuid`, `total_cents: int`.

### 1.5 Business logic specifics (must replicate exactly)

- **List query**: tag filter uses Postgres array overlap (`tags && ARRAY[...]::varchar(64)[]`),
  OR semantics. Sorting:
  - `price_asc` → `price_cents ASC, name ASC`
  - `price_desc` → `price_cents DESC, name ASC`
  - `cacao_desc` → `cacao_percentage DESC NULLS LAST, name ASC`
  - `name`/default → `name ASC`
  - Unknown sort value falls back to `name`.
- **Cache keys** (preserve byte-for-byte for cache compatibility):
  - List: `chocolates:list:{tags}:{sortkey}` where `tags` = comma-joined, trimmed,
    de-blanked, **sorted** tag list; `sortkey` = normalized sort.
  - Detail: `chocolates:id:{uuid}`.
  - TTL = `CACHE_TTL_SECONDS` (default `60`). Cached value is the JSON of the response.
  - Cache read failures and JSON parse failures fall through to the DB (no error surfaced).
- **Checkout**:
  - Trim `customer_name`; if empty after trim → `400 {"detail": "customer_name must not be empty or whitespace"}`.
  - Lowercase `customer_email` before storing.
  - For each line: look up chocolate; unknown → `400 {"detail": "Unknown chocolate {id}"}`;
    out of stock → `400 {"detail": "{name} is out of stock"}`.
  - `total_cents = Σ price_cents × quantity`; persist `orders` (status `paid`) + `order_items`
    in one transaction; return `{order_id, total_cents}`.
- **Validation errors**: FastAPI returns `422` with `{"detail": [ {..., "msg": ...}, ... ]}`.
  The frontend (`frontend/src/lib/api.ts`) parses both string `detail` and array `detail`
  (joining `msg` fields with `·`). The Rust implementation must return `422` with a
  `detail` array whose elements carry a `msg` field so the frontend error path is unchanged.

### 1.6 Configuration / env

- Reads `DATABASE_URL`, `REDIS_URL`, `CACHE_TTL_SECONDS` from repo-root `.env` / `.env.local`.
- `DATABASE_URL` uses the SQLAlchemy scheme `postgresql+asyncpg://...`.
  **Caveat:** Rust Postgres drivers expect `postgres://`/`postgresql://`. The Rust app
  must translate the scheme at startup (strip `+asyncpg`) so the existing `.env`,
  `.env.example`, and CI env values keep working unchanged.

### 1.7 Existing tests (coverage to reproduce)

From `backend/tests/`:
- `conftest.py`: skips API tests if ports `55432`/`63790` are closed; provides an
  in-process client against the app.
- `test_health.py`: health shape + `ok is True`.
- `test_chocolates_api.py`: list returns items; tag filter OR semantics; `price_asc`
  sorted; detail by id + `404`.
- `test_checkout_api.py`: success (`total == price × 2`); unknown chocolate `400`
  (`"unknown"` in detail); out-of-stock `400` (`"stock"` in detail) — toggles `in_stock`
  directly in the DB via raw SQL.
- `test_imports.py`: app title contains "chocolate"; OpenAPI `tag` param is `array`
  with description containing "at least one" and "or semantics".

---

## 2. Target Rust stack

| Concern | Choice | Rationale / alternative |
|---|---|---|
| Async runtime | `tokio` | De-facto standard. |
| Web framework | `axum` | Tower ecosystem, first-class async, clean extractors. *Alt:* `actix-web`. |
| DB driver | `sqlx` (Postgres, `runtime-tokio-rustls`, `uuid`, `chrono`) | Async, native Postgres arrays, no ORM lock-in; matches the existing hand-written query style. *Alt:* `sea-orm`. |
| Redis | `redis` crate (aio / `tokio-comp`) | Async multiplexed connection. *Alt:* `fred`. |
| OpenAPI | `utoipa` + `utoipa-swagger-ui` | Generates `/openapi.json`, `/docs`; lets us pin the exact `tag` param description/type and title. |
| CORS | `tower-http::cors` | Mirrors FastAPI CORS settings. |
| Serialization | `serde` / `serde_json` | DTOs and cache JSON. |
| UUID / time | `uuid` (v4), `chrono` (`DateTime<Utc>`, RFC3339) | Match `id`/`created_at` formats. |
| Validation | `validator` + manual checks | Reproduce min/max length, quantity range, email, `422` shape. |
| Email check | `validator`'s email rule (or `email_address`) | Mirror Pydantic `EmailStr`. |
| Config / env | `dotenvy` + `serde`/`envy` | Load `.env`, read the three settings. |
| Coverage | `cargo-llvm-cov` | Report-only, mirrors `pytest-cov` (no enforced gate). *Alt:* `cargo-tarpaulin`. |
| Dev hot reload | `cargo-watch -x run` | Replaces `uvicorn --reload`. |

---

## 3. Proposed Rust project layout (`backend/`)

The Python package is replaced in place so all repo paths/scripts keep pointing at `backend/`.

```
backend/
  Cargo.toml
  Cargo.lock
  src/
    main.rs            # build router, CORS, state, serve; graceful shutdown (lifespan equiv)
    config.rs          # Settings: DATABASE_URL (scheme-translated), REDIS_URL, CACHE_TTL_SECONDS
    state.rs           # AppState { pg pool, redis (optional), cache_ttl }
    db.rs              # PgPool init (pool_pre_ping equiv via test-before-acquire)
    cache.rs           # get/set helpers; graceful degradation on RedisError
    models.rs          # ChocolateRow, OrderRow, OrderItemRow (sqlx FromRow)
    schemas.rs         # ChocolateOut, CartLineIn, CheckoutIn, CheckoutOut (serde + ToSchema)
    seed.rs            # SEED data (ported 1:1) + slugify()
    openapi.rs         # utoipa ApiDoc (title, version, tag param description)
    error.rs           # ApiError -> (status, {"detail": ...}); 422 detail-array shape
    routers/
      mod.rs
      health.rs
      chocolates.rs    # list + detail, caching, sort/tag logic
      checkout.rs      # transactional order creation
    bin/
      init_db.rs       # create schema + seed (replaces app/init_db.py)
  migrations/          # or schema.sql: DDL mirroring section 1.3 exactly
  tests/
    common/mod.rs      # port check (skip if closed) + spawn app / test client
    health.rs
    chocolates_api.rs
    checkout_api.rs
    openapi.rs
  README.md            # updated run/test instructions
```

Schema creation approach: keep the "schema from code each boot" behavior by having
`bin/init_db` execute an idempotent `CREATE TABLE` DDL (a `schema.sql` embedded via
`include_str!`, or `sqlx::migrate!`). The DDL must reproduce section 1.3 exactly,
including `varchar(64)[] DEFAULT '{}'`, `timestamptz DEFAULT now()`, `status DEFAULT 'paid'`,
FK `ON DELETE CASCADE`, and the two indexes. IDs may use DB-side `gen_random_uuid()`
defaults or client-side `Uuid::new_v4()` (either preserves behavior; pick one and be consistent).

---

## 4. Endpoint-by-endpoint mapping

### 4.1 `GET /api/health`
- Acquire pool connection, run `SELECT 1` → `database = ok`.
- `PING` Redis → `redis = ok`. Catch all errors, log warn, default `false`.
- Return `{"ok": database && redis, "database", "redis"}`.

### 4.2 `GET /api/chocolates`
- Parse repeated `tag` and optional `sort` (axum `Query` with `Vec<String>` via `serde`
  sequence handling, or a custom extractor to allow repeated keys).
- Build cache key (section 1.5) → `cache_get`; on hit, return raw cached JSON.
- On miss: build SQL with optional `WHERE tags && $1::varchar(64)[]` and the matching
  `ORDER BY`. Map rows → `ChocolateOut`. Serialize, `cache_set` with TTL, return.

### 4.3 `GET /api/chocolates/{id}`
- Parse `Uuid` (invalid UUID → `422`, matching FastAPI path validation).
- Cache by `chocolates:id:{uuid}`; on miss query by id; `None` → `404 {"detail": "Chocolate not found"}`.

### 4.4 `POST /api/checkout`
- Deserialize + validate `CheckoutIn` (`422` on schema violations with `detail` array).
- Trim name → empty → `400`.
- Begin transaction; insert order; per line lookup chocolate, enforce unknown/out-of-stock
  `400`s, accumulate total, insert order items; update `total_cents`; commit.
- Return `{order_id, total_cents}`.

### 4.5 OpenAPI
- `utoipa` doc: `title = "chocolate store API"`, `version = "0.1.0"`.
- Annotate the `tag` query param as `array` with the exact description
  `"Repeat `tag=`; OR semantics: chocolate must include at least one listed tag."`
  Serve at `/openapi.json` (+ `/docs`).

---

## 5. Repo wiring changes (outside `backend/src`)

All keep the **same command surface** so contributors and CI behave identically.

- **`Makefile`**
  - `test-backend` → `cd backend && cargo test` (release/debug as preferred).
  - `test-backend-coverage` → `cd backend && cargo llvm-cov --html` (report-only).
  - Other targets unchanged in name/behavior.
- **`scripts/bootstrap.sh`**
  - Replace Python venv/pip steps with a Rust toolchain check (`cargo`/`rustc`) and
    `cargo fetch`/`cargo build` for `backend/`. Keep Node, Postgres, Redis, `.env`,
    `initdb` steps unchanged.
- **`scripts/services-up.sh`**
  - Replace `.venv/bin/python -m app.init_db` with `cargo run --bin init_db`
    (or a prebuilt `init_db` binary). DB drop/recreate + Redis flush logic unchanged.
- **`scripts/dev.sh`**
  - Replace `uvicorn app.main:app --reload ...` with `cargo watch -x 'run'`
    (or `cargo run`), still binding `BACKEND_PORT` on `127.0.0.1`.
- **`.github/workflows/ci.yml`**
  - Keep the **job name `backend-tests`** (it is a required merge check per README).
  - Swap Python setup → Rust toolchain (`dtolnay/rust-toolchain@stable` + `Swatinem/rust-cache`).
  - Replace install/init/test steps with `cargo build`, `cargo run --bin init_db`,
    `make test-backend`. Keep the `postgres:16` + `redis:7` service containers and the
    `DATABASE_URL`/`REDIS_URL` env unchanged.
  - `frontend-tests` job untouched.
- **`.env.example` / `.env`**
  - Leave `DATABASE_URL` as-is (scheme translated in code). Document the translation in
    the backend README so the value stays compatible with `psql`/SQLAlchemy-style tooling.
- **`backend/pyproject.toml`** removed; replaced by `Cargo.toml`. Remove `app/`,
  `tests/*.py`, `conftest.py` once Rust equivalents are in place.
- **Root `README.md`**: update the "FastAPI backend" wording, the `uvicorn` references,
  and the demo step about editing `routers/chocolates.py` to point at the Rust files.
  No behavioral claims change.

---

## 6. Test coverage parity (Rust)

Each Python test maps to a Rust integration test under `backend/tests/`. The shared
`common/mod.rs` reproduces `conftest.py`: check TCP reachability of `55432`/`63790`
and **skip (return early) if closed**, and provide a helper that builds the app and a
client (axum `Router` via `tower::ServiceExt::oneshot`, or a bound ephemeral server +
`reqwest`).

| Python test | Rust test | Assertions preserved |
|---|---|---|
| `test_health_returns_shape` | `health.rs` | shape + `ok == true` |
| `test_list_chocolates_returns_items` | `chocolates_api.rs` | non-empty list; has `id`/`name`/`price_cents` |
| `test_list_chocolates_tag_filter_or_semantics` | `chocolates_api.rs` | every row has `dark` or `milk` |
| `test_list_chocolates_sort_price_asc` | `chocolates_api.rs` | prices ascending |
| `test_get_chocolate_detail_and_404` | `chocolates_api.rs` | detail by id; random id → `404` |
| `test_checkout_success` | `checkout_api.rs` | `total_cents == price × 2` |
| `test_checkout_unknown_chocolate` | `checkout_api.rs` | `400`, `"unknown"` in detail |
| `test_checkout_out_of_stock` | `checkout_api.rs` | toggle `in_stock` via SQL; `400`, `"stock"` in detail |
| `test_openapi_on_app` | `openapi.rs` | title contains "chocolate" |
| `test_list_chocolates_exposes_repeated_tag_query_param` | `openapi.rs` | `tag` param `array`; desc has "at least one" + "or semantics" |

Coverage remains **report-only** (no minimum gate), matching the current setup.

---

## 7. Phased execution plan (each phase ends green before the next)

1. **Scaffold** — `Cargo.toml`, `main.rs` serving `/api/health` returning the right
   shape; `config.rs` (with scheme translation); `state.rs`. Verify it boots and
   `/api/health` responds.
2. **DB layer** — `db.rs`, `models.rs`, `schema.sql`/`migrations`, `seed.rs`,
   `bin/init_db`. Run `init_db` against the dev DB; confirm 14 rows seeded and schema
   matches `\d+` output from the Python schema.
3. **Cache** — `cache.rs` with graceful degradation; confirm `KEYS chocolates:*` after
   two list calls (mirrors the README demo) and identical key strings.
4. **Chocolates router** — list (tag/sort/cache) + detail (cache/404). Diff JSON
   responses against the Python backend for the same queries.
5. **Checkout router** — validation, transaction, error statuses. Diff responses for
   success/unknown/out-of-stock/validation cases.
6. **OpenAPI** — `utoipa` doc at `/openapi.json`; verify title + `tag` param schema/desc.
7. **CORS + lifespan** — `tower-http` CORS matching origins/methods/headers; graceful
   shutdown closing Redis/pool.
8. **Tests** — port all tests (section 6); `cargo test` green; wire `cargo-llvm-cov`.
9. **Repo wiring** — Makefile, scripts, CI, READMEs; run `make services-up && make test-backend`
   locally and confirm the full stack via `make dev` (frontend unchanged).
10. **Cleanup** — remove Python `app/`, `tests/*.py`, `pyproject.toml`, venv references.

**Suggested validation harness:** before deleting Python, run both backends side by
side on different ports and `diff` JSON for: `GET /api/chocolates` (each sort + tag
combos), several `GET /api/chocolates/{id}` (incl. 404), `POST /api/checkout`
(success/unknown/out-of-stock/invalid-email/empty-name/bad-quantity), `GET /api/health`,
and `GET /openapi.json` (compare `info.title` + the `tag` parameter object).

---

## 8. Risks & edge cases (and mitigations)

- **`DATABASE_URL` scheme** `postgresql+asyncpg://` → strip `+asyncpg` in `config.rs`
  before handing to `sqlx`. (Highest-likelihood footgun.)
- **Repeated query params** — axum's default `Query` does not collect repeated keys into
  a `Vec`; use `axum_extra::extract::Query` or `serde_qs`/a custom extractor.
- **Postgres array typing** — bind tag filter as `&[String]` cast to `varchar(64)[]`;
  map `tags` column to `Vec<String>`.
- **NULLS LAST** ordering for `cacao_desc` — emit `NULLS LAST` explicitly.
- **Cache JSON parity** — serialize the same DTO field set/order-insensitive JSON;
  store/return raw string. Keep cache **key** format byte-identical.
- **Validation error shape (`422`)** — must remain a `detail` **array** with `msg`
  fields so `frontend/src/lib/api.ts` join logic is unchanged.
- **`400` vs `422`** — empty/whitespace name is a `400` business error (post-validation),
  while length/email/quantity/items violations are `422`. Preserve the split exactly.
- **`created_at` format** — serialize `DateTime<Utc>` as RFC3339 string (frontend types
  `created_at: string`).
- **UUID default source** — choose client-side `Uuid::new_v4()` or DB `gen_random_uuid()`;
  ensure `pgcrypto`/`gen_random_uuid` availability if DB-side (PG16 has it built in).
- **`pool_pre_ping`** — emulate with sqlx `test_before_acquire(true)`.
- **Required CI check name** — keep job id `backend-tests`; renaming breaks the branch
  protection merge gate described in the README.
- **Build time in CI** — add `Swatinem/rust-cache` to keep CI duration reasonable.
- **Toolchain availability in Cursor Cloud** — Rust toolchain must be installed in the
  agent environment (rustup) and ideally baked into the cloud agent base image / setup
  script so other agents don't reinstall it.

---

## 9. Explicit non-goals

- No new endpoints, fields, query params, or response changes.
- No frontend changes (code or tests).
- No changes to ports, env var names, DB/Redis topology, or seed catalog contents.
- No added auth, pagination, rate limiting, or persistence guarantees.
- No enforced coverage threshold (stays report-only).

---

## 10. Definition of done

- `make services-up && make test-backend` passes with the Rust backend; all section-6
  tests are present and green.
- `make dev` serves the Rust API on `8000`; the unchanged frontend on `3000` works
  end-to-end (browse, filter, sort, detail, mock checkout).
- `GET /openapi.json` exposes the same title and `tag` param contract.
- Side-by-side JSON diff (section 7) shows no response differences for the covered cases.
- CI `backend-tests` job is green under the Rust toolchain; `frontend-tests` untouched.
- Python backend files removed; docs/scripts reference the Rust backend.
