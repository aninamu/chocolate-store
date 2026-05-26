"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { fetchFeed, likePost, unlikePost } from "@/lib/api";
import type { Post } from "@/lib/types";
import { useDemoUser } from "@/context/demo-user";
import { DemoUserPicker } from "@/components/social/DemoUserPicker";
import { PostCard } from "@/components/social/PostCard";
import { PostComposer } from "@/components/social/PostComposer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function FeedPage() {
  const { demoHeaders, isReady } = useDemoUser();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [extraItems, setExtraItems] = useState<Post[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [likePendingId, setLikePendingId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["feed", offset === 0 ? "initial" : offset],
    queryFn: async () => {
      const page = await fetchFeed(offset, demoHeaders());
      return page;
    },
    enabled: isReady,
  });

  const items =
    offset === 0
      ? (data?.items ?? [])
      : [...extraItems, ...(data?.items ?? [])];

  const loadMoreOffset = offset === 0 ? data?.next_offset : nextOffset;

  const likeMutation = useMutation({
    mutationFn: async ({
      post,
      like,
    }: {
      post: Post;
      like: boolean;
    }) => {
      setLikePendingId(post.id);
      const count = like
        ? await likePost(post.id, demoHeaders())
        : await unlikePost(post.id, demoHeaders());
      return { postId: post.id, count, liked: like };
    },
    onMutate: async ({ post, like }) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const updater = (p: Post) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: like,
              like_count: p.like_count + (like ? 1 : -1),
            }
          : p;
      queryClient.setQueryData<{ items: Post[]; next_offset: number | null }>(
        ["feed", "initial"],
        (old) =>
          old
            ? { ...old, items: old.items.map(updater) }
            : old
      );
      setExtraItems((prev) => prev.map(updater));
    },
    onError: (err: Error, { post, like }) => {
      toast.error(err.message);
      const rollback = (p: Post) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !like,
              like_count: p.like_count + (like ? -1 : 1),
            }
          : p;
      queryClient.setQueryData<{ items: Post[]; next_offset: number | null }>(
        ["feed", "initial"],
        (old) =>
          old
            ? { ...old, items: old.items.map(rollback) }
            : old
      );
      setExtraItems((prev) => prev.map(rollback));
    },
    onSettled: () => {
      setLikePendingId(null);
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const handleLike = useCallback(
    (post: Post) => {
      likeMutation.mutate({ post, like: !post.liked_by_me });
    },
    [likeMutation]
  );

  const handleLoadMore = async () => {
    const next = loadMoreOffset;
    if (next == null) return;
    if (offset === 0 && data) {
      setExtraItems(data.items);
      setNextOffset(data.next_offset);
    }
    setOffset(next);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Community feed
        </h1>
        <p className="text-sm text-muted-foreground">
          Discover chocolates through tasting notes and photos from other shoppers.
        </p>
      </div>

      <DemoUserPicker />
      <PostComposer />

      <section aria-label="Feed posts" aria-busy={isFetching}>
        {isError ? (
          <p className="text-sm text-destructive" role="alert">
            {(error as Error).message}{" "}
            <Button variant="link" onClick={() => void refetch()}>
              Retry
            </Button>
          </p>
        ) : isLoading ? (
          <div className="space-y-4" aria-label="Loading feed">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No posts yet. Be the first to share a discovery above.
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  onLikeToggle={() => handleLike(post)}
                  likePending={likePendingId === post.id}
                />
              </li>
            ))}
          </ul>
        )}

        {loadMoreOffset != null ? (
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleLoadMore()}
              disabled={isFetching}
              aria-busy={isFetching}
            >
              {isFetching ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/moderation" className="underline hover:text-foreground">
          Moderation queue
        </Link>{" "}
        (demo moderators only)
      </p>
    </div>
  );
}
