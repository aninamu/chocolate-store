#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -d "$(brew --prefix postgresql@16 2>/dev/null)/bin" ]; then
  export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
fi

# shellcheck source=/dev/null
[ -f .env ] && set -a && source .env && set +a
: "${PG_PORT:=55432}" "${PG_USER:=chocolate}" "${PG_DB:=chocolate_store}"

./scripts/services-up.sh

psql -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

( cd backend && .venv/bin/alembic upgrade head && .venv/bin/python -m app.seed )
echo "reset-db: ok"
