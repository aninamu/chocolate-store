# chocolate store

A field-engineer friendly demo: browse a chocolate marketplace, save items, use a local cart, and run a **mock** checkout. No user accounts. **Next.js 15 (App Router + Tailwind + shadcn/ui)**, **FastAPI**, **MongoDB** (Docker or local `mongod`, project-local data dir), **Redis** (user-level `redis-server`, local port), all in **dev mode with hot reload**.

Postgres remains available as an optional cutover store (`ENABLE_POSTGRES=1`) for dual-write / backfill / reconcile during migration.

## Prerequisites

- **Python 3.9+** (3.12+ recommended for newer typing support).
- **Node.js 20+** and `npm`.
- **MongoDB 7** via **Docker** (`docker` + `dockerd`) **or** a local `mongod` binary.
- **Redis 7** on your `PATH` (`redis-server`, `redis-cli`).
- **macOS (Homebrew):** `brew install redis` (and Docker Desktop, or `brew install mongodb-community`)
- **Ubuntu/Debian:** `sudo apt-get install redis-server python3.12-venv docker.io`

Optional (cutover only): **Postgres 16** (`initdb`, `pg_ctl`, `psql`) when `ENABLE_POSTGRES=1`.

## One command

```bash
make dev
```

This will:

1. **Bootstrap** — create `backend/.venv`, `pip install` the API, `npm install` the frontend, copy `.env.example` → `.env` if needed, and create `./.data/mongo` / `./.data/redis`.
2. **Bring data stores up** — start MongoDB on **27017** and Redis on **63790**, drop and recreate the app database (unless `PERSIST_DATA=1`), then create indexes via Beanie and load [`backend/app/seed.py`](./backend/app/seed.py).
3. **Run both apps** — FastAPI on **8000** with `uvicorn --reload`, Next on **3000** with `next dev`.

- **App:** <http://127.0.0.1:3000>
- **API health:** <http://127.0.0.1:8000/api/health>  
- **OpenAPI JSON:** <http://127.0.0.1:8000/openapi.json>

`Ctrl-C` stops the web stack **and** Mongo/Redis for this project so nothing keeps running. If something dies badly, `make stop` is a hard teardown.

## Cutover flags (Postgres → Mongo)

| Env var | Values | Default |
|---------|--------|---------|
| `MONGODB_ENABLED` | `true` / `false` | `true` |
| `DB_READ_SOURCE_CHOCOLATES` | `postgres` \| `shadow` \| `mongo` | `mongo` |
| `DB_WRITE_MODE_ORDERS` | `postgres` \| `dual` \| `mongo` | `mongo` |
| `DUAL_WRITE_ORDERS_PRIMARY` | `postgres` \| `mongo` | `postgres` |
| `DUAL_WRITE_STRICT` | `true` / `false` | `true` |
| `ENABLE_POSTGRES` | `0` / `1` | `0` (shell) |
| `PERSIST_DATA` | `0` / `1` | `0` — skip wipe on `services-up` |

Helpers: `make backfill-mongo`, `make reconcile`.

## Other Make targets

| Target | What it does |
|--------|----------------|
| `make setup` | Bootstrap only (venv, npm, .env, data dirs). |
| `make services-up` / `make services-down` | Start/stop Mongo+Redis in `./.data/` (Postgres if `ENABLE_POSTGRES=1`). |
| `make stop` | `services-down` + kill anything still listening on the app/db/cache ports. |
| `make nuke-confirm` | `stop` + delete `./.data/` (fresh start on next `make dev`). |
| `make mongo-shell` | `mongosh` into the project Mongo database. |
| `make psql` | `psql` into the optional project Postgres database. |
| `make redis-cli` | `redis-cli` to the project Redis. |
| `make backfill-mongo` | Copy Postgres → Mongo (requires `DATABASE_URL` + both stores). |
| `make reconcile` | Checksum-reconcile Postgres vs Mongo. |
| `make test` | Run backend (`pytest`) and frontend (`vitest`) unit tests. Requires `make setup` first. |
| `make test-coverage` | Same as `make test`, with coverage reports (terminal + HTML). No minimum thresholds. |
| `make test-backend` | Backend tests only. |
| `make test-backend-coverage` | Backend tests with coverage → `backend/htmlcov/`. |
| `make test-frontend` | Frontend tests only. |
| `make test-frontend-coverage` | Frontend tests with coverage → `frontend/coverage/`. |

