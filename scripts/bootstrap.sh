#!/usr/bin/env bash
# Idempotent: prerequisites, Rust backend deps, npm deps, .env, initdb cluster if missing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PGPORT="${PG_PORT:-55432}"
export PGUSER="${PG_USER:-chocolate}"

# shellcheck source=/dev/null
source "$ROOT/scripts/postgres-path.sh"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: '$1' not found in PATH." >&2
    echo "  Install Postgres 16:  brew install postgresql@16  # macOS" >&2
    echo "  Install Postgres 16:  sudo apt-get install postgresql  # Ubuntu" >&2
    echo "  Install Redis:        brew install redis  # macOS" >&2
    echo "  Install Redis:        sudo apt-get install redis-server  # Ubuntu" >&2
    exit 1
  fi
}

add_postgres_bin_to_path

if ! command -v cargo >/dev/null 2>&1; then
  echo "error: cargo is required (install Rust via https://rustup.rs)." >&2
  exit 1
fi

# Node
if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required (20+). Install: https://nodejs.org/" >&2
  exit 1
fi

need_cmd initdb
need_cmd pg_ctl
need_cmd psql
need_cmd createdb
need_cmd redis-server
need_cmd redis-cli

# .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example (edit if you change ports)."
fi
set -a
# shellcheck source=/dev/null
source .env
set +a

# Rust backend
( cd backend && cargo fetch -q )

# Frontend deps (after frontend/ exists)
if [ -f frontend/package.json ]; then
  ( cd frontend && npm install --no-audit --no-fund )
fi

# Postgres data dir
mkdir -p .data/postgres .data/redis logs
if [ ! -s .data/postgres/PG_VERSION ]; then
  echo "Initializing local Postgres cluster in .data/postgres (user: $PG_USER)…"
  initdb -D .data/postgres -U "$PG_USER" --auth=trust --encoding=UTF8
fi
