#!/usr/bin/env bash
# Stop user-level MongoDB and Redis for this project.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 0

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${MONGO_PORT:=57017}"
: "${MONGO_DB:=chocolate_store}"
: "${REDIS_PORT:=63790}"

# Drop the app database so nothing persists between runs (demo app).
if command -v mongosh >/dev/null 2>&1; then
  mongosh --port "$MONGO_PORT" --quiet --eval \
    "db.getSiblingDB('$MONGO_DB').dropDatabase()" >/dev/null 2>&1 || true
fi

if [ -f .data/mongo/mongod.pid ] 2>/dev/null; then
  pid="$(cat .data/mongo/mongod.pid 2>/dev/null || true)"
  if [ -n "${pid}" ] && kill -0 "$pid" 2>/dev/null; then
    mongosh --port "$MONGO_PORT" admin --quiet --eval "db.shutdownServer()" \
      >/dev/null 2>&1 || kill "$pid" 2>/dev/null || true
  fi
  rm -f .data/mongo/mongod.pid 2>/dev/null || true
fi

if command -v redis-cli >/dev/null 2>&1; then
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
fi
rm -f .data/redis/redis.pid 2>/dev/null || true

echo "services-down: ok"
