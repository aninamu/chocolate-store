from __future__ import annotations

import logging

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import settings

log = logging.getLogger(__name__)

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
        )
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def cache_get(key: str) -> str | None:
    r = get_redis()
    try:
        return await r.get(key)
    except RedisError as e:
        log.warning("redis get %s: %s", key, e)
        return None


async def cache_set(key: str, value: str, ttl: int) -> None:
    r = get_redis()
    try:
        await r.setex(key, ttl, value)
    except RedisError as e:
        log.warning("redis set %s: %s", key, e)
