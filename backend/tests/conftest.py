# Ensure Settings can load when tests import app without a repo .env
from __future__ import annotations

import os
import socket
from collections.abc import Iterator

import pytest
from starlette.testclient import TestClient

os.environ.setdefault(
    "MONGODB_URL",
    "mongodb://127.0.0.1:57017/chocolate_store",
)
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:63790/0")


def _services_ports_open() -> bool:
    """Cheap reachability check without touching the async MongoDB client."""
    for host, port in (("127.0.0.1", 57017), ("127.0.0.1", 63790)):
        try:
            with socket.create_connection((host, port), timeout=1.5):
                pass
        except OSError:
            return False
    return True


@pytest.fixture
def api_client() -> Iterator[TestClient]:
    """HTTP client against the ASGI app; skips if MongoDB/Redis ports are closed."""
    if not _services_ports_open():
        pytest.skip(
            "MongoDB (57017) / Redis (63790) not reachable; "
            "run `make services-up` (or `make dev`) first."
        )

    from app.main import app

    with TestClient(app) as client:
        yield client
