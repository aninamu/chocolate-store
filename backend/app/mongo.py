from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import urlparse

from beanie import init_beanie
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.config import settings

log = logging.getLogger(__name__)

_client: Optional[AsyncMongoClient] = None
_db: Optional[AsyncDatabase] = None
_initialized = False


def _database_name_from_url(url: str) -> str:
    path = urlparse(url).path.lstrip("/")
    if not path:
        return "chocolate_store"
    return path.split("/")[0] or "chocolate_store"


def get_mongo_client() -> AsyncMongoClient:
    global _client
    if _client is None:
        if not settings.mongodb_enabled:
            raise RuntimeError("MongoDB is disabled (MONGODB_ENABLED=false)")
        _client = AsyncMongoClient(
            settings.mongodb_url,
            uuidRepresentation="standard",
        )
    return _client


def get_mongo_db() -> AsyncDatabase:
    global _db
    if _db is None:
        client = get_mongo_client()
        _db = client[_database_name_from_url(settings.mongodb_url)]
    return _db


async def init_mongo() -> None:
    """Initialize Beanie ODM against the configured Mongo database."""
    global _initialized
    if _initialized:
        return
    from app.documents.chocolate import ChocolateDocument, OrderDocument

    db = get_mongo_db()
    await init_beanie(
        database=db,
        document_models=[ChocolateDocument, OrderDocument],
    )
    _initialized = True
    log.info("MongoDB Beanie initialized on %s", settings.mongodb_url)


async def close_mongo() -> None:
    global _client, _db, _initialized
    if _client is not None:
        await _client.close()
    _client = None
    _db = None
    _initialized = False


async def ping_mongo() -> bool:
    try:
        client = get_mongo_client()
        await client.admin.command("ping")
        return True
    except Exception as e:  # noqa: BLE001 — health path must not raise
        log.warning("health mongodb: %s", e)
        return False
