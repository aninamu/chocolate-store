from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models.chocolate import Chocolate, Order

_client: AsyncIOMotorClient | None = None


async def init_mongodb() -> None:
    global _client
    from beanie import init_beanie

    _client = AsyncIOMotorClient(settings.mongodb_url)
    await init_beanie(
        database=_client.get_default_database(),
        document_models=[Chocolate, Order],
    )


async def close_mongodb() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_motor_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("MongoDB is not initialized")
    return _client
