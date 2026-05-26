from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_demo_user, require_demo_user, require_moderator
from app.models.chocolate import Chocolate
from app.models.social import Comment, DemoUser, Like, Post, Report
from app.schemas.social import (
    CommentCreateIn,
    CommentOut,
    DemoUserOut,
    FeedOut,
    PostCreateIn,
    PostDetailOut,
    PostOut,
    ProductChipOut,
    ReportCreateIn,
    ReportOut,
    UserProfileOut,
)

router = APIRouter()


def _product_chip(chocolate: Chocolate | None) -> ProductChipOut | None:
    if chocolate is None:
        return None
    return ProductChipOut.model_validate(chocolate)


async def _like_counts(session: AsyncSession, post_ids: list[UUID]) -> dict[UUID, int]:
    if not post_ids:
        return {}
    result = await session.execute(
        select(Like.post_id, func.count())
        .where(Like.post_id.in_(post_ids))
        .group_by(Like.post_id)
    )
    return {row[0]: row[1] for row in result.all()}


async def _comment_counts(session: AsyncSession, post_ids: list[UUID]) -> dict[UUID, int]:
    if not post_ids:
        return {}
    result = await session.execute(
        select(Comment.post_id, func.count())
        .where(Comment.post_id.in_(post_ids), Comment.deleted_at.is_(None))
        .group_by(Comment.post_id)
    )
    return {row[0]: row[1] for row in result.all()}


async def _liked_by_me(
    session: AsyncSession, post_ids: list[UUID], user_id: UUID | None
) -> set[UUID]:
    if not post_ids or user_id is None:
        return set()
    result = await session.execute(
        select(Like.post_id).where(
            Like.post_id.in_(post_ids), Like.user_id == user_id
        )
    )
    return set(result.scalars().all())


def _post_out(
    post: Post,
    *,
    like_count: int,
    comment_count: int,
    liked_by_me: bool,
) -> PostOut:
    removed = post.deleted_at is not None
    return PostOut(
        id=post.id,
        text="[removed]" if removed else post.text,
        image_url=None if removed else post.image_url,
        created_at=post.created_at,
        deleted_at=post.deleted_at,
        author=DemoUserOut.model_validate(post.author),
        product=None if removed else _product_chip(post.chocolate),
        like_count=like_count,
        comment_count=comment_count,
        liked_by_me=liked_by_me,
    )


async def _load_post(session: AsyncSession, post_id: UUID) -> Post | None:
    result = await session.execute(
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.chocolate),
        )
        .where(Post.id == post_id)
    )
    return result.scalar_one_or_none()


@router.get("/users", response_model=list[DemoUserOut])
async def list_users(session: AsyncSession = Depends(get_db)) -> list[DemoUserOut]:
    result = await session.execute(select(DemoUser).order_by(DemoUser.name))
    return [DemoUserOut.model_validate(u) for u in result.scalars().all()]


@router.get("/users/{user_id}", response_model=UserProfileOut)
async def get_user_profile(
    user_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> UserProfileOut:
    result = await session.execute(select(DemoUser).where(DemoUser.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    count = (
        await session.execute(
            select(func.count())
            .select_from(Post)
            .where(Post.author_id == user_id, Post.deleted_at.is_(None))
        )
    ).scalar_one()
    return UserProfileOut(user=DemoUserOut.model_validate(user), post_count=count)


@router.get("/users/{user_id}/posts", response_model=FeedOut)
async def list_user_posts(
    user_id: UUID,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser | None = Depends(get_demo_user),
) -> FeedOut:
    exists = await session.execute(select(DemoUser.id).where(DemoUser.id == user_id))
    if exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="User not found")

    stmt: Select[tuple[Post]] = (
        select(Post)
        .options(selectinload(Post.author), selectinload(Post.chocolate))
        .where(Post.author_id == user_id, Post.deleted_at.is_(None))
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit + 1)
    )
    result = await session.execute(stmt)
    rows = list(result.scalars().all())
    has_more = len(rows) > limit
    page = rows[:limit]
    post_ids = [p.id for p in page]
    likes = await _like_counts(session, post_ids)
    comments = await _comment_counts(session, post_ids)
    liked = await _liked_by_me(
        session, post_ids, demo_user.id if demo_user else None
    )
    items = [
        _post_out(
            p,
            like_count=likes.get(p.id, 0),
            comment_count=comments.get(p.id, 0),
            liked_by_me=p.id in liked,
        )
        for p in page
    ]
    return FeedOut(items=items, next_offset=offset + limit if has_more else None)


@router.get("/feed", response_model=FeedOut)
async def list_feed(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser | None = Depends(get_demo_user),
) -> FeedOut:
    stmt: Select[tuple[Post]] = (
        select(Post)
        .options(selectinload(Post.author), selectinload(Post.chocolate))
        .where(Post.deleted_at.is_(None))
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit + 1)
    )
    result = await session.execute(stmt)
    rows = list(result.scalars().all())
    has_more = len(rows) > limit
    page = rows[:limit]
    post_ids = [p.id for p in page]
    likes = await _like_counts(session, post_ids)
    comments = await _comment_counts(session, post_ids)
    liked = await _liked_by_me(
        session, post_ids, demo_user.id if demo_user else None
    )
    items = [
        _post_out(
            p,
            like_count=likes.get(p.id, 0),
            comment_count=comments.get(p.id, 0),
            liked_by_me=p.id in liked,
        )
        for p in page
    ]
    return FeedOut(items=items, next_offset=offset + limit if has_more else None)


