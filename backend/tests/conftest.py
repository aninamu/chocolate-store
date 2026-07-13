# Ensure Settings can load when tests import app without a repo .env
from __future__ import annotations

import os
import socket
from collections.abc import Iterator

import pytest
from starlette.testclient import TestClient

os.environ.setdefault(
    "MONGODB_URL",
    "mongodb://127.0.0.1:27017/chocolate_store",
)
os.environ.setdefault("MONGODB_ENABLED", "true")
os.environ.setdefault("DB_READ_SOURCE_CHOCOLATES", "mongo")
os.environ.setdefault("DB_WRITE_MODE_ORDERS", "mongo")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:63790/0")
# Keep DATABASE_URL unset by default (Mongo-only). Dual-write tests set it.


def _port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1.5):
            return True
    except OSError:
        return False


def _mongo_redis_up() -> bool:
    return _port_open(27017) and _port_open(63790)


@pytest.fixture
def api_client() -> Iterator[TestClient]:
    """HTTP client against the ASGI app; skips if Mongo/Redis ports are closed."""
    if not _mongo_redis_up():
        pytest.skip(
            "MongoDB (27017) / Redis (63790) not reachable; "
            "run `make services-up` (or `make dev`) first."
        )

    from app.main import app

    with TestClient(app) as client:
        yield client
