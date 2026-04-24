#!/usr/bin/env bash
# Stop user-level Postgres and Redis for this project.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 0

if [ -d "$(brew --prefix postgresql@16 2>/dev/null)/bin" ]; then
  export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
fi

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

: "${REDIS_PORT:=63790}"

if [ -d .data/postgres ]; then
  pg_ctl -D .data/postgres stop -m fast >/dev/null 2>&1 || true
fi

if command -v redis-cli >/dev/null 2>&1; then
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
fi
rm -f .data/redis/redis.pid 2>/dev/null || true

echo "services-down: ok"