@router.get("/posts/{post_id}", response_model=PostDetailOut)
async def get_post(
    post_id: UUID,
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser | None = Depends(get_demo_user),
) -> PostDetailOut:
    result = await session.execute(
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.chocolate),
            selectinload(Post.comments).selectinload(Comment.author),
        )
        .where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")

    like_count = (
        await session.execute(
            select(func.count()).select_from(Like).where(Like.post_id == post_id)
        )
    ).scalar_one()
    comment_count = (
        await session.execute(
            select(func.count())
            .select_from(Comment)
            .where(Comment.post_id == post_id, Comment.deleted_at.is_(None))
        )
    ).scalar_one()
    liked = False
    if demo_user:
        liked_row = await session.execute(
            select(Like.id).where(
                Like.post_id == post_id, Like.user_id == demo_user.id
            )
        )
        liked = liked_row.scalar_one_or_none() is not None

    visible_comments = [
        c
        for c in sorted(post.comments, key=lambda x: x.created_at)
        if c.deleted_at is None
    ]
    base = _post_out(
        post,
        like_count=like_count,
        comment_count=comment_count,
        liked_by_me=liked,
    )
    return PostDetailOut(
        **base.model_dump(),
        comments=[
            CommentOut(
                id=c.id,
                text=c.text,
                created_at=c.created_at,
                deleted_at=c.deleted_at,
                author=DemoUserOut.model_validate(c.author),
            )
            for c in visible_comments
        ],
    )


