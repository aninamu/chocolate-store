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

if [ -f .data/mongo/mongod.pid ] 2>/dev/null; then
  pid="$(cat .data/mongo/mongod.pid 2>/dev/null || true)"
  if [ -n "${pid}" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 0.5
  fi
  rm -f .data/mongo/mongod.pid
fi

if command -v redis-cli >/dev/null 2>&1; then
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
fi
rm -f .data/redis/redis.pid 2>/dev/null || true

echo "services-down: ok"
