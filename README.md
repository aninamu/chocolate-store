# chocolate.store

A field-engineer friendly demo: browse a chocolate marketplace, save items, use a local cart, and run a **mock** checkout. No user accounts. **Next.js 15 (App Router + Tailwind + shadcn/ui)**, **FastAPI**, **Postgres** (user-level `pg_ctl`, project-local data dir), **Redis** (user-level `redis-server`, local port), all in **dev mode with hot reload**.

## Prerequisites (macOS)

- **Homebrew** (or install Postgres 16 and Redis 7 yourself and put `initdb`, `pg_ctl`, `psql`, `redis-server`, and `redis-cli` on your `PATH`).
- **Python 3.9+** (3.12+ from Homebrew recommended for newer typing support).
- **Node.js 20+** and `npm`.
- `brew install postgresql@16 redis` if you are missing the binaries (the tools stay **off** `brew services`—this project starts its own processes).

## One command

```bash
make dev
```

This will:

1. **Bootstrap** — create `backend/.venv`, `pip install` the API, `npm install` the frontend, copy `.env.example` → `.env` if needed, and `initdb` a Postgres cluster in `./.data/postgres` the first time.
2. **Bring data stores up** — start Postgres on **55432** and Redis on **63790** (isolated from any system services), run `alembic upgrade head` and the seed.
3. **Run both apps** — FastAPI on **8000** with `uvicorn --reload`, Next on **3000** with `next dev`.

- **App:** <http://127.0.0.1:3000>
- **API health:** <http://127.0.0.1:8000/api/health>  
- **OpenAPI JSON:** <http://127.0.0.1:8000/openapi.json>

`Ctrl-C` stops the web stack **and** Postgres/Redis for this project so nothing keeps running. If something dies badly, `make stop` is a hard teardown.

## Other Make targets

| Target | What it does |
|--------|----------------|
| `make setup` | Bootstrap only (venv, npm, .env, `initdb` if new). |
| `make services-up` / `make services-down` | Start/stop only Postgres+Redis in `./.data/`. |
| `make stop` | `services-down` + kill anything still listening on the app/db/cache ports. |
| `make reset-db` | `DROP SCHEMA public` + re-migrate + re-seed (keeps the cluster in `.data/`. |
| `make nuke-confirm` | `stop` + delete `./.data/` (fresh `initdb` on next `make dev`). |
| `make psql` | `psql` into the project database. |
| `make redis-cli` | `redis-cli` to the project Redis. |

## Configuration

Copy and edit [`.env.example`](./.env.example) to `.env` (done automatically on first `make dev`). The API reads `DATABASE_URL` and `REDIS_URL`; the browser uses `NEXT_PUBLIC_API_URL` (also exported in `scripts/dev.sh` for `next dev`).

## Suggested “Cursor as a field engineer” demo

1. Run `make dev`, open the shop, add an item, open the cart sheet, and place a **mock** order. Show **Network** for `POST /api/checkout` and the success page. Optional: `make psql` and `select * from orders;`.
2. Change copy or layout in `frontend/src/app/shop/page.tsx` and save — Fast Refresh should update immediately.
3. Tweak a response in `backend/app/routers/chocolates.py` (e.g. an extra field on the Pydantic model) — `uvicorn --reload` should pick it up; refresh the list.
4. In Redis CLI, run `KEYS chocolates:*` after loading `/api/chocolates` twice to show server-side list caching.
5. `Ctrl-C` to prove nothing is left on the ports: `lsof -i :55432 -i :63790 -i :8000 -i :3000` should be empty (after any browser tabs close; Next may need a second for cleanup).

## Layout

- [`backend/`](./backend) — FastAPI, SQLAlchemy (async) + Alembic, `app/seed.py` for the catalog.
- [`frontend/`](./frontend) — Next.js, TanStack Query, cart/saved in `localStorage` under `cs.cart.v1` and `cs.saved.v1` ([`src/context/shop-state.tsx`](./frontend/src/context/shop-state.tsx)).
- [`scripts/`](./scripts) — `bootstrap.sh`, `services-up.sh`, `services-down.sh`, `dev.sh`, `stop.sh`, `nuke.sh`, `reset-db.sh`.

## License

This repository is a demo; use and adapt it as you like for internal demos or learning.
