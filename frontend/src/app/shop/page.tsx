"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useId,
  useRef,
  useState,
  Suspense,
} from "react";

import { fetchChocolates } from "@/lib/api";
import { ChocolateCard } from "@/components/ChocolateCard";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sorts = [
  { value: "name", label: "Name" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "cacao_desc", label: "Cacao %" },
] as const;

function TagMultiselectDropdown({
  triggerId,
  tagOptions,
  selectedTags,
  isPending,
  onToggle,
  onClearAll,
}: {
  triggerId: string;
  tagOptions: string[];
  selectedTags: string[];
  isPending: boolean;
  onToggle: (tag: string) => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary = useMemo(() => {
    if (selectedTags.length === 0) return "Any tag";
    if (selectedTags.length === 1) return selectedTags[0];
    if (selectedTags.length === 2) {
      return `${selectedTags[0]}, ${selectedTags[1]}`;
    }
    const [a, b] = selectedTags;
    return `${a}, ${b} +${selectedTags.length - 2}`;
  }, [selectedTags]);

  const loading = isPending;
  const empty = !isPending && tagOptions.length === 0;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <Button
        id={triggerId}
        type="button"
        variant="outline"
        size="lg"
        disabled={loading || empty}
        className="h-9 w-full justify-between gap-2 px-3 font-normal hover:bg-background"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!loading && !empty) setOpen((v) => !v);
        }}
      >
        <span className="min-w-0 truncate text-left">
          {loading ? "Loading tags…" : empty ? "No tags" : summary}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 opacity-50 transition-transform",
            open && "rotate-180"
          )}
        />
      </Button>
      {open && !loading && !empty ? (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute top-full z-50 mt-1 max-h-60 w-full min-w-[12rem] overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div className="flex flex-col gap-0.5 py-0.5">
            {tagOptions.map((t) => {
              const id = `tag-dd-${t.replace(/\s/g, "-")}`;
              return (
                <label
                  key={t}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <input
                    id={id}
                    type="checkbox"
                    className="size-3.5 shrink-0 rounded border border-input accent-primary"
                    checked={selectedTags.includes(t)}
                    onChange={() => onToggle(t)}
                  />
                  <span className="truncate">{t}</span>
                </label>
              );
            })}
          </div>
          {selectedTags.length > 0 ? (
            <div className="border-t border-border p-1">
              <button
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  onClearAll();
                }}
              >
                Clear tags
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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
        sort: sortQ || "name",
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
      <h1 className="mb-6 text-2xl font-semibold">Shop</h1>
      <div className="mb-6 flex flex-col gap-4 rounded-lg border bg-card/40 p-4 sm:flex-row sm:items-end sm:gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={tagTriggerId}>Tags</Label>
          <TagMultiselectDropdown
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
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
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
