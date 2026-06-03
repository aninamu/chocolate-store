# chocolate-store API (Rust)

Run from the repository root: `make dev` (not stand-alone). The API is an **axum** service built with **cargo** (`backend/Cargo.toml`).

Environment variables are loaded from the repo root `.env` (see `../.env.example`). `DATABASE_URL` may use either `postgresql://` or the legacy `postgresql+asyncpg://` form (normalized at startup).

## Binaries

| Binary | Purpose |
|--------|---------|
| `server` | HTTP API on `BACKEND_PORT` (default **8000**) |
| `init_db` | Create tables and insert seed catalog ([`src/seed.rs`](./src/seed.rs)) |

## Tests

From the repo root, after Postgres/Redis are up (`make services-up`):

```bash
make test-backend
make test-backend-coverage
```

Or from `backend/`: `cargo test`. Integration tests skip automatically if ports **55432** / **63790** are not reachable.

## Local build

```bash
cd backend
cargo build --release
cargo run --bin init_db
cargo run --bin server
```
