# Agents

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 55432 | Stores chocolates catalog, orders |
| Redis 7 | 63790 | Server-side response caching |
| FastAPI backend (uvicorn) | 8000 | REST API (`/api/chocolates`, `/api/checkout`, `/api/health`) |
| Next.js frontend | 3000 | React UI with App Router |

### Starting the full stack

```bash
make services-up   # Start Postgres + Redis, recreate DB, seed 14 chocolates
# Then in a background tmux session:
source .env
export NEXT_PUBLIC_API_URL="http://127.0.0.1:${BACKEND_PORT:-8000}"
cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port ${BACKEND_PORT:-8000} &
cd frontend && npm run dev -- -p ${FRONTEND_PORT:-3000} &
```

Or use `make dev` which runs bootstrap + services + both servers (blocks on `wait`; Ctrl-C stops everything including data stores).

### Important caveats

- **Database is ephemeral**: `services-up.sh` drops and recreates `chocolate_store` on every invocation. No migrations exist — schema comes from SQLAlchemy models via `backend/app/init_db.py`.
- **Postgres binaries**: On Ubuntu, Postgres 16 tools live at `/usr/lib/postgresql/16/bin/`. The project's `scripts/postgres-path.sh` adds this to PATH automatically inside the shell scripts. If running `pg_ctl` or `psql` manually, prepend that path or run `export PATH="/usr/lib/postgresql/16/bin:$PATH"`.
- **Redis PID file**: If Redis doesn't start cleanly, remove `.data/redis/redis.pid` before retrying `make services-up`.
- **Frontend env**: `NEXT_PUBLIC_API_URL` must be exported before `next dev` starts — it's baked at compile time for client components.

### Running tests

- Backend: `make test-backend` (requires services running on ports 55432 + 63790).
- Frontend: `make test-frontend` (no services needed — unit tests only).
- Lint: `cd frontend && npx eslint .`

### Stopping

- `make services-down` stops only Postgres + Redis.
- `make stop` also kills anything on the app ports.
