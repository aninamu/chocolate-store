#!/usr/bin/env bash
# Start user-level Postgres + Redis, then (re)create a fresh app database from
# SQLAlchemy models and load seed data. No migrations — the DB is disposable.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
source "$ROOT/scripts/postgres-path.sh"

add_postgres_bin_to_path

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
else
  echo "error: .env missing. Run: make setup" >&2
  exit 1
fi

: "${PG_PORT:=55432}"
: "${PG_USER:=chocolate}"
: "${PG_DB:=chocolate_store}"
: "${REDIS_PORT:=63790}"

export PGPORT="$PG_PORT"
export PGUSER="$PG_USER"
export PGPASSWORD="${PGPASSWORD:-}"

mkdir -p .data/postgres .data/redis logs

# ---- Postgres
if [ ! -s .data/postgres/PG_VERSION ]; then
  initdb -D .data/postgres -U "$PG_USER" --auth=trust --encoding=UTF8
fi

PG_SOCKET_DIR="$ROOT/.data/postgres"
if ! pg_ctl -D .data/postgres status >/dev/null 2>&1; then
  # Keep Unix sockets inside the project data dir so unprivileged Linux setups
  # do not need write access to /var/run/postgresql.
  # Use -k . (relative to the data directory) so pg_ctl's whitespace split of -o
  # does not break if $ROOT contains spaces.
  pg_ctl -D .data/postgres -l logs/postgres.log \
    -o "-p $PG_PORT -h 127.0.0.1 -k \"$PG_SOCKET_DIR\"" start
fi
until pg_isready -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -q 2>/dev/null; do
  sleep 0.2
done

# ---- Redis
REDIS_DIR="$ROOT/.data/redis"
if [ -f .data/redis/redis.pid ] 2>/dev/null; then
  pid="$(cat .data/redis/redis.pid 2>/dev/null || true)"
  if [ -n "${pid}" ] && kill -0 "$pid" 2>/dev/null; then
    : # running
  else
    rm -f .data/redis/redis.pid
  fi
fi
if [ ! -f .data/redis/redis.pid ] || ! kill -0 "$(cat .data/redis/redis.pid)" 2>/dev/null; then
  redis-server --daemonize yes --port "$REDIS_PORT" \
    --dir "$REDIS_DIR" --pidfile "$REDIS_DIR/redis.pid" \
    --logfile "$ROOT/logs/redis.log" \
    --save 60 1
fi
until redis-cli -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; do
  sleep 0.1
done

# ---- Fresh app DB every startup (no migrations; schema comes from SQLAlchemy models)
psql -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$PG_DB\";" \
  -c "CREATE DATABASE \"$PG_DB\";"

# Flush stale cache entries that reference chocolates from a previous run
redis-cli -p "$REDIS_PORT" FLUSHALL >/dev/null

# Create schema from models and insert seed rows
( cd "$ROOT/backend" && .venv/bin/python -m app.init_db )

echo "services-up: ok"
