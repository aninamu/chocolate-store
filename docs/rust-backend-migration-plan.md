# Backend Migration Plan: Python (FastAPI) → Rust (Axum)

## Goal

Replace the existing Python/FastAPI backend in `backend/` with a Rust implementation that is
**behaviorally identical** — same HTTP routes, same request/response JSON, same status codes,
same caching, same CORS, same DB schema and seed data — while keeping **all current
functionality and test coverage intact**. No functionality is removed and **no new
functionality is added**.

The Next.js frontend (`frontend/`), the data stores (Postgres 16 on `55432`, Redis 7 on
`63790`), the ports (`8000` backend), and the public API contract stay exactly the same. The
frontend must not require any change.

---

## 1. What exists today (inventory to preserve)

### 1.1 HTTP surface (the contract that must not change)

| Method | Path | Behavior | Success | Errors |
|--------|------|----------|---------|--------|
| `GET` | `/api/health` | Pings DB + Redis | `200` `{"ok": bool, "database": bool, "redis": bool}` | never errors; `ok = database && redis` |
| `GET` | `/api/chocolates` | List w/ `tag` (repeatable) + `sort` query | `200` `ChocolateOut[]` | `422` on bad query (FastAPI validation) |
| `GET` | `/api/chocolates/{id}` | Detail by UUID | `200` `ChocolateOut` | `404` `{"detail":"Chocolate not found"}`; `422` on non-UUID |
| `POST` | `/api/checkout` | Create order | `200` `{"order_id": uuid, "total_cents": int}` | `400` `{"detail": "..."}`; `422` on schema validation |

These are mounted as: `chocolates.router` at prefix `/api/chocolates`, `checkout.router` at
prefix `/api`, and `health` declared directly on the app. The Rust router must reproduce the
exact same final paths.

### 1.2 Response/request schemas (`backend/app/schemas/chocolate.py`)

- `ChocolateOut`: `id: uuid`, `name: str`, `slug: str`, `description: str`,
  `origin: str|null`, `cacao_percentage: int|null`, `price_cents: int`, `image_url: str`,
  `tags: str[]`, `in_stock: bool`, `created_at: datetime`.
- `CartLineIn`: `chocolate_id: uuid`, `quantity: int` (`ge=1, le=99`).
- `CheckoutIn`: `customer_name: str` (`min_length=1, max_length=200`), `customer_email: EmailStr`,
  `items: CartLineIn[]` (`min_length=1`).
- `CheckoutOut`: `order_id: uuid`, `total_cents: int`.

The exact field names and JSON types must be reproduced verbatim (the frontend `Chocolate`,
`CheckoutPayload`, `CheckoutResponse` types in `frontend/src/lib/types.ts` depend on them).

### 1.3 Business logic to replicate exactly

**`list_chocolates` (`backend/app/routers/chocolates.py`)**
- Cache key: `chocolates:list:<comma-joined sorted, trimmed, non-empty tags>:<normalized sort>`.
- Cache hit → parse JSON, return; parse failure → fall through to DB (logged at debug).
- Tag filter: trimmed, non-empty tags; Postgres array **overlap** (`&&`) → **OR semantics**
  (a row matches if it shares at least one tag). Case-sensitive (uses `varchar(64)` literals).
- Sort normalization: one of `name | price_asc | price_desc | cacao_desc`, anything else → `name`.
  - `price_asc` → `price_cents ASC, name ASC`
  - `price_desc` → `price_cents DESC, name ASC`
  - `cacao_desc` → `cacao_percentage DESC NULLS LAST, name ASC`
  - `name` (default) → `name ASC`
- On miss: query, serialize result, `SETEX` with `CACHE_TTL_SECONDS`, return.

**`get_chocolate`**
- Cache key: `chocolates:id:<uuid>`. Same hit/miss/SETEX flow.
- Not found → `404 {"detail": "Chocolate not found"}`.

