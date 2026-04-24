"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { fetchChocolates } from "@/lib/api";
import { ChocolateCard } from "@/components/ChocolateCard";
import { buttonVariants, Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["chocolates", "all"],
    queryFn: () => fetchChocolates(),
  });
  const featured = data?.slice(0, 4) ?? [];

  return (
    <div>
      <section className="mb-12 rounded-2xl border bg-card/60 p-8">
        <p className="text-sm font-medium text-primary">Cursor field demo</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          A real marketplace flow—browsing, a cart, saved items, and a mock checkout
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Next.js, FastAPI, Postgres, and Redis, all in dev with hot reload. No accounts,
          so cart and wishlist live in your browser. Change code and see it update live.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className={buttonVariants({ size: "lg" })}
            href="/shop"
          >
            Open shop <ArrowRight className="ml-1 size-4" />
          </Link>
          <a
            className={buttonVariants({ size: "lg", variant: "secondary" })}
            href="http://127.0.0.1:8000/api/health"
            target="_blank"
            rel="noreferrer"
          >
            API health
          </a>
        </div>
      </section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-xl font-semibold">Featured</h2>
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
