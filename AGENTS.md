# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Chocolate Store — a full-stack demo app (Next.js 15 frontend + FastAPI backend + PostgreSQL 16 + Redis 7). See `README.md` for architecture and all Make targets.

### Running services

All services run locally (no Docker). Use `make dev` for the full stack or run steps individually:

1. `make services-up` — starts PostgreSQL (port 55432) and Redis (port 63790), recreates the DB from models + seed data.
2. Backend: `cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
3. Frontend: `cd frontend && npm run dev -- -p 3000`

Ctrl-C on `make dev` also stops the data stores. If processes leak, use `make stop`.

### Testing

- Backend tests require services running (`make services-up` first): `make test-backend`
- Frontend tests are standalone: `make test-frontend`
- Lint frontend: `cd frontend && npx eslint .`
- All tests: `make test`

### Non-obvious notes

- PostgreSQL binaries live at `/usr/lib/postgresql/16/bin/` on this VM — the bootstrap script adds this to PATH automatically.
- The database is fully disposable: wiped and recreated on every `make services-up` / `make dev`. Edit `backend/app/seed.py` to change catalog data.
- All ports are non-standard (55432, 63790, 8000, 3000) to avoid conflicts.
- The `.env` file is auto-created from `.env.example` on first `make setup`/`make dev`; it does not need manual creation.
- `CURSOR_API_KEY` is optional (for in-app Dev mode only); the core shop works without it.
- Frontend environment variable `NEXT_PUBLIC_API_URL` must match the backend port; `scripts/dev.sh` exports it automatically.
