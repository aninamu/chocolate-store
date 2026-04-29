"use client";

import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";

import { fetchChocolate } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { AddToCartControl } from "@/components/AddToCartControl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useShop } from "@/context/shop-state";

export default function ProductDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const router = useRouter();
  const { toggleSaved, isSaved, isReady } = useShop();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["chocolate", id],
    queryFn: () => fetchChocolate(id),
    enabled: Boolean(id),
  });
  const saved = data && isSaved(data.id);

  if (isError) {
    return (
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          We could not load this chocolate
        </h1>
        <p role="alert" className="text-destructive">{(error as Error).message}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="link" onClick={() => void refetch()}>
            Retry
          </Button>
          <Button variant="outline" onClick={() => router.push("/shop")}>
            Back to shop
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  const c = data;
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-muted shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <Image
          src={c.image_url}
          alt={c.name}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </div>
      <div className="flex flex-col">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-[2rem]">{c.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {c.origin ? `${c.origin} · ` : null}
          {c.cacao_percentage != null
            ? c.cacao_percentage === 0
              ? "No cacao (white or spread)"
              : `${c.cacao_percentage}% cacao`
            : "Cacao n/a"}
        </p>
        <p className="mt-4 font-heading text-2xl font-semibold tabular-nums">{formatPrice(c.price_cents)}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
        <p className="mt-6 max-w-prose leading-relaxed text-muted-foreground">{c.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <AddToCartControl
            chocolateId={c.id}
            productName={c.name}
            inStock={c.in_stock}
            isReady={isReady}
            size="lg"
          />
          <Button
            type="button"
            size="lg"
            variant={saved ? "default" : "outline"}
            onClick={() => toggleSaved(c.id)}
          >
            <Heart className={`size-4 ${saved ? "fill-current" : ""}`} />
            <span className="ml-2">{saved ? "Saved" : "Save for later"}</span>
          </Button>
        </div>
        {!c.in_stock ? (
          <p className="mt-4 text-sm text-destructive">Currently out of stock.</p>
        ) : null}
        <div className="mt-6">
          <Button variant="link" className="h-auto p-0" onClick={() => router.push("/shop")}>
            Back to shop
          </Button>
        </div>
      </div>
    </div>
  );
}
