"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useId,
  useState,
  Suspense,
} from "react";

import { fetchChocolates } from "@/lib/api";
import { ChocolateCard } from "@/components/ChocolateCard";
import { ShopTagPicker } from "@/components/ShopTagPicker";
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
  const tagTriggerId = useId();
  const router = useRouter();
  const sp = useSearchParams();
  const tagQ = sp.getAll("tag").map((s) => s.trim()).filter(Boolean);
  const sortQ = (sp.get("sort") as string) || "name";

  const [selectedTags, setSelectedTags] = useState<string[]>(tagQ);
  const [sort, setSort] = useState(sortQ);

  useEffect(() => {
    setSelectedTags(
      sp.getAll("tag")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    setSort((sp.get("sort") as string) || "name");
  }, [sp]);

  const { data: catalogForTags, isPending: tagsCatalogPending } = useQuery({
    queryKey: ["chocolates", "all-for-tag-picker", { sort: "name" as const }],
    queryFn: () => fetchChocolates({ sort: "name" }),
    staleTime: 60_000,
  });
  const tagOptions = useMemo(
    () =>
      [...new Set(catalogForTags?.flatMap((c) => c.tags) ?? [])].sort(
        (a, b) => a.localeCompare(b)
      ),
    [catalogForTags]
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["chocolates", { tags: tagQ.slice().sort(), sort: sortQ }],
    queryFn: () =>
      fetchChocolates({
        tags: tagQ.length ? tagQ : undefined,
        sort: sortQ,
      }),
  });

  const onApply = useCallback(() => {
    const p = new URLSearchParams();
    for (const t of selectedTags) p.append("tag", t);
    if (sort) p.set("sort", sort);
    const qs = p.toString();
    router.push(qs ? `/shop?${qs}` : "/shop");
  }, [selectedTags, sort, router]);

  const toggleTag = useCallback((t: string) => {
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }, []);

  const clearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Shop</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Filter by flavor notes and origin, then sort to find your next favorite bar.
        </p>
      </div>
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border/70 bg-gradient-to-b from-card/90 to-muted/30 p-4 shadow-sm sm:flex-row sm:items-end sm:gap-4 dark:from-card/80 dark:to-muted/20">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={tagTriggerId}>Tags</Label>
          <ShopTagPicker
            triggerId={tagTriggerId}
            tagOptions={tagOptions}
            selectedTags={selectedTags}
            isPending={tagsCatalogPending}
            onToggle={toggleTag}
            onClearAll={clearTags}
          />
        </div>
        <div className="space-y-2 sm:w-48 sm:shrink-0">
          <Label htmlFor="sort">Sort</Label>
          <select
            id="sort"
            className="flex h-9 w-full rounded-lg border border-input bg-card/50 px-3 text-sm shadow-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:bg-input/20"
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
        <Button
          type="button"
          size="lg"
          className="h-9 shrink-0 px-4 sm:self-end"
          onClick={onApply}
        >
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