**`checkout` (`backend/app/routers/checkout.py`)**
- `customer_name.strip()`; empty after strip → `400 {"detail":"customer_name must not be empty or whitespace"}`.
  (Note: `min_length=1` lets whitespace-only pass schema validation, so this 400 is a distinct
  runtime check that must be preserved.)
- Open a transaction. Insert `Order(status="paid", total_cents=0)`, flush to get id.
- Email is stored **lowercased in full** (`str(body.customer_email).lower()`).
- For each line: look up chocolate; unknown → `400 {"detail":"Unknown chocolate <id>"}`;
  out of stock → `400 {"detail":"<name> is out of stock"}`. Accumulate
  `line_total = price_cents * quantity`, add `OrderItem(unit_price_cents=price_cents)`.
- Set `order.total_cents = total`, commit, return `{order_id, total_cents}`.

**`health`** — independent DB (`SELECT 1`) and Redis (`PING`) checks, each guarded so a failure
of one does not crash the endpoint; returns the three booleans. Always `200`.

### 1.4 Data model & schema (`backend/app/models/chocolate.py`)

Three tables created from SQLAlchemy models (no migrations — DB is recreated each startup):
- `chocolates(id uuid pk, name varchar(200), slug varchar(200) unique, description text,
  origin varchar(120) null, cacao_percentage int null, price_cents int, image_url varchar(2000),
  tags varchar(64)[] default '{}', in_stock bool default true, created_at timestamptz default now())`
- `orders(id uuid pk, customer_name varchar(200), customer_email varchar(320),
  total_cents int, status varchar(32) default 'paid', created_at timestamptz default now())`
- `order_items(id uuid pk, order_id uuid fk→orders.id ON DELETE CASCADE indexed,
  chocolate_id uuid fk→chocolates.id indexed, quantity int, unit_price_cents int)`

### 1.5 Seed + slug (`backend/app/seed.py`, `backend/app/init_db.py`)

- `SEED`: 14 chocolate dicts (verbatim content must be preserved).
- `slugify`: NFKD-normalize → ASCII → non-alphanumerics to `-` → trim `-` → lowercase → fallback `"chocolate"`.
- `init_db`: create schema, insert all seed rows (`in_stock=True`), print
  `"init_db: created schema and inserted <n> chocolates"`.

### 1.6 Config (`backend/app/config.py`)

- Loads `.env` / `.env.local` from repo root: `DATABASE_URL`, `REDIS_URL`, `CACHE_TTL_SECONDS=60`.
- **Caveat:** `DATABASE_URL` is in SQLAlchemy form `postgresql+asyncpg://...`. The Rust DB driver
  (`sqlx`) needs `postgres://...`. The config layer must strip the `+asyncpg` (and tolerate
  `+psycopg`) driver suffix at load time.

### 1.7 CORS (`backend/app/main.py`)

- Allowed origins: `http://localhost:3000`, `http://127.0.0.1:3000`; credentials allowed; all
  methods and headers allowed.

### 1.8 Tests (must be ported, not deleted)

| File | Coverage to preserve |
|------|----------------------|
| `tests/conftest.py` | Fixture that skips when Postgres/Redis ports are closed |
| `tests/test_health.py` | `/api/health` shape + `ok is True` |
| `tests/test_chocolates_api.py` | list non-empty; tag OR-filter; `price_asc` sorted; detail + `404` |
| `tests/test_checkout_api.py` | success total; unknown → `400`; out-of-stock → `400` (flips `in_stock` via direct SQL) |
| `tests/test_imports.py` | OpenAPI: title contains "chocolate"; `tag` param is `array` with description mentioning "at least one" / "or semantics" |

### 1.9 Integration points (must be updated alongside the rewrite)

- `pyproject.toml` (deps) → `Cargo.toml`.
- `scripts/bootstrap.sh` (venv + pip) → Rust toolchain + `cargo build`.
- `scripts/services-up.sh` (`python -m app.init_db`) → Rust init/seed binary.
- `scripts/dev.sh` (`uvicorn --reload`) → run compiled server (optionally `cargo watch`).
- `Makefile` (`test-backend`, coverage) → `cargo test` / coverage tool.
- `.github/workflows/ci.yml` backend job → Rust setup/build/test.
- `AGENTS.md` / `README.md` / `backend/README.md` docs.

