#!/usr/bin/env bash
# Idempotent: prerequisites, Python venv, npm deps, .env, initdb cluster if missing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PGPORT="${PG_PORT:-55432}"
export PGUSER="${PG_USER:-chocolate}"

add_postgres_bin_to_path() {
  local brew_prefix=""

  if command -v brew >/dev/null 2>&1; then
    brew_prefix="$(brew --prefix postgresql@16 2>/dev/null || true)"
    if [ -d "$brew_prefix/bin" ]; then
      export PATH="$brew_prefix/bin:$PATH"
      return
    fi
  fi

  if [ -d /usr/lib/postgresql/16/bin ]; then
    export PATH="/usr/lib/postgresql/16/bin:$PATH"
  fi
}

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

# Python
python_ver="$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))' 2>/dev/null || echo 0)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required (3.12+ recommended)." >&2
  exit 1
fi
if awk -v v="$python_ver" 'BEGIN{exit (v+0 < 3.10)}' 2>/dev/null; then
  : # ok
else
  echo "warning: Python $python_ver found; 3.12+ recommended." >&2
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

# Backend venv
if [ ! -d backend/.venv ]; then
  echo "Creating Python venv in backend/.venv…"
  python3 -m venv backend/.venv
fi
backend/.venv/bin/pip install -q -U pip
backend/.venv/bin/pip install -q -e "backend[dev]"

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

echo "bootstrap: ok"
