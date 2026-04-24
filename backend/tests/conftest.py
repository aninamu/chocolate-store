# Ensure Settings can load when tests import app without a repo .env
import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://chocolate@127.0.0.1:55432/chocolate_store",
)
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:63790/0")
