# Agents

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Purpose |
|---------|------|---------|
| MongoDB 7 | 27017 | Primary data store (Docker `mongo:7` or local `mongod`, data in `.data/mongo/`) |
| Redis 7 | 63790 | API response cache (user-level `redis-server`, data in `.data/redis/`) |
| FastAPI backend | 8000 | REST API (`uvicorn --reload`) |
| Next.js frontend | 3000 | Web UI (`next dev`) |
| PostgreSQL 16 (optional) | 55432 | Cutover only — dual-write / backfill / reconcile (`ENABLE_POSTGRES=1`) |

### Running the full stack

`make dev` handles bootstrap, services, and app servers in one command. `Ctrl-C` tears everything down. See the README for all `make` targets.

### Running tests

- Backend tests require Mongo and Redis running: `make services-up && make test-backend`
- Frontend tests run standalone: `make test-frontend`
- Both: `make test` (services must be up for backend tests)

### Lint

- Frontend: `cd frontend && npx eslint .`

### Cloud agent VM prerequisites

`make setup` and `make dev` expect **Redis 7**, **`python3.12-venv`**, and either **Docker** (for `mongo:7`) or a local **`mongod`** on the VM (see README apt packages). Bootstrap also runs `pip install` and `npm install`, which need working egress to PyPI and the npm registry.

If bootstrap fails with missing `redis-server` / `docker` or SSL errors from `pip` / `npm`, allow outbound access to:

- `archive.ubuntu.com`, `security.ubuntu.com` (apt)
- `pypi.org`, `files.pythonhosted.org` (Python dependencies)
- `registry.npmjs.org` (frontend dependencies)
- `docker.io`, `*.docker.io`, `production.cloudflare.docker.com` (Mongo image pull)

After packages are installed, the usual flow is `make setup`, then `make services-up`, then `make dev` (or `make test` with services up).

If you just approved outbound domains and installs still fail with TLS errors (PyPI/npm) or apt `404`/`Release file` errors, **start a new Cloud Agent session** so the VM picks up the updated network policy, then run `make setup` again.

### Non-obvious caveats

- MongoDB usually runs via Docker (`chocolate-store-mongo` container). If `dockerd` is not running, `services-up.sh` tries to start it with the `vfs` storage driver (needed on some nested VMs).
- The Mongo database is **dropped and recreated** on every `make services-up` / `make dev` unless `PERSIST_DATA=1` — indexes come from Beanie document models, seed data from `backend/app/seed.py`.
- The `python3.12-venv` system package is required for `python3 -m venv` to work (not always pre-installed).
- Redis gracefully degrades — the backend still works without it (no caching).
- The `.env` file is auto-created from `.env.example` on first bootstrap. Redis uses a non-standard port (63790) to avoid collisions with system services.
- Cutover flags live in `.env`: `DB_READ_SOURCE_CHOCOLATES`, `DB_WRITE_MODE_ORDERS`, `DUAL_WRITE_ORDERS_PRIMARY`.
- `make stop` is a hard teardown if `Ctrl-C` didn't clean up properly.
- Optional Postgres binaries (`pg_ctl`, `initdb`, etc.) live at `/usr/lib/postgresql/16/bin/` on Ubuntu. The `scripts/postgres-path.sh` helper auto-adds this to `PATH` when `ENABLE_POSTGRES=1`.

### Cloud VM networking

First-time `make setup` / `npm install` / `apt-get install` need outbound HTTPS to package registries (PyPI, npm, Ubuntu archives), Docker Hub for `mongo:7`, and to GitHub release assets when using `gh release download`. Git clone to `github.com` often works before those hosts are allowlisted; if `make setup` fails with SSL errors or empty `apt` candidates, add egress for `pypi.org`, `files.pythonhosted.org`, `registry.npmjs.org`, `archive.ubuntu.com`, `security.ubuntu.com`, `docker.io`, and `release-assets.githubusercontent.com`, then re-run `make setup`.

If `npm install` fails building `sqlite3` (pulled in by `@cursor/sdk`), allow `nodejs.org` for `node-gyp` headers, or run `cd frontend && npm install --no-audit --no-fund --ignore-scripts` once and retry `make setup` (Vitest/shop flows do not need the native sqlite binary).
