"use client";

import { Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { Chocolate } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { AddToCartControl } from "@/components/AddToCartControl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useShop } from "@/context/shop-state";

type Props = {
  chocolate: Chocolate;
  showQuote?: boolean;
};

const CHURRITO_QUOTE_FALLBACK =
  "Whatever you pick, it's a treat worth wagging for - chocolatier's honor!";

export function ChocolateCard({ chocolate: c, showQuote = false }: Props) {
  const { toggleSaved, isSaved, isReady } = useShop();
  const saved = isSaved(c.id);

  return (
    <Card className="group overflow-hidden transition-shadow duration-300 hover:shadow-md">
      <CardHeader className="p-0">
        <Link href={`/shop/${c.id}`} className="block">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
            <Image
              src={c.image_url}
              alt={c.name}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, 25vw"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-80 dark:from-black/40"
              aria-hidden
            />
            {showQuote ? (
              <div
                className="pointer-events-none absolute inset-x-2 top-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
                aria-hidden
              >
                <div className="relative flex items-center gap-2 rounded-lg border bg-popover px-2.5 py-2 text-popover-foreground shadow-md">
                  <Image
                    src="/churrito-logo.png"
                    alt="Churrito"
                    width={40}
                    height={40}
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                  <p className="my-0 flex flex-1 items-center text-xs leading-snug text-popover-foreground">
                    {c.churrito_quote ?? CHURRITO_QUOTE_FALLBACK}
                  </p>
                  <span
                    className="absolute -bottom-1.5 left-6 size-3 rotate-45 border-b border-r bg-popover"
                    aria-hidden
                  />
                </div>
              </div>
            ) : null}
          </div>
        </Link>
        <div className="p-3 pb-0">
          <Link
            href={`/shop/${c.id}`}
            className="line-clamp-1 font-heading font-medium text-foreground hover:underline"
          >
            {c.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {c.origin ?? "—"}
            {c.cacao_percentage != null && c.cacao_percentage > 0
              ? ` · ${c.cacao_percentage}%`
              : c.cacao_percentage === 0
                ? " · white"
                : null}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2">
        <div className="flex flex-wrap gap-1">
          {c.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="text-xs font-normal">
              {t}
            </Badge>
          ))}
        </div>
        <p className="mt-2 font-heading text-lg font-semibold tabular-nums text-foreground">
          {formatPrice(c.price_cents)}
        </p>
      </CardContent>
      <CardFooter className="flex gap-2 p-3">
        <AddToCartControl
          chocolateId={c.id}
          productName={c.name}
          inStock={c.in_stock}
          isReady={isReady}
          size="sm"
        />
        <Button
          type="button"
          size="icon"
          variant={saved ? "default" : "outline"}
          aria-label={saved ? "Unsave" : "Save for later"}
          onClick={() => toggleSaved(c.id)}
        >
          <Heart className={`size-4 ${saved ? "fill-current" : ""}`} />
        </Button>
      </CardFooter>
    </Card>
  );
}
