"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { chocolatesQueryKey, fetchChocolates } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { buttonVariants, Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useShop } from "@/context/shop-state";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

export function CartDrawer({ open, onOpenChange }: Props) {
  const { cart, setQty, removeFromCart, clearCart } = useShop();
  const { data: products, isLoading } = useQuery({
    queryKey: chocolatesQueryKey(),
    queryFn: () => fetchChocolates(),
    enabled: open && cart.length > 0,
  });

  const byId = new Map(products?.map((p) => [p.id, p]) ?? []);
  const subtotal = cart.reduce((sum, l) => {
    const p = byId.get(l.chocolateId);
    return p ? sum + p.price_cents * l.quantity : sum;
  }, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-md flex-col gap-0 border-l border-border/70 bg-gradient-to-b from-popover via-popover to-muted/25 shadow-xl dark:to-muted/15 sm:max-w-md">
        <SheetHeader className="border-b border-border/50 bg-muted/20 pb-4 dark:bg-muted/10">
          <SheetTitle>Your cart</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-1 py-4">
          {isLoading && cart.length > 0 ? (
            <p className="text-sm text-muted-foreground">Loading products…</p>
          ) : null}
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            cart.map((l) => {
              const p = byId.get(l.chocolateId);
              return (
                <div
                  key={l.chocolateId}
                  className="flex gap-3 rounded-lg border-b border-border/50 pb-3 last:border-0"
                >
                  {p ? (
                    <Image
                      src={p.image_url}
                      width={64}
                      height={64}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover shadow-sm ring-1 ring-border/50"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p?.name ?? "…"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p ? formatPrice(p.price_cents) : "—"} each
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        className="h-8 w-16 rounded-lg border border-input bg-card/50 px-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/20"
                        value={l.quantity}
                        onChange={(e) =>
                          setQty(l.chocolateId, Number(e.target.value) || 0)
                        }
                        aria-label="Quantity"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeFromCart(l.chocolateId)}
                        aria-label="Remove"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {cart.length > 0 ? (
          <div className="mt-auto space-y-3 border-t border-border/60 bg-muted/25 px-1 py-4 dark:bg-muted/10">
            <p className="text-sm text-muted-foreground">
              Subtotal <span className="float-right font-medium text-foreground">
                {formatPrice(subtotal)}
              </span>
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={clearCart}>
                Clear
              </Button>
              <Link
                href="/checkout"
                className={buttonVariants({ className: "flex-1" })}
                onClick={() => onOpenChange(false)}
              >
                Checkout <ArrowRight className="ml-1 size-4" />
              </Link>
            </div>
            <Link
              href="/cart"
              className={buttonVariants({
                variant: "link",
                className: "h-auto w-full justify-start p-0",
              })}
              onClick={() => onOpenChange(false)}
            >
              View full cart
            </Link>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
