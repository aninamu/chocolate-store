ROOT := $(abspath .)

.PHONY: dev setup services-up services-down stop nuke mongosh redis-cli nuke-confirm \
	test test-coverage test-backend test-backend-coverage test-frontend test-frontend-coverage

# Full stack: bootstrap → data stores → app servers (stops all on Ctrl-C)
dev:
	@chmod +x $(ROOT)/scripts/*.sh
	@./scripts/bootstrap.sh
	@./scripts/services-up.sh
	@exec ./scripts/dev.sh

# One-time or repeated setup (venv, npm, .env, MongoDB data dir)
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

mongosh:
	@set -a && [ -f .env ] && . ./.env && set +a && \
		mongosh "$${MONGODB_URL%/}/$${MONGO_DB}"

redis-cli:
	@set -a && [ -f .env ] && . ./.env && set +a && \
		redis-cli -p "$$REDIS_PORT"

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
