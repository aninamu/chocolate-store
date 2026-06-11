#!/usr/bin/env bash
# Stop user-level MongoDB and Redis for this project.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 0

# shellcheck source=/dev/null
source "$ROOT/scripts/mongo-path.sh"

add_mongo_bin_to_path

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${MONGO_PORT:=27018}"
: "${MONGO_DB:=chocolate_store}"
: "${REDIS_PORT:=63790}"

# Drop the app DB so nothing persists between runs (demo app).
if [ -d .data/mongo ]; then
  mongosh --quiet "mongodb://127.0.0.1:$MONGO_PORT/$MONGO_DB" \
    --eval "db.dropDatabase()" >/dev/null 2>&1 || true
  mongod --dbpath .data/mongo --shutdown >/dev/null 2>&1 || true
  rm -f .data/mongo/mongod.pid 2>/dev/null || true
fi

if command -v redis-cli >/dev/null 2>&1; then
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
fi
rm -f .data/redis/redis.pid 2>/dev/null || true

echo "services-down: ok"
