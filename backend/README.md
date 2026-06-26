# chocolate-store API

Run from the repository root: `make dev` (not stand-alone). The backend is a Rust crate built by `make setup`.

Environment variables are loaded from the repo root `.env` (see `../.env.example`).

## Tests

From the repo root, after `make setup` and with Postgres/Redis up (`make services-up`):

```bash
make test-backend
```

Or from `backend/`: `cargo test`.

## Init DB

Schema and seed data are loaded on every `make services-up`:

```bash
cargo run --bin init_db
```
