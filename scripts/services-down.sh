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

: "${REDIS_PORT:=63790}"

if [ -d "$ROOT/.data/mongodb" ]; then
  mongod --dbpath "$ROOT/.data/mongodb" --shutdown >/dev/null 2>&1 || true
fi
rm -f "$ROOT/.data/mongodb/mongod.pid" 2>/dev/null || true

if command -v redis-cli >/dev/null 2>&1; then
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
fi
rm -f .data/redis/redis.pid 2>/dev/null || true

echo "services-down: ok"
