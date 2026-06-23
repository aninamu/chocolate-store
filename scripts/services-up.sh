#!/usr/bin/env bash
# Start user-level MongoDB + Redis, then wipe and reseed the app database.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
else
  echo "error: .env missing. Run: make setup" >&2
  exit 1
fi

: "${MONGO_PORT:=57017}"
: "${MONGO_DB:=chocolate_store}"
: "${REDIS_PORT:=63790}"

mkdir -p .data/mongo .data/redis logs

# ---- MongoDB
if [ -f .data/mongo/mongod.pid ] 2>/dev/null; then
  pid="$(cat .data/mongo/mongod.pid 2>/dev/null || true)"
  if [ -n "${pid}" ] && kill -0 "$pid" 2>/dev/null; then
    : # running
  else
    rm -f .data/mongo/mongod.pid
  fi
fi
if [ ! -f .data/mongo/mongod.pid ] || ! kill -0 "$(cat .data/mongo/mongod.pid)" 2>/dev/null; then
  mongod --dbpath .data/mongo --port "$MONGO_PORT" --bind_ip 127.0.0.1 \
    --logpath "$ROOT/logs/mongo.log" --pidfilepath .data/mongo/mongod.pid \
    --fork
fi
until mongosh --quiet --port "$MONGO_PORT" --eval 'db.adminCommand({ ping: 1 })' >/dev/null 2>&1; do
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

# ---- Fresh app DB every startup (no migrations; collections come from init_db)
mongosh --quiet --port "$MONGO_PORT" "$MONGO_DB" --eval 'db.dropDatabase()' >/dev/null

# Flush stale cache entries that reference chocolates from a previous run
redis-cli -p "$REDIS_PORT" FLUSHALL >/dev/null

# Create collections and insert seed rows
( cd "$ROOT/backend" && .venv/bin/python -m app.init_db )

echo "services-up: ok"
