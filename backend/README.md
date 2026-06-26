# chocolate-store API (Rust / Axum)

Run from the repository root: `make dev` (not stand-alone). Bootstrap runs `cargo fetch` in this directory via `make setup`.

Environment variables are loaded from the repo root `.env` (see `../.env.example`).

## Tests

From the repo root, after `make setup` and with Postgres/Redis up (`make services-up`):

```bash
make test-backend
make test-backend-coverage   # requires `cargo install cargo-llvm-cov`; writes backend/coverage/
```

Or from `backend/`:

```bash
cargo test
```

Integration tests skip automatically when Postgres (**55432**) and Redis (**63790**) are not reachable.

## Binaries

| Binary | Purpose |
|--------|---------|
| `chocolate-store-api` | HTTP server on `BACKEND_PORT` (default 8000) |
| `init-db` | Create schema from `src/schema.sql` and load `src/seed.rs` |
