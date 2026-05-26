"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  createComment,
  createReport,
  deletePost,
  fetchPost,
  likePost,
  unlikePost,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { useDemoUser } from "@/context/demo-user";
import { DemoUserPicker } from "@/components/social/DemoUserPicker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function PostDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const router = useRouter();
  const { demoHeaders, userId } = useDemoUser();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["post", id],
    queryFn: () => fetchPost(id, demoHeaders()),
    enabled: Boolean(id),
  });

  const likeMutation = useMutation({
    mutationFn: async (like: boolean) => {
      if (like) return likePost(id, demoHeaders());
      return unlikePost(id, demoHeaders());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["post", id] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const commentMutation = useMutation({
    mutationFn: () => createComment(id, comment.trim(), demoHeaders()),
    onSuccess: () => {
      setComment("");
      toast.success("Comment added");
      void queryClient.invalidateQueries({ queryKey: ["post", id] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(id, demoHeaders()),
    onSuccess: () => {
      toast.success("Post removed");
      router.push("/feed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      createReport(
        { entity_type: "post", entity_id: id, reason: "Demo report" },
        demoHeaders()
      ),
    onSuccess: () => toast.success("Report submitted"),
    onError: (err: Error) => toast.error(err.message),
  });

  if (isError) {
    return (
      <div className="space-y-2">
        <p className="text-destructive" role="alert">
          {(error as Error).message}
        </p>
        <Button variant="link" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4" aria-label="Loading post">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const removed = data.deleted_at != null;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href="/feed" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        ← Back to feed
      </Link>

      <DemoUserPicker />

      <header className="flex items-start gap-3">
        <Link
          href={`/profiles/${data.author.id}`}
          className="relative size-12 shrink-0 overflow-hidden rounded-full ring-1 ring-border"
        >
          <Image
            src={data.author.avatar_url}
            alt=""
            fill
            className="object-cover"
            sizes="48px"
          />
        </Link>
        <div>
          <Link
            href={`/profiles/${data.author.id}`}
            className="font-semibold hover:underline"
          >
            {data.author.name}
          </Link>
          <time
            className="block text-sm text-muted-foreground"
            dateTime={data.created_at}
          >
            {formatRelativeTime(data.created_at)}
          </time>
        </div>
      </header>

      <p className="text-base leading-relaxed">{data.text}</p>

      {!removed && data.image_url ? (
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border bg-muted">
          <Image
            src={data.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="640px"
          />
        </div>
      ) : null}

      {!removed && data.product ? (
        <Link
          href={`/shop/${data.product.id}`}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
        >
          View {data.product.name}
        </Link>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={data.liked_by_me ? "default" : "outline"}
          disabled={removed || likeMutation.isPending}
          aria-pressed={data.liked_by_me}
          onClick={() => likeMutation.mutate(!data.liked_by_me)}
        >
          {data.liked_by_me ? "Unlike" : "Like"} ({data.like_count})
        </Button>
        {!removed ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending}
            >
              Report
            </Button>
            {data.author.id === userId ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                Delete post
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      <section aria-label="Comments" className="space-y-4 border-t pt-6">
        <h2 className="font-heading text-lg font-semibold">
          Comments ({data.comment_count})
        </h2>
        <ul className="space-y-3">
          {data.comments.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border/60 bg-muted/20 p-3"
            >
              <div className="flex items-center gap-2 text-sm">
                <Link
                  href={`/profiles/${c.author.id}`}
                  className="font-medium hover:underline"
                >
                  {c.author.name}
                </Link>
                <time className="text-muted-foreground" dateTime={c.created_at}>
                  {formatRelativeTime(c.created_at)}
                </time>
              </div>
              <p className="mt-1 text-sm">{c.text}</p>
            </li>
          ))}
        </ul>

        {!removed ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (comment.trim()) commentMutation.mutate();
            }}
          >
            <Label htmlFor="comment-text">Add a comment</Label>
            <Input
              id="comment-text"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="Share your thoughts…"
              maxLength={500}
            />
            <Button
              type="submit"
              disabled={!comment.trim() || commentMutation.isPending}
            >
              {commentMutation.isPending ? "Posting…" : "Post comment"}
            </Button>
          </form>
        ) : null}
      </section>
    </article>
  );
}
