"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { fetchUserPosts, fetchUserProfile } from "@/lib/api";
import { useDemoUser } from "@/context/demo-user";
import { PostCard } from "@/components/social/PostCard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const { demoHeaders } = useDemoUser();
  const [offset, setOffset] = useState(0);

  const profile = useQuery({
    queryKey: ["profile", id],
    queryFn: () => fetchUserProfile(id),
    enabled: Boolean(id),
  });

  const posts = useQuery({
    queryKey: ["profile-posts", id, offset],
    queryFn: () => fetchUserPosts(id, offset, demoHeaders()),
    enabled: Boolean(id),
  });

  if (profile.isError) {
    return (
      <p className="text-destructive" role="alert">
        {(profile.error as Error).message}
      </p>
    );
  }

  if (profile.isLoading || !profile.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4" aria-label="Loading profile">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const user = profile.data.user;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link href="/feed" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        ← Back to feed
      </Link>

      <header className="flex items-center gap-4 rounded-xl border bg-card p-6">
        <div className="relative size-16 overflow-hidden rounded-full ring-2 ring-border">
          <Image
            src={user.avatar_url}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
          />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {profile.data.post_count} post
            {profile.data.post_count === 1 ? "" : "s"}
            {user.is_moderator ? " · Moderator" : ""}
          </p>
        </div>
      </header>

      <section aria-label={`Posts by ${user.name}`}>
        {posts.isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" aria-hidden />
        ) : (posts.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <ul className="space-y-4">
            {(posts.data?.items ?? []).map((post) => (
              <li key={post.id}>
                <PostCard post={post} showActions={false} />
              </li>
            ))}
          </ul>
        )}
        {posts.data?.next_offset != null ? (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOffset(posts.data!.next_offset!)}
            >
              Load more
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
