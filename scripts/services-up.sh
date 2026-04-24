#!/usr/bin/env bash
# Start user-level Postgres + Redis, then migrate and seed the database.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -d "$(brew --prefix postgresql@16 2>/dev/null)/bin" ]; then
  export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
fi

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

if ! pg_ctl -D .data/postgres status >/dev/null 2>&1; then
  pg_ctl -D .data/postgres -l logs/postgres.log \
    -o "-p $PG_PORT -h 127.0.0.1" start
fi
until pg_isready -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -q 2>/dev/null; do
  sleep 0.2
done

if ! psql -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$PG_DB'" | grep -q 1; then
  createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$PG_DB"
fi

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

# ---- Alembic + seed
(
  cd "$ROOT/backend"
  .venv/bin/alembic upgrade head
  .venv/bin/python -m app.seed
)

echo "services-up: ok"
