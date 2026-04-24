"use client";

import { useQuery } from "@tanstack/react-query";
import { Heart, ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";

import { fetchChocolate } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useShop } from "@/context/shop-state";
import { toast } from "sonner";

export default function ProductDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const router = useRouter();
  const { addToCart, toggleSaved, isSaved, isReady } = useShop();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["chocolate", id],
    queryFn: () => fetchChocolate(id),
    enabled: Boolean(id),
  });
  const saved = data && isSaved(data.id);

  if (isError) {
    return (
      <div className="space-y-2">
        <p className="text-destructive">{(error as Error).message}</p>
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
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-2xl border">
        <Image
          src={c.image_url}
          alt={c.name}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{c.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {c.origin ? `${c.origin} · ` : null}
          {c.cacao_percentage != null
            ? c.cacao_percentage === 0
              ? "No cacao (white or spread)"
              : `${c.cacao_percentage}% cacao`
            : "Cacao n/a"}
        </p>
        <p className="mt-4 text-2xl font-semibold">{formatPrice(c.price_cents)}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {c.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
        <p className="mt-6 text-muted-foreground">{c.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            disabled={!c.in_stock || !isReady}
            onClick={() => {
              addToCart(c.id, 1);
              toast("Added to cart", { description: c.name });
            }}
          >
            <ShoppingCart className="size-4" />
            <span className="ml-2">Add to cart</span>
          </Button>
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