### Tests and coverage

- **Backend:** from the repo root, `make setup` then `make services-up` so MongoDB (**27017**) and Redis (**63790**) are listening. API integration tests skip automatically if those ports are closed. Coverage HTML: [`backend/htmlcov/index.html`](./backend/htmlcov/index.html) after `make test-backend-coverage`.
- **Frontend:** `cd frontend && npm run test` or `make test-frontend`. Coverage HTML: [`frontend/coverage/index.html`](./frontend/coverage/index.html) after `make test-frontend-coverage`.
- Coverage is **report-only** (no enforced minimum gate).

### Pull request merge gate (GitHub)

- Pull requests targeting `main` must pass the required GitHub checks before merge.
- Required checks come from `.github/workflows/ci.yml`: `backend-tests` and `frontend-tests`.
- Branches must also be up to date with `main` before merge is allowed.

## Configuration

Copy and edit [`.env.example`](./.env.example) to `.env` (done automatically on first `make dev`). The API reads `MONGODB_URL` and `REDIS_URL`; the browser uses `NEXT_PUBLIC_API_URL` (also exported in `scripts/dev.sh` for `next dev`).

Optional **in-app Dev mode** (toggle in the UI) can open a **Cursor Cloud agent** via the Next.js route [`frontend/src/app/api/dev-mode/agent/route.ts`](./frontend/src/app/api/dev-mode/agent/route.ts). Set **`CURSOR_API_KEY`** (server-only; get a key from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations)). Optionally set **`CURSOR_DEV_MODE_REPO_URL`** to an HTTPS GitHub repo URL connected to your team; otherwise the handler tries `git remote get-url origin` from the repo root. With Dev mode enabled, the sidebar **History** tab lists cloud agents via the TypeScript SDK (`GET` on the same route), including a **latest-run output preview** per agent (extra SDK calls server-side).

## Suggested “Cursor as a field engineer” demo

1. Run `make dev`, open the shop, add an item, open the cart sheet, and place a **mock** order. Show **Network** for `POST /api/checkout` and the success page. Optional: `make mongo-shell` and `db.orders.find()`.
2. Change copy or layout in `frontend/src/app/shop/page.tsx` and save — Fast Refresh should update immediately.
3. Tweak a response in `backend/app/routers/chocolates.py` (e.g. an extra field on the Pydantic model) — `uvicorn --reload` should pick it up; refresh the list.
4. In Redis CLI, run `KEYS chocolates:*` after loading `/api/chocolates` twice to show server-side list caching.
5. `Ctrl-C` to prove nothing is left on the ports: `lsof -i :27017 -i :63790 -i :8000 -i :3000` should be empty (after any browser tabs close; Next may need a second for cleanup).

## Layout

- [`backend/`](./backend) — FastAPI, Beanie/Motor (Mongo), optional SQLAlchemy (Postgres cutover). Schema/indexes from [`app/documents/`](./backend/app/documents/); seed via [`app/init_mongo.py`](./backend/app/init_mongo.py) + [`app/seed.py`](./backend/app/seed.py). Repository seam in [`app/repositories/`](./backend/app/repositories/).
- [`frontend/`](./frontend) — Next.js, TanStack Query, cart/saved in `localStorage` under `cs.cart.v1` and `cs.saved.v1` ([`src/context/shop-state.tsx`](./frontend/src/context/shop-state.tsx)).
- [`scripts/`](./scripts) — `bootstrap.sh`, `services-up.sh`, `services-down.sh`, `dev.sh`, `stop.sh`, `nuke.sh`.

## License

This repository is a demo; use and adapt it as you like for internal demos or learning.
