"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";

import { fetchChocolates } from "@/lib/api";
import { ChocolateCard } from "@/components/ChocolateCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const sorts = [
  { value: "name", label: "Name" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "cacao_desc", label: "Cacao %" },
] as const;

function ShopContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const tagQ = sp.get("tag") ?? "";
  const sortQ = (sp.get("sort") as string) || "name";

  const [tag, setTag] = useState(tagQ);
  const [sort, setSort] = useState(sortQ);

  useEffect(() => {
    setTag(tagQ);
    setSort(sortQ);
  }, [tagQ, sortQ]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["chocolates", { tag: tagQ, sort: sortQ }],
    queryFn: () =>
      fetchChocolates({ tag: tagQ || undefined, sort: sortQ || "name" }),
  });

  const onApply = useCallback(() => {
    const p = new URLSearchParams();
    if (tag) p.set("tag", tag);
    if (sort) p.set("sort", sort);
    const qs = p.toString();
    router.push(qs ? `/shop?${qs}` : "/shop");
  }, [tag, sort, router]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Shop</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Filter by tag; list responses are cached in Redis on the server (~60s TTL).
      </p>
      <div className="mb-6 flex flex-col gap-4 rounded-lg border bg-card/40 p-4 sm:flex-row sm:items-end">
        <div className="space-y-2 sm:flex-1">
          <Label htmlFor="tag">Tag (substring)</Label>
          <Input
            id="tag"
            placeholder="e.g. dark, milk, gift"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onApply()}
          />
        </div>
        <div className="space-y-2 sm:w-48">
          <Label htmlFor="sort">Sort</Label>
          <select
            id="sort"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" onClick={onApply}>
          Apply
        </Button>
      </div>
      {isError ? (
        <p className="text-destructive">
          {(error as Error).message}{" "}
          <Button variant="link" onClick={() => void refetch()}>
            Retry
          </Button>
        </p>
      ) : isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((c) => <ChocolateCard key={c.id} chocolate={c} />)}
        </div>
      )}
      {!isLoading && data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches. Try a different tag.</p>
      ) : null}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-96 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