---

## 2. Target Rust stack

| Concern | Python (today) | Rust (proposed) | Why |
|---------|----------------|-----------------|-----|
| HTTP framework | FastAPI / Starlette | **`axum`** | Mature, Tokio-native, integrates with `tower-http` |
| Async runtime | asyncio/uvicorn | **`tokio`** + axum server | Standard async runtime |
| DB | SQLAlchemy async + asyncpg | **`sqlx`** (postgres, uuid, chrono, runtime-tokio) | Async, native `text[]`/UUID/timestamptz support, raw SQL for `&&` |
| Redis | `redis.asyncio` | **`redis`** crate (aio + `ConnectionManager`) | Async, graceful degradation |
| Validation | Pydantic | **`serde`** + **`validator`** (or hand-rolled) | Field constraints + email syntax |
| Email | `EmailStr` (email-validator) | `validator`'s `email` (or `email_address` crate) | Syntactic email validation |
| Config | pydantic-settings | **`dotenvy`** + manual env parse | Reads same `.env` keys |
| Serialization | Pydantic `.model_dump` | **`serde_json`** | JSON encode/decode incl. cache payloads |
| UUID | `uuid` | **`uuid`** (v4) | PK generation |
| Time | `datetime` | **`chrono`** `DateTime<Utc>` | `created_at` |
| Slug | `unicodedata`+`re` | **`unicode-normalization`** + **`regex`** | Exact `slugify` parity |
| OpenAPI | FastAPI auto | **`utoipa`** + `utoipa-swagger`/route | To port `test_imports.py` |
| CORS | Starlette CORS | **`tower-http::cors`** | Same allowed origins/methods/headers |
| Logging | `logging` | **`tracing`** + `tracing-subscriber` | INFO-level logs, warnings on Redis/DB issues |

**Schema creation strategy:** keep the "DB recreated each startup, no migrations" model. Embed
the DDL as an idempotent `CREATE TABLE IF NOT EXISTS …` block executed by the init/seed binary
(mirrors `Base.metadata.create_all`). UUIDs and `created_at`/`tags` defaults are produced exactly
as today (app-side `Uuid::new_v4`, DB-side `now()` / `'{}'`).

---

## 3. Proposed Rust crate layout (replaces `backend/app/`)

```
backend/
  Cargo.toml
  Cargo.lock
  src/
    main.rs              # bin "server": builds axum app, binds BACKEND_PORT
    lib.rs               # exposes build_app(state) for tests + bins
    config.rs            # Settings: DATABASE_URL (normalized), REDIS_URL, CACHE_TTL_SECONDS
    state.rs             # AppState { pool: PgPool, redis, ttl }
    db.rs                # PgPool creation (pool_pre_ping equivalent: test_before_acquire)
    cache.rs             # cache_get / cache_set / ping, graceful on RedisError
    error.rs             # ApiError → JSON {"detail": ...}; 400/404; 422 detail-array shape
    models.rs            # sqlx FromRow row structs (ChocolateRow, ...)
    schemas.rs           # ChocolateOut, CartLineIn, CheckoutIn, CheckoutOut (serde + validation)
    seed.rs              # SEED (14 entries) + slugify
    openapi.rs           # utoipa ApiDoc (title + tag param annotations)
    routes/
      mod.rs
      health.rs
      chocolates.rs      # list + detail, cache + sort + tag overlap
      checkout.rs        # transactional order creation
    bin/
      init_db.rs         # create schema + insert seed (replaces app.init_db)
  tests/
    common/mod.rs        # harness: load env, skip if ports closed, build app, oneshot/reqwest
    health.rs
    chocolates_api.rs
    checkout_api.rs
    openapi.rs
```

The Python `backend/app/`, `backend/tests/`, and `backend/pyproject.toml` are removed in the same
change (this is a replacement, not an addition).

---

## 4. Component-by-component port

