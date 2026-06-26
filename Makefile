ROOT := $(abspath .)

.PHONY: dev setup services-up services-down stop nuke psql redis-cli nuke-confirm \
	test test-coverage test-backend test-backend-coverage test-frontend test-frontend-coverage

# Full stack: bootstrap → data stores → app servers (stops all on Ctrl-C)
dev:
	@chmod +x $(ROOT)/scripts/*.sh
	@./scripts/bootstrap.sh
	@./scripts/services-up.sh
	@exec ./scripts/dev.sh

# One-time or repeated setup (venv, npm, .env, initdb dir)
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
		psql -h 127.0.0.1 -p "$$PG_PORT" -U "$$PG_USER" -d "$$PG_DB"

redis-cli:
	@set -a && [ -f .env ] && . ./.env && set +a && \
		redis-cli -p "$$REDIS_PORT"

# Tests (run `make setup` first so backend is built and frontend/node_modules exist)
test-backend:
	@cd $(ROOT)/backend && cargo test -q

test-backend-coverage:
	@cd $(ROOT)/backend && cargo llvm-cov --lcov --output-path lcov.info 2>/dev/null || cargo test -q

test-frontend:
	@cd $(ROOT)/frontend && npm run test

test-frontend-coverage:
	@cd $(ROOT)/frontend && npm run test:coverage

test: test-backend test-frontend

test-coverage: test-backend-coverage test-frontend-coverage
