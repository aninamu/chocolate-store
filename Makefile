ROOT := $(abspath .)

.PHONY: dev setup services-up services-down stop nuke psql redis-cli mongo-shell nuke-confirm \
	test test-coverage test-backend test-backend-coverage test-frontend test-frontend-coverage \
	backfill-mongo reconcile

# Full stack: bootstrap → data stores → app servers (stops all on Ctrl-C)
dev:
	@chmod +x $(ROOT)/scripts/*.sh
	@./scripts/bootstrap.sh
	@./scripts/services-up.sh
	@exec ./scripts/dev.sh

# One-time or repeated setup (venv, npm, .env, data dirs)
setup:
	@chmod +x $(ROOT)/scripts/*.sh
	@./scripts/bootstrap.sh

services-up: setup
	@./scripts/services-up.sh

services-down:
	@chmod +x $(ROOT)/scripts/*.sh
	@./scripts/services-down.sh

stop:
	@chmod +x $(ROOT)/scripts/*.sh
	@./scripts/stop.sh

nuke-confirm:
	@chmod +x $(ROOT)/scripts/*.sh
	@./scripts/nuke.sh

nuke:
	@echo "Run 'make nuke-confirm' to delete ./.data/ and free ports."

psql:
	@set -a && [ -f .env ] && . ./.env && set +a && \
		. ./scripts/postgres-path.sh && add_postgres_bin_to_path; \
		psql -h 127.0.0.1 -p "$${PG_PORT:-55432}" -U "$${PG_USER:-chocolate}" -d "$${PG_DB:-chocolate_store}"

mongo-shell:
	@set -a && [ -f .env ] && . ./.env && set +a && \
		docker exec -it chocolate-store-mongo mongosh "$${MONGODB_URL:-mongodb://127.0.0.1:27017/chocolate_store}" \
		|| mongosh "$${MONGODB_URL:-mongodb://127.0.0.1:27017/chocolate_store}"

redis-cli:
	@set -a && [ -f .env ] && . ./.env && set +a && \
		redis-cli -p "$$REDIS_PORT"

backfill-mongo:
	@cd $(ROOT)/backend && ./.venv/bin/python -m scripts.backfill_mongo

reconcile:
	@cd $(ROOT)/backend && ./.venv/bin/python -m scripts.reconcile --domain all --mode full

# Tests (run `make setup` first so backend/.venv and frontend/node_modules exist)
test-backend:
	@cd $(ROOT)/backend && ./.venv/bin/pytest -q

test-backend-coverage:
	@cd $(ROOT)/backend && ./.venv/bin/pytest -q --cov=app --cov-report=term-missing --cov-report=html:htmlcov

test-frontend:
	@cd $(ROOT)/frontend && npm run test

test-frontend-coverage:
	@cd $(ROOT)/frontend && npm run test:coverage

test: test-backend test-frontend

test-coverage: test-backend-coverage test-frontend-coverage