1. **Config (`config.rs`)** — read `.env`/`.env.local` from repo root via `dotenvy`; parse
   `DATABASE_URL` (strip `+asyncpg`/`+psycopg`), `REDIS_URL`, `CACHE_TTL_SECONDS` (default `60`).
2. **DB (`db.rs`/`state.rs`)** — `PgPoolOptions` with `test_before_acquire(true)` (≈ `pool_pre_ping`).
3. **Cache (`cache.rs`)** — `ConnectionManager`; `cache_get`→`GET`, `cache_set`→`SETEX`; on any
   `RedisError` log a warning and continue (no caching), matching graceful degradation.
4. **Schemas (`schemas.rs`)** — `serde` structs; `quantity` 1..=99, `customer_name` len 1..=200,
   `items` non-empty, `customer_email` syntactic check. Validation failures map to **`422`** with a
   `{"detail":[{"loc","msg","type"}]}`-shaped body (frontend reads `detail[].msg`).
5. **Errors (`error.rs`)** — `ApiError::BadRequest(String)`→`400 {"detail": msg}`,
   `ApiError::NotFound(String)`→`404 {"detail": msg}`, validation→`422` array. UUID path parse
   failure → `422` (FastAPI parity).
6. **Chocolates routes** — reproduce cache-key builder, tag normalization, `&&` overlap query
   (`WHERE tags && $1::varchar[]`), sort branches with secondary `name ASC`, JSON cache payloads.
7. **Checkout route** — `sqlx` transaction; whitespace-name 400; lowercase full email; per-line
   unknown/out-of-stock 400s; compute total; commit; return ids.
8. **Health route** — independent guarded `SELECT 1` and Redis `PING`; always `200`.
9. **Seed + init_db bin** — port `SEED` verbatim and `slugify`; create schema (DDL) + insert rows;
   print the same summary line.
10. **OpenAPI (`openapi.rs`)** — `utoipa` doc with title containing "chocolate" and the
    `tag` query parameter typed as `array` with description text including "OR semantics" and
    "at least one" (verbatim from current `Query` description) so the ported test passes.
11. **App assembly (`main.rs`/`lib.rs`)** — `tower-http` CORS (same origins/methods/headers),
    mount routes at identical paths, bind `BACKEND_PORT` (default `8000`).

---

## 5. Test migration (coverage stays intact)

Each Python test is ported to a Rust integration test under `backend/tests/`, asserting the same
behavior against the running axum app (via `tower::ServiceExt::oneshot` or a bound test server +
`reqwest`):

- `common/mod.rs` — reproduce the `conftest.py` guard: **skip** (not fail) when `55432`/`63790`
  are unreachable; set default `DATABASE_URL`/`REDIS_URL` if unset.
- `health.rs` ← `test_health.py` — shape + `ok == true`.
- `chocolates_api.rs` ← `test_chocolates_api.py` — list non-empty; tag OR-filter; `price_asc`
  monotonic; detail + random-UUID `404`.
- `checkout_api.rs` ← `test_checkout_api.py` — success `total_cents == price*qty`; unknown id →
  `400` ("unknown"); out-of-stock → `400` ("stock"), flipping `in_stock` via direct `sqlx` SQL and
  restoring it in teardown.
- `openapi.rs` ← `test_imports.py` — assert the `utoipa` JSON has title containing "chocolate" and
  the `tag` param is `array` with the required description phrases.

**Coverage tooling:** `make test-backend-coverage` repointed to `cargo llvm-cov`
(`cargo-llvm-cov`) producing terminal + HTML reports, mirroring the current pytest-cov output.

---

## 6. Infra / glue changes

- **`scripts/bootstrap.sh`** — replace venv/pip steps with: ensure `rustup`/`cargo` present
  (install via rustup if missing), run `cargo build` (and `cargo build --bin init_db`). Keep all
  Postgres/Redis/`.env` bootstrap untouched. Frontend steps unchanged.
