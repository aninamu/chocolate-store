"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fetchChocolates } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { buttonVariants, Button } from "@/components/ui/button";
import { useShop } from "@/context/shop-state";

export default function CartPage() {
  const router = useRouter();
  const { cart, setQty, removeFromCart, clearCart } = useShop();
  const { data: products, isLoading } = useQuery({
    queryKey: ["chocolates", "all"],
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
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Cart</h1>
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/shop"
          className={buttonVariants({ variant: "secondary", className: "mt-4" })}
        >
          Browse chocolates
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Cart</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Totals are recomputed on the server at checkout; prices always come from the API.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading product details…</p>
      ) : null}
      <ul className="divide-y rounded-lg border">
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
            <li key={l.chocolateId} className="flex flex-wrap items-center gap-4 p-4">
              <Image
                src={p.image_url}
                width={80}
                height={80}
                alt=""
                className="h-20 w-20 rounded object-cover"
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
                  className="h-9 w-20 rounded border border-input bg-background px-2"
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
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Subtotal</p>
          <p className="text-2xl font-semibold">{formatPrice(subtotal)}</p>
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
