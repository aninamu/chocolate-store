"use client";

import { Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { Post } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Props = {
  post: Post;
  onLikeToggle?: () => void;
  likePending?: boolean;
  showActions?: boolean;
};

export function PostCard({
  post,
  onLikeToggle,
  likePending,
  showActions = true,
}: Props) {
  const removed = post.deleted_at != null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
        <Link
          href={`/profiles/${post.author.id}`}
          className="relative size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border"
          aria-label={`View ${post.author.name}'s profile`}
        >
          <Image
            src={post.author.avatar_url}
            alt=""
            fill
            className="object-cover"
            sizes="40px"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              href={`/profiles/${post.author.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {post.author.name}
            </Link>
            <time
              className="text-xs text-muted-foreground"
              dateTime={post.created_at}
            >
              {formatRelativeTime(post.created_at)}
            </time>
          </div>
          <Link
            href={`/feed/${post.id}`}
            className="mt-2 block text-sm leading-relaxed text-foreground/90 hover:underline"
          >
            {post.text}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {!removed && post.image_url ? (
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border/60 bg-muted">
            <Image
              src={post.image_url}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 640px"
            />
          </div>
        ) : null}
        {!removed && post.product ? (
          <Link
            href={`/shop/${post.product.id}`}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <span className="relative size-8 shrink-0 overflow-hidden rounded-full">
              <Image
                src={post.product.image_url}
                alt=""
                fill
                className="object-cover"
                sizes="32px"
              />
            </span>
            <span className="truncate font-medium">{post.product.name}</span>
            <Badge variant="secondary" className="shrink-0">
              {formatPrice(post.product.price_cents)}
            </Badge>
          </Link>
        ) : null}
        {showActions ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={post.liked_by_me ? "default" : "outline"}
              size="sm"
              onClick={onLikeToggle}
              disabled={likePending || removed}
              aria-pressed={post.liked_by_me}
              aria-label={
                post.liked_by_me
                  ? `Unlike post (${post.like_count} likes)`
                  : `Like post (${post.like_count} likes)`
              }
            >
              <Heart
                className="size-4"
                fill={post.liked_by_me ? "currentColor" : "none"}
                aria-hidden
              />
              {post.like_count}
            </Button>
            <Link
              href={`/feed/${post.id}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              aria-label={`View comments (${post.comment_count})`}
            >
              <MessageCircle className="size-4" aria-hidden />
              {post.comment_count}
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
