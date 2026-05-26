from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.social import DemoUser


async def get_demo_user(
    session: AsyncSession = Depends(get_db),
    x_demo_user_id: str | None = Header(default=None, alias="X-Demo-User-Id"),
) -> DemoUser | None:
    if not x_demo_user_id:
        return None
    try:
        uid = UUID(x_demo_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid demo user id") from exc
    result = await session.execute(select(DemoUser).where(DemoUser.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=400, detail="Unknown demo user")
    return user


async def require_demo_user(
    user: DemoUser | None = Depends(get_demo_user),
) -> DemoUser:
    if user is None:
        raise HTTPException(status_code=401, detail="Demo user required")
    return user


async def require_moderator(
    user: DemoUser = Depends(require_demo_user),
) -> DemoUser:
    if not user.is_moderator:
        raise HTTPException(status_code=403, detail="Moderator access required")
    return user
