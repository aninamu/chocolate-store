#!/usr/bin/env bash
# Start user-level MongoDB + Redis, drop/recreate app collections via init_db and seed.
# No migrations — data under ./.data/ is disposable.
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

mkdir -p .data/mongodb .data/redis logs

_mongo_running() {
  local pidfile="$ROOT/.data/mongodb/mongod.pid"
  [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null
}

# ---- MongoDB
if ! _mongo_running; then
  rm -f "$ROOT/.data/mongodb/mongod.pid" 2>/dev/null || true
  mongod --dbpath "$ROOT/.data/mongodb" \
    --bind_ip 127.0.0.1 \
    --port "$MONGO_PORT" \
    --pidfilepath "$ROOT/.data/mongodb/mongod.pid" \
    --logpath "$ROOT/logs/mongodb.log" \
    --fork
fi

wait_mongo() {
  (
    cd "$ROOT/backend"
    .venv/bin/python - <<'PY'
import os
import sys
import time

from pymongo import MongoClient

url = os.environ.get("MONGODB_URL", "")
if not url:
    sys.stderr.write("error: MONGODB_URL not set\n")
    sys.exit(1)

for _ in range(75):
    try:
        MongoClient(url, serverSelectionTimeoutMS=400).admin.command("ping")
        sys.exit(0)
    except Exception:
        time.sleep(0.2)
sys.exit(1)
PY
  )
}

export MONGODB_URL="${MONGODB_URL:-mongodb://127.0.0.1:${MONGO_PORT}}"
export MONGO_DB="${MONGO_DB}"

if ! wait_mongo; then
  echo "error: MongoDB did not become ready on ${MONGODB_URL}" >&2
  exit 1
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

# Flush stale cache entries that reference chocolates from a previous run
redis-cli -p "$REDIS_PORT" FLUSHALL >/dev/null

# Drop DB / indexes / seed (Motor/PyMongo client inside init_db)
( cd "$ROOT/backend" && .venv/bin/python -m app.init_db )

echo "services-up: ok"
