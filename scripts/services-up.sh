#!/usr/bin/env bash
# Start user-level Redis + MongoDB (Docker), then (re)create a fresh app
# database from Beanie models and load seed data.
#
# Optional cutover support: set ENABLE_POSTGRES=1 to also start Postgres
# (needed for dual-write / backfill / reconcile during migration).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
source "$ROOT/scripts/postgres-path.sh"

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
else
  echo "error: .env missing. Run: make setup" >&2
  exit 1
fi

: "${REDIS_PORT:=63790}"
: "${MONGO_PORT:=27017}"
: "${MONGO_DB:=chocolate_store}"
: "${ENABLE_POSTGRES:=0}"
: "${PG_PORT:=55432}"
: "${PG_USER:=chocolate}"
: "${PG_DB:=chocolate_store}"
: "${PERSIST_DATA:=0}"

mkdir -p .data/redis .data/mongo logs

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

# ---- MongoDB (Docker; falls back to local mongod if present)
DOCKER_CMD=(docker)

ensure_dockerd() {
  if docker info >/dev/null 2>&1; then
    DOCKER_CMD=(docker)
    return 0
  fi
  if sudo docker info >/dev/null 2>&1; then
    DOCKER_CMD=(sudo docker)
    return 0
  fi
  if ! command -v dockerd >/dev/null 2>&1; then
    return 1
  fi
  # Best-effort start for environments without systemd.
  if ! pgrep -x dockerd >/dev/null 2>&1; then
    (sudo dockerd --storage-driver=vfs >/tmp/dockerd.log 2>&1 || dockerd --storage-driver=vfs >/tmp/dockerd.log 2>&1) &
    sleep 3
  fi
  if docker info >/dev/null 2>&1; then
    DOCKER_CMD=(docker)
    return 0
  fi
  if sudo docker info >/dev/null 2>&1; then
    DOCKER_CMD=(sudo docker)
    return 0
  fi
  return 1
}

start_mongo_docker() {
  local name="chocolate-store-mongo"
  if "${DOCKER_CMD[@]}" ps --format '{{.Names}}' | grep -qx "$name"; then
    return 0
  fi
  if "${DOCKER_CMD[@]}" ps -a --format '{{.Names}}' | grep -qx "$name"; then
    "${DOCKER_CMD[@]}" start "$name" >/dev/null
    return 0
  fi
  "${DOCKER_CMD[@]}" run -d --name "$name" \
    -p "127.0.0.1:${MONGO_PORT}:27017" \
    -v "$ROOT/.data/mongo:/data/db" \
    mongo:7 >/dev/null
}

if command -v mongod >/dev/null 2>&1 && [ "${USE_DOCKER_MONGO:-0}" != "1" ]; then
  if ! pgrep -x mongod >/dev/null 2>&1; then
    mongod --dbpath "$ROOT/.data/mongo" --port "$MONGO_PORT" --bind_ip 127.0.0.1 \
      --fork --logpath "$ROOT/logs/mongo.log"
  fi
elif ensure_dockerd; then
  start_mongo_docker
else
  echo "error: neither mongod nor docker is available to run MongoDB" >&2
  exit 1
fi

# Wait for Mongo
python3 - <<PY
import socket, time, sys
port = int("${MONGO_PORT}")
for _ in range(50):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            sys.exit(0)
    except OSError:
        time.sleep(0.2)
sys.exit(1)
PY

# Flush stale cache
redis-cli -p "$REDIS_PORT" FLUSHALL >/dev/null

# Fresh Mongo DB unless PERSIST_DATA=1
if [ "$PERSIST_DATA" != "1" ]; then
  ( cd "$ROOT/backend" && .venv/bin/python - <<'PY'
import asyncio
from app.mongo import get_mongo_client, close_mongo
from app.config import settings

async def drop():
    client = get_mongo_client()
    db = client.get_default_database()
    if db is None:
        db = client["chocolate_store"]
    await client.drop_database(db.name)
    await close_mongo()
    print(f"services-up: dropped mongo database {db.name}")

asyncio.run(drop())
PY
  )
fi

( cd "$ROOT/backend" && .venv/bin/python -m app.init_mongo )

# ---- Optional Postgres for cutover tooling
if [ "$ENABLE_POSTGRES" = "1" ]; then
  add_postgres_bin_to_path
  : "${PG_PORT:=55432}"
  : "${PG_USER:=chocolate}"
  : "${PG_DB:=chocolate_store}"
  : "${DATABASE_URL:=postgresql+asyncpg://${PG_USER}@127.0.0.1:${PG_PORT}/${PG_DB}}"
  export DATABASE_URL
  export PGPORT="$PG_PORT"
  export PGUSER="$PG_USER"
  export PGPASSWORD="${PGPASSWORD:-}"
  mkdir -p .data/postgres
  if [ ! -s .data/postgres/PG_VERSION ]; then
    initdb -D .data/postgres -U "$PG_USER" --auth=trust --encoding=UTF8
  fi
  PG_SOCKET_DIR="$ROOT/.data/postgres"
  if ! pg_ctl -D .data/postgres status >/dev/null 2>&1; then
    pg_ctl -D .data/postgres -l logs/postgres.log \
      -o "-p $PG_PORT -h 127.0.0.1 -k \"$PG_SOCKET_DIR\"" start
  fi
  until pg_isready -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -q 2>/dev/null; do
    sleep 0.2
  done
  if [ "$PERSIST_DATA" != "1" ]; then
    psql -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 \
      -c "DROP DATABASE IF EXISTS \"$PG_DB\";" \
      -c "CREATE DATABASE \"$PG_DB\";"
    ( cd "$ROOT/backend" && DATABASE_URL="$DATABASE_URL" .venv/bin/python -m app.init_db )
  fi
  echo "services-up: postgres enabled for cutover"
fi

echo "services-up: ok"
