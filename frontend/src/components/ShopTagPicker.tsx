"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export type ShopTagPickerProps = {
  triggerId: string;
  tagOptions: string[];
  selectedTags: string[];
  isPending: boolean;
  onToggle: (tag: string) => void;
  onClearAll: () => void;
};

export function ShopTagPicker({
  triggerId,
  tagOptions,
  selectedTags,
  isPending,
  onToggle,
  onClearAll,
}: ShopTagPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ddId = useId();
  const panelId = `${ddId}-tags-panel`;
  const optionIdPrefix = `${ddId}-tag-opt`;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        queueMicrotask(() => triggerRef.current?.focus());
      }
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
        ref={triggerRef}
        type="button"
        variant="outline"
        size="lg"
        disabled={isPending || empty}
        className="h-9 w-full justify-between gap-2 px-3 font-normal hover:bg-background"
        aria-expanded={open}
        aria-controls={panelId}
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
          aria-hidden
        />
      </Button>
      {open && !isPending && !empty ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="absolute top-full z-50 mt-1 max-h-72 w-full min-w-[12rem] overflow-auto rounded-lg border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        >
          <div className="flex flex-col py-0.5">
            {tagGroups.map((group, gi) => (
              <fieldset key={group.label} className="m-0 min-w-0 border-0 p-0">
                <legend
                  className={cn(
                    "px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
                    gi > 0 && "mt-1 block w-full border-t border-border/60 pt-1"
                  )}
                >
                  {group.label}
                </legend>
                <div className="flex flex-col gap-0.5">
                  {group.tags.map((t) => {
                    const id = `${optionIdPrefix}-${encodeURIComponent(t).replace(/%/g, "")}`;
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
              </fieldset>
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
