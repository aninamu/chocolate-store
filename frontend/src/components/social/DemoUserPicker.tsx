"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

import { fetchDemoUsers } from "@/lib/api";
import { useDemoUser } from "@/context/demo-user";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export function DemoUserPicker() {
  const { userId, setUserId, isReady } = useDemoUser();
  const { data, isLoading } = useQuery({
    queryKey: ["demo-users"],
    queryFn: fetchDemoUsers,
  });

  if (!isReady || isLoading) {
    return <Skeleton className="h-10 w-full max-w-xs rounded-md" aria-hidden />;
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="demo-user-select">Posting as</Label>
      <select
        id="demo-user-select"
        className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={userId ?? ""}
        onChange={(e) => setUserId(e.target.value)}
        aria-label="Select demo user identity"
      >
        {(data ?? []).map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
            {u.is_moderator ? " (moderator)" : ""}
          </option>
        ))}
      </select>
      {userId && data ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {(() => {
            const active = data.find((u) => u.id === userId);
            if (!active) return null;
            return (
              <>
                <Image
                  src={active.avatar_url}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded-full object-cover"
                  aria-hidden
                />
                Demo identity — no real login. Switch users to try likes and comments.
              </>
            );
          })()}
        </p>
      ) : null}
    </div>
  );
}
