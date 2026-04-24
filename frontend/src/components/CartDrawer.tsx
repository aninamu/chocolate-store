"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { fetchChocolates } from "@/lib/api";
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
    queryKey: ["chocolates", "all"],
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
      <SheetContent className="flex w-full max-w-md flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto py-4">
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
                  className="flex gap-3 border-b border-border/60 pb-3 last:border-0"
                >
                  {p ? (
                    <Image
                      src={p.image_url}
                      width={64}
                      height={64}
                      alt=""
                      className="h-16 w-16 rounded object-cover"
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
                        className="h-8 w-16 rounded border border-input bg-background px-2 text-sm"
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
          <div className="mt-auto space-y-3 border-t pt-4">
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
