"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fetchChocolates } from "@/lib/api";
import { chocolateListQueryKey } from "@/lib/chocolate-catalog";
import { formatPrice } from "@/lib/format";
import { buttonVariants, Button } from "@/components/ui/button";
import { useShop } from "@/context/shop-state";

export default function CartPage() {
  const router = useRouter();
  const { cart, setQty, removeFromCart, clearCart } = useShop();
  const { data: products, isLoading } = useQuery({
    queryKey: chocolateListQueryKey(),
    queryFn: () => fetchChocolates(),
    enabled: cart.length > 0,
  });
  const byId = new Map(products?.map((p) => [p.id, p]) ?? []);
  const subtotal = cart.reduce((sum, l) => {
    const p = byId.get(l.chocolateId);
    return p ? sum + p.price_cents * l.quantity : sum;
  }, 0);

  if (cart.length === 0) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/50 p-8 text-center shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05] sm:p-10">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Your cart</h1>
        <p className="mt-3 text-sm text-muted-foreground">Nothing here yet — treat yourself from the shop.</p>
        <Link
          href="/shop"
          className={buttonVariants({ className: "mt-6" })}
        >
          Browse chocolates
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Cart</h1>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Totals are recomputed on the server at checkout; prices always come from the API.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading product details…</p>
      ) : null}
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        {cart.map((l) => {
          const p = byId.get(l.chocolateId);
          if (!p) {
            return (
              <li key={l.chocolateId} className="flex items-center justify-between p-4">
                <span className="text-sm">Unknown product</span>
                <Button type="button" variant="link" onClick={() => removeFromCart(l.chocolateId)}>
                  Remove
                </Button>
              </li>
            );
          }
          return (
            <li key={l.chocolateId} className="flex flex-wrap items-center gap-4 bg-card/40 p-4 transition-colors hover:bg-muted/20 dark:hover:bg-muted/10">
              <Image
                src={p.image_url}
                width={80}
                height={80}
                alt=""
                className="h-20 w-20 rounded-lg object-cover shadow-sm ring-1 ring-border/50"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  <Link className="hover:underline" href={`/shop/${p.id}`}>
                    {p.name}
                  </Link>
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(p.price_cents)} each
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={99}
                  className="h-9 w-20 rounded-lg border border-input bg-card/50 px-2 text-sm shadow-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:bg-input/20"
                  value={l.quantity}
                  onChange={(e) => setQty(l.chocolateId, Number(e.target.value) || 0)}
                />
                <Button type="button" variant="ghost" onClick={() => removeFromCart(l.chocolateId)}>
                  Remove
                </Button>
              </div>
              <p className="w-28 text-right font-medium">
                {formatPrice(p.price_cents * l.quantity)}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/70 bg-gradient-to-r from-muted/40 to-card/60 p-5 shadow-sm dark:from-muted/20 dark:to-card/40">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Subtotal</p>
          <p className="font-heading text-2xl font-semibold tabular-nums">{formatPrice(subtotal)}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={clearCart}>
            Clear
          </Button>
          <Button onClick={() => router.push("/checkout")}>Go to checkout</Button>
        </div>
      </div>
    </div>
  );
}
