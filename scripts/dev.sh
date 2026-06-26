#!/usr/bin/env bash
# Run backend (cargo watch/run) and frontend (next dev) in parallel.
# On exit (Ctrl-C), stop app processes and run services-down.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=/dev/null
[ -f .env ] && set -a && source .env && set +a
: "${BACKEND_PORT:=8000}"
: "${FRONTEND_PORT:=3000}"

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://127.0.0.1:$BACKEND_PORT}"

mkdir -p logs

cleanup() {
  # shellcheck disable=SC2317
  trap - EXIT INT TERM
  kill 0 2>/dev/null || true
  "$ROOT/scripts/services-down.sh" || true
}
trap cleanup EXIT INT TERM

# Pipe logs with simple prefixes (portable on macOS)
if command -v cargo-watch >/dev/null 2>&1; then
  ( cd "$ROOT/backend" && cargo watch -q -x "run --bin chocolate-store-api" 2>&1 | while IFS= read -r line; do echo "[backend]  $line"; done ) &
else
  ( cd "$ROOT/backend" && cargo run --bin chocolate-store-api 2>&1 | while IFS= read -r line; do echo "[backend]  $line"; done ) &
fi
( cd "$ROOT/frontend" && npm run dev -- -p "$FRONTEND_PORT" 2>&1 | while IFS= read -r line; do echo "[frontend] $line"; done ) &

wait
