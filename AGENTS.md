# Agents

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 55432 | Primary data store (user-level `pg_ctl`, data in `.data/postgres/`) |
| Redis 7 | 63790 | API response cache (user-level `redis-server`, data in `.data/redis/`) |
| FastAPI backend | 8000 | REST API (`uvicorn --reload`) |
| Next.js frontend | 3000 | Web UI (`next dev`) |

### Running the full stack

`make dev` handles bootstrap, services, and app servers in one command. `Ctrl-C` tears everything down. See the README for all `make` targets.

### Running tests

- Backend tests require Postgres and Redis running: `make services-up && make test-backend`
- Frontend tests run standalone: `make test-frontend`
- Both: `make test` (services must be up for backend tests)

### Lint

- Frontend: `cd frontend && npx eslint .`

### Non-obvious caveats

- PostgreSQL binaries (`pg_ctl`, `initdb`, etc.) live at `/usr/lib/postgresql/16/bin/` on Ubuntu. The `scripts/postgres-path.sh` helper auto-adds this to `PATH`.
- The database is **dropped and recreated** on every `make services-up` / `make dev` — schema comes from SQLAlchemy models, seed data from `backend/app/seed.py`.
- The `python3.12-venv` system package is required for `python3 -m venv` to work (not always pre-installed).
- Redis gracefully degrades — the backend still works without it (no caching).
- The `.env` file is auto-created from `.env.example` on first bootstrap. Ports are non-standard (55432, 63790) to avoid collisions with system services.
- `make stop` is a hard teardown if `Ctrl-C` didn't clean up properly.
