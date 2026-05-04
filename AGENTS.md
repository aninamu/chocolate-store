# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a Chocolate Store demo app with 4 required services:
- **PostgreSQL 16** (port 55432) — user-level, data in `.data/postgres/`
- **Redis 7** (port 63790) — user-level, data in `.data/redis/`
- **FastAPI backend** (port 8000) — `uvicorn --reload`
- **Next.js frontend** (port 3000) — `next dev`

All standard commands (`make dev`, `make test`, `make setup`, etc.) are in the `Makefile` and documented in `README.md`.

### Running as root (Cloud Agent VMs)

The `make dev` / `make setup` scripts call `initdb` and `pg_ctl` which refuse to run as root. In Cloud Agent environments (running as root), start PostgreSQL manually under the `postgres` system user:

```bash
export PATH="/usr/lib/postgresql/16/bin:$PATH"
mkdir -p .data/postgres .data/redis logs
chown -R postgres:postgres .data/postgres logs

# Init cluster (first time only)
su -s /bin/bash postgres -c 'export PATH="/usr/lib/postgresql/16/bin:$PATH"; initdb -D /workspace/.data/postgres -U chocolate --auth=trust --encoding=UTF8'

# Start Postgres
su -s /bin/bash postgres -c 'export PATH="/usr/lib/postgresql/16/bin:$PATH"; pg_ctl -D /workspace/.data/postgres -l /workspace/logs/postgres.log -o "-p 55432 -h 127.0.0.1 -k /workspace/.data/postgres" start'

# Start Redis (runs fine as root)
redis-server --daemonize yes --port 63790 --dir /workspace/.data/redis --pidfile /workspace/.data/redis/redis.pid --logfile /workspace/logs/redis.log --save "60 1"

# Create DB and seed
psql -h 127.0.0.1 -p 55432 -U chocolate -d postgres -c "DROP DATABASE IF EXISTS chocolate_store;" -c "CREATE DATABASE chocolate_store;"
redis-cli -p 63790 FLUSHALL
cd backend && .venv/bin/python -m app.init_db && cd ..
```

Then start the app servers:
```bash
# Backend
cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend (separate terminal)
cd frontend && NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev -- -p 3000
```

### Testing

- **Backend tests:** `make test-backend` (requires Postgres + Redis running)
- **Frontend tests:** `make test-frontend` (no services needed)
- **All tests:** `make test`
- **Lint (frontend only):** `cd frontend && npx next lint`
- No Python linter is configured in the backend.

### Key gotchas

- The database is **wiped on every services-up** invocation (no migrations; schema comes from SQLAlchemy models via `app.init_db`).
- The `CURSOR_API_KEY` env var is optional — only needed for the in-app "Dev mode" feature.
- Frontend tests use `vitest`; backend tests use `pytest` with `pytest-asyncio`.
