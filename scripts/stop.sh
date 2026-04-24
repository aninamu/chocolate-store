#!/usr/bin/env bash
# Teardown: stop data stores, then free backend/frontend ports.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
[ -f .env ] && set -a && source .env && set +a

: "${BACKEND_PORT:=8000}"
: "${FRONTEND_PORT:=3000}"
: "${PG_PORT:=55432}"
: "${REDIS_PORT:=63790}"

"$ROOT/scripts/services-down.sh" || true

for port in "$BACKEND_PORT" "$FRONTEND_PORT" "$PG_PORT" "$REDIS_PORT"; do
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | tr ' ' '\n' | while read -r p; do
      [ -n "$p" ] && kill -9 "$p" 2>/dev/null || true
    done
  fi
done

echo "stop: ok"
