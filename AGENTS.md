# Agents

## Cursor Cloud specific instructions

### Overview

This is a **Chocolate Store** demo app with two services:

| Service | Tech | Port | Start command |
|---------|------|------|---------------|
| Backend API | FastAPI + SQLAlchemy (async) + PostgreSQL + Redis | 8000 | `cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` |
| Frontend | Next.js 15 (App Router) + Tailwind + shadcn/ui | 3000 | `cd frontend && npm run dev -- -p 3000` |

Data stores (Postgres on **55432**, Redis on **63790**) run as user-level processes via `make services-up`.

### Quick reference

- **Full dev start**: `make dev` (bootstrap + services + both app servers; Ctrl-C stops all)
- **Setup only**: `make setup`
- **Start data stores**: `make services-up`
- **Stop data stores**: `make services-down`
- **Run all tests**: `make test` (requires `make services-up` first for backend integration tests)
- **Lint frontend**: `cd frontend && npx eslint`
- **Backend tests only**: `make test-backend`
- **Frontend tests only**: `make test-frontend`

### Non-obvious caveats

1. **Database is ephemeral**: The app DB is dropped and recreated on every `make services-up` / `make dev`. Schema comes from SQLAlchemy models; seed data from `backend/app/seed.py`. No migrations exist.
2. **PostgreSQL binaries path**: On Ubuntu/Debian, PG 16 binaries live at `/usr/lib/postgresql/16/bin`. The scripts handle adding this to `PATH` automatically via `scripts/postgres-path.sh`.
3. **System deps required**: `postgresql-16`, `redis-server`, `python3.12-venv`, and `lsof` must be installed. The update script does NOT install these (they're in the VM snapshot). If a future run fails on missing `initdb` or `redis-server`, these packages need reinstalling.
4. **Frontend env var**: `NEXT_PUBLIC_API_URL` must be exported for the Next.js process. The `scripts/dev.sh` script handles this automatically from `.env`.
5. **No Docker needed**: Everything runs as user-level processes; no Docker or docker-compose.
6. **CURSOR_API_KEY** (optional): Only needed for the in-app "Dev mode" toggle that opens a Cursor Cloud agent. Not required for core functionality.
