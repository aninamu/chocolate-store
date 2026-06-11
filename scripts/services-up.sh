#!/usr/bin/env bash
# Start user-level MongoDB + Redis, then wipe the app database and load seed data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
source "$ROOT/scripts/mongo-path.sh"

add_mongo_bin_to_path

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
else
  echo "error: .env missing. Run: make setup" >&2
  exit 1
fi

: "${MONGO_PORT:=27018}"
: "${MONGO_DB:=chocolate_store}"
: "${REDIS_PORT:=63790}"

mkdir -p .data/mongo .data/redis logs

_mongo_running() {
  if [ -f .data/mongo/mongod.pid ]; then
    pid="$(cat .data/mongo/mongod.pid 2>/dev/null || true)"
    if [ -n "${pid}" ] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

# ---- MongoDB
if ! _mongo_running; then
  rm -f .data/mongo/mongod.lock 2>/dev/null || true
  mongod --dbpath .data/mongo --port "$MONGO_PORT" --bind_ip 127.0.0.1 \
    --logpath "$ROOT/logs/mongo.log" --pidfilepath .data/mongo/mongod.pid --fork
fi
until mongosh --quiet "mongodb://127.0.0.1:$MONGO_PORT/admin" --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1; do
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

# ---- Fresh app DB every startup (no migrations; documents come from Beanie models)
mongosh --quiet "mongodb://127.0.0.1:$MONGO_PORT/$MONGO_DB" \
  --eval "db.dropDatabase()" >/dev/null

# Flush stale cache entries that reference chocolates from a previous run
redis-cli -p "$REDIS_PORT" FLUSHALL >/dev/null

# Insert seed rows
( cd "$ROOT/backend" && .venv/bin/python -m app.init_db )

echo "services-up: ok"
