#!/usr/bin/env bash
# Stop user-level MongoDB, Redis, and optional Postgres for this project.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 0

# shellcheck source=/dev/null
source "$ROOT/scripts/postgres-path.sh"

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${REDIS_PORT:=63790}"
: "${MONGO_PORT:=27017}"
: "${PG_PORT:=55432}"
: "${PG_USER:=chocolate}"
: "${PG_DB:=chocolate_store}"

# Redis
if command -v redis-cli >/dev/null 2>&1; then
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
fi
rm -f .data/redis/redis.pid 2>/dev/null || true

# Mongo via Docker container
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    docker stop chocolate-store-mongo >/dev/null 2>&1 || true
  elif sudo docker info >/dev/null 2>&1; then
    sudo docker stop chocolate-store-mongo >/dev/null 2>&1 || true
  fi
fi
# Local mongod
if pgrep -x mongod >/dev/null 2>&1; then
  if command -v mongosh >/dev/null 2>&1; then
    mongosh --port "$MONGO_PORT" --eval 'db.adminCommand({ shutdown: 1 })' >/dev/null 2>&1 || true
  else
    pkill -x mongod >/dev/null 2>&1 || true
  fi
fi

# Optional Postgres
add_postgres_bin_to_path 2>/dev/null || true
if [ -d .data/postgres ] && command -v pg_ctl >/dev/null 2>&1; then
  if pg_ctl -D .data/postgres status >/dev/null 2>&1; then
    psql -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d postgres \
      -c "DROP DATABASE IF EXISTS \"$PG_DB\";" >/dev/null 2>&1 || true
    pg_ctl -D .data/postgres stop -m fast >/dev/null 2>&1 || true
  fi
fi

echo "services-down: ok"
