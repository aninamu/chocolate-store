# Migrating `scripts/` from Python to Rust

Cloud agents cannot edit `scripts/bootstrap.sh`, `scripts/services-up.sh`, or `scripts/dev.sh` under admin policy. Apply the changes below locally (or grant script access) so `make dev` uses the Rust backend.

## `scripts/bootstrap.sh`

**Remove** the Python version check block (lines that require `python3` and warn on version).

**Replace** the backend venv / pip block:

```bash
# Backend venv
if [ ! -d backend/.venv ]; then
  echo "Creating Python venv in backend/.venv…"
  python3 -m venv backend/.venv
fi
backend/.venv/bin/pip install -q -U pip
backend/.venv/bin/pip install -q -e "backend[dev]"
```

**With:**

```bash
# Rust backend (fetch deps when cargo is available)
if command -v cargo >/dev/null 2>&1; then
  ( cd backend && cargo fetch -q ) || true
else
  echo "warning: cargo not found; install Rust (https://rustup.rs) for the API." >&2
fi
```

Update the file header comment from “Python venv” to “Rust cargo fetch”.

## `scripts/services-up.sh`

**Replace** the init_db invocation at the end:

```bash
# Create schema from models and insert seed rows
( cd "$ROOT/backend" && .venv/bin/python -m app.init_db )
```

**With:**

```bash
# Create schema and insert seed rows (Rust)
( cd "$ROOT/backend" && cargo run --release --bin init_db )
```

Optionally update the top comment: “SQLAlchemy models” → “Rust `init_db` binary”.

## `scripts/dev.sh`

**Replace** the backend process line:

```bash
( cd "$ROOT/backend" && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT" 2>&1 | while IFS= read -r line; do echo "[backend]  $line"; done ) &
```

**With:**

```bash
( cd "$ROOT/backend" && cargo run --release --bin server 2>&1 | while IFS= read -r line; do echo "[backend]  $line"; done ) &
```

Update the header comment from `uvicorn --reload` to `cargo run --bin server`.

For faster iteration during development you may use `cargo run --bin server` without `--release` (debug build).

## Prerequisites

- Install **Rust** (`rustup`) instead of Python 3.12 venv for the API.
- Keep Postgres 16 and Redis 7 unchanged.
