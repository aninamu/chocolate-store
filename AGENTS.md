# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Chocolate Store — a full-stack e-commerce demo with **Next.js 15** frontend (port 3000) and **FastAPI** backend (port 8000), backed by **PostgreSQL 16** (port 55432) and **Redis 7** (port 63790). All services run as user-level processes; no Docker is needed.

### System dependencies

PostgreSQL 16 and Redis 7 must be installed at the OS level. On Ubuntu the Postgres binaries live at `/usr/lib/postgresql/16/bin/` and the bootstrap script adds that to `PATH` automatically. Node.js 20+ is required (installed via `n` or NodeSource; the default Ubuntu `nodejs` package is too old).

### Running as root (Cloud Agent gotcha)

`initdb` and `pg_ctl` refuse to run as root. You must run them as the `postgres` user:

```bash
chown postgres:postgres /workspace/.data/postgres
sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D /workspace/.data/postgres -U chocolate --auth=trust --encoding=UTF8
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D /workspace/.data/postgres -l /workspace/logs/postgres.log \
  -o "-p 55432 -h 127.0.0.1 -k /workspace/.data/postgres" start
```

The `make dev` / `make services-up` scripts assume a non-root user and will fail on `initdb` if run as root. Use the manual steps above or wrap them accordingly.

### Quick reference (commands documented in README)

| Task | Command |
|------|---------|
| Full dev (bootstrap + services + servers) | `make dev` (non-root only) |
| Bootstrap only | `make setup` |
| Start Postgres + Redis | `make services-up` |
| Stop everything | `make stop` |
| Backend tests | `make test-backend` |
| Frontend tests | `make test-frontend` |
| All tests | `make test` |
| Frontend lint | `cd frontend && npx eslint .` |

### Non-obvious notes

- The database is **ephemeral**: `make services-up` drops and recreates it every time. Seed data lives in `backend/app/seed.py`.
- Backend tests require Postgres and Redis to be running; frontend tests (vitest/jsdom) do not.
- Redis is flushed on every `services-up` to avoid stale cache entries.
- The `.env` file is auto-created from `.env.example` on first `make setup`; you rarely need to edit it.
- `CURSOR_API_KEY` is optional and only needed for the in-app "Dev Mode" cloud agent integration.
