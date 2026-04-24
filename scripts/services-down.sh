#!/usr/bin/env bash
# Stop user-level Postgres and Redis for this project.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 0

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

add_postgres_bin_to_path

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${PG_PORT:=55432}"
: "${PG_USER:=chocolate}"
: "${PG_DB:=chocolate_store}"
: "${REDIS_PORT:=63790}"

# Drop the app DB so nothing persists between runs (demo app).
if [ -d .data/postgres ] && pg_ctl -D .data/postgres status >/dev/null 2>&1; then
  psql -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$PG_DB\";" >/dev/null 2>&1 || true
fi

if [ -d .data/postgres ]; then
  pg_ctl -D .data/postgres stop -m fast >/dev/null 2>&1 || true
fi

if command -v redis-cli >/dev/null 2>&1; then
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
fi
rm -f .data/redis/redis.pid 2>/dev/null || true

echo "services-down: ok"
