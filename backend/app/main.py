from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.cache import get_redis, close_redis
from app.db import engine, AsyncSessionFactory
from app.routers import checkout, chocolates, security_validation

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="chocolate store API",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    chocolates.router, prefix="/api/chocolates", tags=["chocolates"]
)
app.include_router(
    checkout.router, prefix="/api", tags=["checkout"]
)
app.include_router(
    security_validation.router, prefix="/api", tags=["diagnostics"]
)


@app.get("/api/health")
async def health() -> dict[str, str | bool]:
    db_ok = False
    redis_ok = False
    try:
        async with AsyncSessionFactory() as s:
            await s.execute(text("SELECT 1"))
            db_ok = True
    except SQLAlchemyError as e:
        log.warning("health db: %s", e)
    try:
        r = get_redis()
        if await r.ping():
            redis_ok = True
    except RedisError as e:
        log.warning("health redis: %s", e)
    return {"ok": db_ok and redis_ok, "database": db_ok, "redis": redis_ok}
