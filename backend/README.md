# chocolate-store API

Run from the repository root: `make dev` (not stand-alone). This package is installed in editable mode into `backend/.venv` by `make setup`.

Environment variables are loaded from the repo root `.env` (see `../.env.example`).

## Tests

From the repo root, after `make setup` and with Postgres/Redis up (`make services-up`):

```bash
make test-backend
make test-backend-coverage   # writes backend/htmlcov/
```

Or from `backend/`: `./.venv/bin/pytest` (coverage is enabled by default via `pyproject.toml`).