- **`scripts/services-up.sh`** — replace `.venv/bin/python -m app.init_db` with the compiled
  init binary (e.g. `backend/target/debug/init_db` or `cargo run --bin init_db`). DB drop/create
  and Redis `FLUSHALL` unchanged.
- **`scripts/dev.sh`** — replace `uvicorn --reload` with running the server binary; use
  `cargo watch -x run` for reload parity (or document its absence). Frontend command unchanged.
- **`Makefile`** — `test-backend` → `cd backend && cargo test`; coverage → `cargo llvm-cov`;
  keep `psql`, `redis-cli`, `services-*`, `stop`, `nuke` as-is.
- **`.github/workflows/ci.yml`** — backend job: swap `setup-python`/pip for a Rust toolchain
  action + cargo cache; build; run init binary; `make test-backend`. Postgres/Redis service
  containers and env vars unchanged. Frontend job untouched.
- **Docs** — update `AGENTS.md` (services table footnote, test/lint commands), `README.md`, and
  `backend/README.md` to describe the Rust backend and `cargo` workflows.

---

## 7. Behavioral parity risks & decisions

- **`422` validation body:** Pydantic emits a specific `detail` array. The frontend only reads
  `detail[].msg`, and no backend test asserts the exact array. Decision: emit a compatible
  `{"detail":[{"loc","msg","type"}]}` shape; do not attempt byte-for-byte Pydantic parity.
- **`created_at` formatting:** Pydantic renders `+00:00`; `chrono`/serde renders `Z`. Both are
  valid ISO-8601 and the frontend treats it as an opaque string. Decision: accept the `Z` form
  (document it); switch to a custom serializer only if a consumer needs `+00:00`.
- **Email validation strictness:** `EmailStr` (email-validator) vs. a Rust email crate may differ
  on exotic edge cases. Decision: choose a well-maintained crate; the only DB-visible behavior is
  full-string lowercasing, which is reproduced exactly.
- **`pool_pre_ping`:** mapped to sqlx `test_before_acquire(true)`.
- **`--reload` dev ergonomics:** native Rust has no built-in reload; `cargo watch` provides it but
  adds a dev dependency. Decision: use `cargo watch` if available, else plain run (documented).
- **Tag filter case sensitivity:** preserved as case-sensitive (matches current `varchar(64)`
  literal overlap); seed tags are already lowercase so existing tests stay green.

---

## 8. Out of scope (explicitly unchanged)

- The frontend (`frontend/`) and its tests.
- Public API paths, payloads, status codes, and the DB schema/seed content.
- Ports (`8000`/`55432`/`63790`), `.env` keys, and the Postgres/Redis service management scripts'
  data-store behavior.
- No new endpoints, fields, query params, or features are introduced.

---

## 9. Suggested execution order (one PR or a short stacked series)

1. Scaffold crate (`Cargo.toml`, `lib.rs`, `config.rs`, `db.rs`, `cache.rs`, `state.rs`).
2. Port models, schemas, errors, seed/slugify + `init_db` bin; verify schema + seed against a live
   Postgres.
3. Port routes (health → chocolates → checkout) and assemble the app with CORS + OpenAPI.
4. Port all integration tests; run `make services-up && make test-backend` until green.
5. Update scripts, `Makefile`, CI, and docs; run the full stack via `make dev` and smoke-test the
   frontend against the Rust backend.
6. Remove the Python `backend/app`, `backend/tests`, `pyproject.toml`; final green CI.

---

## Open questions for sign-off

1. **ORM vs. raw SQL:** proceed with `sqlx` + raw SQL (recommended for the `&&` overlap + simple
   schema), or prefer `SeaORM` for a closer ORM analogue to SQLAlchemy?
2. **Single PR vs. stacked:** land the whole migration in one PR, or split scaffold/routes/tests/
   infra into a short stack?
3. **`created_at` format:** is the `Z` suffix acceptable, or must we match Pydantic's `+00:00`?
4. **Dev reload:** OK to add `cargo watch` as a dev tool for `make dev` reload parity?

Once these are confirmed, I'll proceed with the implementation following the order in §9.