@router.post("/posts", response_model=PostOut, status_code=201)
async def create_post(
    body: PostCreateIn,
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser = Depends(require_demo_user),
) -> PostOut:
    if body.chocolate_id is not None:
        ch = await session.execute(
            select(Chocolate.id).where(Chocolate.id == body.chocolate_id)
        )
        if ch.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Unknown product")

    post = Post(
        author_id=demo_user.id,
        chocolate_id=body.chocolate_id,
        text=body.text.strip(),
        image_url=str(body.image_url) if body.image_url else None,
    )
    session.add(post)
    await session.commit()
    loaded = await _load_post(session, post.id)
    assert loaded is not None
    return _post_out(loaded, like_count=0, comment_count=0, liked_by_me=False)


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(
    post_id: UUID,
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser = Depends(require_demo_user),
) -> None:
    post = await _load_post(session, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != demo_user.id and not demo_user.is_moderator:
        raise HTTPException(status_code=403, detail="Not allowed to delete this post")
    post.deleted_at = datetime.now(timezone.utc)
    await session.commit()


@router.post("/posts/{post_id}/likes", status_code=201)
async def like_post(
    post_id: UUID,
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser = Depends(require_demo_user),
) -> dict[str, int]:
    post = await _load_post(session, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await session.execute(
        select(Like).where(Like.post_id == post_id, Like.user_id == demo_user.id)
    )
    if existing.scalar_one_or_none() is None:
        session.add(Like(post_id=post_id, user_id=demo_user.id))
        await session.commit()
    count = (
        await session.execute(
            select(func.count()).select_from(Like).where(Like.post_id == post_id)
        )
    ).scalar_one()
    return {"like_count": count}


@router.delete("/posts/{post_id}/likes", status_code=200)
async def unlike_post(
    post_id: UUID,
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser = Depends(require_demo_user),
) -> dict[str, int]:
    post = await _load_post(session, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Post not found")
    result = await session.execute(
        select(Like).where(Like.post_id == post_id, Like.user_id == demo_user.id)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        await session.delete(row)
        await session.commit()
    count = (
        await session.execute(
            select(func.count()).select_from(Like).where(Like.post_id == post_id)
        )
    ).scalar_one()
    return {"like_count": count}


@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
async def list_comments(
    post_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> list[CommentOut]:
    post = await _load_post(session, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Post not found")
    result = await session.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.post_id == post_id, Comment.deleted_at.is_(None))
        .order_by(Comment.created_at.asc())
    )
    return [
        CommentOut(
            id=c.id,
            text=c.text,
            created_at=c.created_at,
            deleted_at=c.deleted_at,
            author=DemoUserOut.model_validate(c.author),
        )
        for c in result.scalars().all()
    ]


@router.post("/posts/{post_id}/comments", response_model=CommentOut, status_code=201)
async def create_comment(
    post_id: UUID,
    body: CommentCreateIn,
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser = Depends(require_demo_user),
) -> CommentOut:
    post = await _load_post(session, post_id)
    if post is None or post.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Post not found")
    comment = Comment(
        post_id=post_id,
        author_id=demo_user.id,
        text=body.text.strip(),
    )
    session.add(comment)
    await session.commit()
    result = await session.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.id == comment.id)
    )
    saved = result.scalar_one()
    return CommentOut(
        id=saved.id,
        text=saved.text,
        created_at=saved.created_at,
        deleted_at=saved.deleted_at,
        author=DemoUserOut.model_validate(saved.author),
    )


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: UUID,
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser = Depends(require_demo_user),
) -> None:
    result = await session.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if comment is None or comment.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != demo_user.id and not demo_user.is_moderator:
        raise HTTPException(status_code=403, detail="Not allowed to delete this comment")
    comment.deleted_at = datetime.now(timezone.utc)
    await session.commit()


@router.post("/reports", response_model=ReportOut, status_code=201)
async def create_report(
    body: ReportCreateIn,
    session: AsyncSession = Depends(get_db),
    demo_user: DemoUser = Depends(require_demo_user),
) -> ReportOut:
    if body.entity_type == "post":
        entity = await session.execute(select(Post).where(Post.id == body.entity_id))
        target = entity.scalar_one_or_none()
        if target is None or target.deleted_at is not None:
            raise HTTPException(status_code=400, detail="Invalid post target")
    else:
        entity = await session.execute(
            select(Comment).where(Comment.id == body.entity_id)
        )
        target = entity.scalar_one_or_none()
        if target is None or target.deleted_at is not None:
            raise HTTPException(status_code=400, detail="Invalid comment target")

    report = Report(
        reporter_id=demo_user.id,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        reason=body.reason,
        status="open",
    )
    session.add(report)
    await session.commit()
    result = await session.execute(
        select(Report)
        .options(selectinload(Report.reporter))
        .where(Report.id == report.id)
    )
    saved = result.scalar_one()
    return ReportOut.model_validate(saved)


@router.get("/reports", response_model=list[ReportOut])
async def list_reports(
    session: AsyncSession = Depends(get_db),
    _: DemoUser = Depends(require_moderator),
) -> list[ReportOut]:
    result = await session.execute(
        select(Report)
        .options(selectinload(Report.reporter))
        .where(Report.status == "open")
        .order_by(Report.created_at.desc())
    )
    return [ReportOut.model_validate(r) for r in result.scalars().all()]


@router.post("/reports/{report_id}/resolve", response_model=ReportOut)
async def resolve_report(
    report_id: UUID,
    session: AsyncSession = Depends(get_db),
    _: DemoUser = Depends(require_moderator),
) -> ReportOut:
    result = await session.execute(
        select(Report)
        .options(selectinload(Report.reporter))
        .where(Report.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "resolved"
    report.resolved_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(report, attribute_names=["reporter"])
    return ReportOut.model_validate(report)
