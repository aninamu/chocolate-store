#!/usr/bin/env bash
# Idempotent: prerequisites, Python venv, npm deps, .env, MongoDB data dir.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: '$1' not found in PATH." >&2
    echo "  Install MongoDB:      brew install mongodb-community@7.0  # macOS (tap mongodb/brew)" >&2
    echo "  Install MongoDB:      sudo apt-get install mongodb-org     # Ubuntu (see mongodb.org docs)" >&2
    echo "  Install Redis:        brew install redis                   # macOS" >&2
    echo "  Install Redis:        sudo apt-get install redis-server    # Ubuntu" >&2
    exit 1
  fi
}

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

need_cmd mongod
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

mkdir -p .data/mongodb .data/redis logs

echo "bootstrap: ok"
