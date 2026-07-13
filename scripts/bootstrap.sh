#!/usr/bin/env bash
# Idempotent: prerequisites, Python venv, npm deps, .env, data dirs.
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
    exit 1
  fi
}

# Python
if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required (3.12+ recommended)." >&2
  exit 1
fi

# Node
if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required (20+). Install: https://nodejs.org/" >&2
  exit 1
fi

need_cmd redis-server
need_cmd redis-cli

# Mongo: prefer local mongod, otherwise docker
if ! command -v mongod >/dev/null 2>&1 && ! command -v docker >/dev/null 2>&1; then
  echo "error: need either 'mongod' or 'docker' to run MongoDB." >&2
  echo "  Install MongoDB Community, or: sudo apt-get install docker.io" >&2
  exit 1
fi

# Optional Postgres tools (only required when ENABLE_POSTGRES=1)
if [ "${ENABLE_POSTGRES:-0}" = "1" ]; then
  add_postgres_bin_to_path
  need_cmd initdb
  need_cmd pg_ctl
  need_cmd psql
fi

# .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example (edit if you change ports)."
fi
set -a
# shellcheck source=/dev/null
source .env
set +a

# Backend venv
if [ ! -d backend/.venv ]; then
  echo "Creating Python venv in backend/.venv…"
  python3 -m venv backend/.venv
fi
backend/.venv/bin/pip install -q -U pip
backend/.venv/bin/pip install -q -e "backend[dev]"

# Frontend deps
if [ -f frontend/package.json ]; then
  ( cd frontend && npm install --no-audit --no-fund )
fi

mkdir -p .data/mongo .data/redis logs
if [ "${ENABLE_POSTGRES:-0}" = "1" ]; then
  mkdir -p .data/postgres
  add_postgres_bin_to_path
  : "${PG_USER:=chocolate}"
  if [ ! -s .data/postgres/PG_VERSION ]; then
    echo "Initializing local Postgres cluster in .data/postgres (user: $PG_USER)…"
    initdb -D .data/postgres -U "$PG_USER" --auth=trust --encoding=UTF8
  fi
fi

echo "bootstrap: ok"
