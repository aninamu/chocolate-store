"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { fetchChocolates } from "@/lib/api";
import { ChocolateCard } from "@/components/ChocolateCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useShop } from "@/context/shop-state";
import { Button } from "@/components/ui/button";

export default function SavedPage() {
  const { saved, isReady } = useShop();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["chocolates", "all"],
    queryFn: () => fetchChocolates(),
  });

  const list = useMemo(() => {
    if (!data) return [];
    const set = new Set(saved);
    return data.filter((c) => set.has(c.id));
  }, [data, saved]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Saved for later</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Stored in your browser ({saved.length} id{saved.length === 1 ? "" : "s"}).{" "}
        {!isReady ? "Syncing local storage…" : null}
      </p>
      {isError ? (
        <p className="text-destructive">
          {(error as Error).message}{" "}
          <Button variant="link" onClick={() => void refetch()}>
            Retry
          </Button>
        </p>
      ) : isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing saved yet. Open a product and tap the heart.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <ChocolateCard key={c.id} chocolate={c} />
          ))}
        </div>
      )}
    </div>
  );
}
