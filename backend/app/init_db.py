"""Create the schema from SQLAlchemy models and insert all seed rows.

Invoked by scripts/services-up.sh against a freshly-created (empty) database.
"""
from __future__ import annotations

import asyncio
import uuid

from app.db import AsyncSessionFactory, engine
from app.models.base import Base
from app.models.chocolate import Chocolate
from app.models.social import Comment, DemoUser, Like, Post
from app.seed import (
    SEED,
    SOCIAL_COMMENTS,
    SOCIAL_LIKES,
    SOCIAL_POSTS,
    SOCIAL_USERS,
    slugify,
)


async def _run() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionFactory() as session:
        slug_to_id: dict[str, uuid.UUID] = {}
        for row in SEED:
            ch = Chocolate(
                name=row["name"],
                slug=slugify(row["name"]),
                description=row["description"],
                origin=row.get("origin"),
                cacao_percentage=row.get("cacao_percentage"),
                price_cents=row["price_cents"],
                image_url=row["image_url"],
                tags=row["tags"],
                in_stock=True,
            )
            session.add(ch)
            await session.flush()
            slug_to_id[ch.slug] = ch.id

        user_ids: dict[str, uuid.UUID] = {}
        for row in SOCIAL_USERS:
            uid = uuid.UUID(row["id"])
            session.add(
                DemoUser(
                    id=uid,
                    name=row["name"],
                    avatar_url=row["avatar_url"],
                    is_moderator=row["is_moderator"],
                )
            )
            user_ids[row["id"]] = uid

        post_ids: list[uuid.UUID] = []
        for row in SOCIAL_POSTS:
            chocolate_id = None
            if row.get("chocolate_slug"):
                chocolate_id = slug_to_id.get(row["chocolate_slug"])
            post = Post(
                author_id=user_ids[row["author_id"]],
                chocolate_id=chocolate_id,
                text=row["text"],
                image_url=row.get("image_url"),
            )
            session.add(post)
            await session.flush()
            post_ids.append(post.id)

        for row in SOCIAL_COMMENTS:
            session.add(
                Comment(
                    post_id=post_ids[row["post_index"]],
                    author_id=user_ids[row["author_id"]],
                    text=row["text"],
                )
            )

        for row in SOCIAL_LIKES:
            session.add(
                Like(
                    post_id=post_ids[row["post_index"]],
                    user_id=user_ids[row["user_id"]],
                )
            )

        await session.commit()

    await engine.dispose()
    print(
        f"init_db: created schema and inserted {len(SEED)} chocolates, "
        f"{len(SOCIAL_USERS)} demo users, {len(SOCIAL_POSTS)} posts"
    )


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
