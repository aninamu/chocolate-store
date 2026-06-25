from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from beanie import init_beanie

from app.config import settings
from app.models.chocolate import Chocolate, Order, OrderItem

_client: AsyncIOMotorClient | None = None


def _database(client: AsyncIOMotorClient) -> AsyncIOMotorDatabase:
    return client.get_default_database()


async def connect_db() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.mongodb_url)
    await init_beanie(
        database=_database(_client),
        document_models=[Chocolate, Order, OrderItem],
    )


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("Database not initialized")
    return _client


async def drop_database() -> None:
    client = get_client()
    db = _database(client)
    await client.drop_database(db.name)
    await init_beanie(
        database=_database(client),
        document_models=[Chocolate, Order, OrderItem],
    )
