# Agents

## Cursor Cloud specific instructions

### Overview

This is a full-stack Chocolate Store demo app: Next.js 15 frontend (port 3000) + FastAPI backend (port 8000) + PostgreSQL 16 (port 55432) + Redis 7 (port 63790). See `README.md` for full architecture and Makefile targets.

### Running in Cloud Agent VMs (root user)

The project scripts (`make dev`, `make services-up`) call `initdb` / `pg_ctl` directly, which **cannot run as root**. In Cloud Agent VMs (where you run as root), you must start PostgreSQL under the `postgres` system user:

```bash
export PATH="/usr/lib/postgresql/16/bin:$PATH"

# Init (only first time)
rm -rf .data/postgres && mkdir -p .data/postgres .data/redis logs
chown -R postgres:postgres .data/postgres logs
su - postgres -c "export PATH=/usr/lib/postgresql/16/bin:\$PATH && initdb -D /workspace/.data/postgres -U chocolate --auth=trust --encoding=UTF8"

# Start Postgres
su - postgres -c "export PATH=/usr/lib/postgresql/16/bin:\$PATH && pg_ctl -D /workspace/.data/postgres -l /workspace/logs/postgres.log -o '-p 55432 -h 127.0.0.1 -k /workspace/.data/postgres' start"

# Start Redis (runs fine as root)
redis-server --daemonize yes --port 63790 --dir /workspace/.data/redis --pidfile /workspace/.data/redis/redis.pid --logfile /workspace/logs/redis.log --save 60 1

# Create DB + seed
psql -h 127.0.0.1 -p 55432 -U chocolate -d postgres -c "DROP DATABASE IF EXISTS chocolate_store;" -c "CREATE DATABASE chocolate_store;"
redis-cli -p 63790 FLUSHALL > /dev/null
cd backend && .venv/bin/python -m app.init_db && cd ..
```

### Running dev servers

```bash
# Backend
cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend (separate terminal)
cd frontend && NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev -- -p 3000
```

### Commands quick-reference

| Task | Command |
|------|---------|
| Lint (frontend) | `cd frontend && npm run lint` |
| Type check (frontend) | `cd frontend && npx tsc --noEmit` |
| Tests (backend) | `make test-backend` |
| Tests (frontend) | `make test-frontend` |
| All tests | `make test` |

### Key gotchas

- The database is **disposable** — it is dropped and recreated from SQLAlchemy models + `backend/app/seed.py` on every `services-up`. No migrations exist.
- Backend tests require Postgres (55432) and Redis (63790) to be running; integration tests auto-skip if ports are closed.
- The frontend's `NEXT_PUBLIC_API_URL` env var must be set before starting `next dev` (not hot-reloadable since it's baked at build time for client components).
- The `CURSOR_API_KEY` env var is optional — only needed for the in-app Dev Mode toggle.
