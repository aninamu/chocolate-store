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
import { chocolateListQueryKey } from "@/lib/chocolate-catalog";
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

const TAG_GROUP_ORDER = [
  "Chocolate type",
  "Cacao",
  "Flavors",
  "Inclusions & diet",
  "Texture & format",
  "Other",
] as const;

type TagGroupLabel = (typeof TAG_GROUP_ORDER)[number];

const TAG_GROUP_TYPE = new Set(
  ["dark", "milk", "white", "ruby", "single-origin"] satisfies string[]
);
const TAG_GROUP_FLAVOR = new Set(
  [
    "caramel",
    "salt",
    "fruity",
    "fruit",
    "citrus",
    "mint",
    "spicy",
    "nutty",
  ] satisfies string[]
);
const TAG_GROUP_INCLUSION = new Set(
  ["praline", "almond", "hazelnut", "nibs", "vegan"] satisfies string[]
);
const TAG_GROUP_FORMAT = new Set(
  ["textured", "bites", "truffle", "spread", "classic", "gift"] satisfies string[]
);

function isCacaoPercentageTag(tag: string): boolean {
  return /^\d{1,3}%$/.test(tag);
}

function tagGroupLabel(tag: string): TagGroupLabel {
  const key = tag.toLowerCase();
  if (TAG_GROUP_TYPE.has(key)) return "Chocolate type";
  if (isCacaoPercentageTag(tag)) return "Cacao";
  if (TAG_GROUP_FLAVOR.has(key)) return "Flavors";
  if (TAG_GROUP_INCLUSION.has(key)) return "Inclusions & diet";
  if (TAG_GROUP_FORMAT.has(key)) return "Texture & format";
  return "Other";
}

function groupSortedTags(tags: string[]): { label: TagGroupLabel; tags: string[] }[] {
  const buckets: Record<TagGroupLabel, string[]> = {
    "Chocolate type": [],
    Cacao: [],
    Flavors: [],
    "Inclusions & diet": [],
    "Texture & format": [],
    Other: [],
  };
  for (const t of tags) {
    buckets[tagGroupLabel(t)].push(t);
  }
  return TAG_GROUP_ORDER.filter((label) => buckets[label].length > 0).map((label) => ({
    label,
    tags: buckets[label],
  }));
}

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

  const empty = !isPending && tagOptions.length === 0;
  const tagGroups = useMemo(() => groupSortedTags(tagOptions), [tagOptions]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <Button
        id={triggerId}
        type="button"
        variant="outline"
        size="lg"
        disabled={isPending || empty}
        className="h-9 w-full justify-between gap-2 px-3 font-normal hover:bg-background"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!isPending && !empty) setOpen((v) => !v);
        }}
      >
        <span className="min-w-0 truncate text-left">
          {isPending ? "Loading tags…" : empty ? "No tags" : summary}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 opacity-50 transition-transform",
            open && "rotate-180"
          )}
        />
      </Button>
      {open && !isPending && !empty ? (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute top-full z-50 mt-1 max-h-72 w-full min-w-[12rem] overflow-auto rounded-lg border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        >
          <div className="flex flex-col py-0.5">
            {tagGroups.map((group, gi) => (
              <div
                key={group.label}
                role="group"
                aria-label={group.label}
                className={cn(gi > 0 && "mt-1 border-t border-border/60 pt-1")}
              >
                <div className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.tags.map((t) => {
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
              </div>
            ))}
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
    queryKey: chocolateListQueryKey(),
    queryFn: () => fetchChocolates(),
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
    queryKey: chocolateListQueryKey({
      tags: tagQ.length ? tagQ : undefined,
      sort: sortQ,
    }),
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
