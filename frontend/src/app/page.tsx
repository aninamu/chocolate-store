"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { fetchChocolates } from "@/lib/api";
import { chocolateListQueryKey } from "@/lib/chocolate-catalog";
import { ChocolateCard } from "@/components/ChocolateCard";
import { buttonVariants, Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: chocolateListQueryKey(),
    queryFn: () => fetchChocolates(),
  });
  const featured = data?.slice(0, 4) ?? [];

  return (
    <div>
      <section className="relative mb-12 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-accent/30 p-8 shadow-md ring-1 ring-black/[0.04] dark:from-card dark:via-card dark:to-primary/10 dark:ring-white/[0.06] sm:p-10">
        <div
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-12 size-56 rounded-full bg-secondary/60 blur-2xl dark:bg-secondary/30"
          aria-hidden
        />
        <div className="relative">
          <p className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary dark:border-primary/30 dark:bg-primary/15">
            New spring collection
          </p>
          <h1 className="mt-4 max-w-3xl font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.35rem] md:leading-tight">
            Single-origin chocolate, delivered to your door
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Small-batch bars and truffles from growers in Peru, Madagascar, and Ecuador.
            Ethically sourced, freshly made, and shipped within 48 hours of leaving the kitchen.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className={buttonVariants({ size: "lg", className: "min-h-10 px-5" })}
              href="/shop"
            >
              Shop <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        </div>
      </section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Featured</h2>
          <p className="mt-1 text-sm text-muted-foreground">Staff picks from this week&apos;s kitchen</p>
        </div>
        <Link
          className={buttonVariants({ variant: "link", className: "h-auto p-0" })}
          href="/shop"
        >
          See all
        </Link>
      </div>
      {isError ? (
        <p className="text-sm text-destructive">
          {(error as Error).message}{" "}
          <Button variant="link" onClick={() => void refetch()}>
            Retry
          </Button>
        </p>
      ) : isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((c) => (
            <ChocolateCard key={c.id} chocolate={c} />
          ))}
        </div>
      )}
    </div>
  );
}
