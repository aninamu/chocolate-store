# Agents

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 55432 | Primary data store (user-level `pg_ctl`, data in `.data/postgres/`) |
| Redis 7 | 63790 | API response cache (user-level `redis-server`, data in `.data/redis/`) |
| Axum backend | 8000 | REST API (`cargo watch` / `cargo run`) |
| Next.js frontend | 3000 | Web UI (`next dev`) |

### Running the full stack

`make dev` handles bootstrap, services, and app servers in one command. `Ctrl-C` tears everything down. See the README for all `make` targets.

### Running tests

- Backend tests require Postgres and Redis running: `make services-up && make test-backend`
- Frontend tests run standalone: `make test-frontend`
- Both: `make test` (services must be up for backend tests)

### Lint

- Frontend: `cd frontend && npx eslint .`

### Cloud agent VM prerequisites

`make setup` and `make dev` expect **Postgres 16**, **Redis 7**, and the **Rust stable toolchain** on the VM (see README apt packages). Bootstrap also runs `cargo fetch` and `npm install`, which need working egress to crates.io and the npm registry.

If bootstrap fails with missing `initdb` / `redis-server` or SSL errors from `cargo` / `npm`, allow outbound access to:

- `archive.ubuntu.com`, `security.ubuntu.com` (apt)
- `index.crates.io`, `static.crates.io` (Rust dependencies)
- `registry.npmjs.org` (frontend dependencies)

After packages are installed, the usual flow is `make setup`, then `make services-up`, then `make dev` (or `make test` with services up).

If you just approved outbound domains and installs still fail with TLS errors (crates.io/npm) or apt `404`/`Release file` errors, **start a new Cloud Agent session** so the VM picks up the updated network policy, then run `make setup` again.

### Non-obvious caveats

- PostgreSQL binaries (`pg_ctl`, `initdb`, etc.) live at `/usr/lib/postgresql/16/bin/` on Ubuntu. The `scripts/postgres-path.sh` helper auto-adds this to `PATH`.
- The database is **dropped and recreated** on every `make services-up` / `make dev` — schema comes from `backend/src/schema.sql`, seed data from `backend/src/seed.rs`.
- Optional `cargo-watch` enables hot reload for the Rust API during `make dev`.
- Redis gracefully degrades — the backend still works without it (no caching).
- The `.env` file is auto-created from `.env.example` on first bootstrap. Ports are non-standard (55432, 63790) to avoid collisions with system services.
- `make stop` is a hard teardown if `Ctrl-C` didn't clean up properly.

### Cloud VM networking

First-time `make setup` / `npm install` / `apt-get install` need outbound HTTPS to package registries (crates.io, npm, Ubuntu archives) and to GitHub release assets when using `gh release download`. Git clone to `github.com` often works before those hosts are allowlisted; if `make setup` fails with SSL errors or empty `apt` candidates, add egress for `index.crates.io`, `static.crates.io`, `registry.npmjs.org`, `archive.ubuntu.com`, `security.ubuntu.com`, and `release-assets.githubusercontent.com`, then re-run `make setup`.

If `npm install` fails building `sqlite3` (pulled in by `@cursor/sdk`), allow `nodejs.org` for `node-gyp` headers, or run `cd frontend && npm install --no-audit --no-fund --ignore-scripts` once and retry `make setup` (Vitest/shop flows do not need the native sqlite binary).
