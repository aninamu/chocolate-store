"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { fetchCartChocolates, postCheckout } from "@/lib/api";
import { buttonVariants, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShop } from "@/context/shop-state";
import { formatPrice } from "@/lib/format";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart, isReady } = useShop();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const cartIds = useMemo(() => cart.map((l) => l.chocolateId), [cart]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["chocolates", "cart", cartIds],
    queryFn: () => fetchCartChocolates(cartIds),
    enabled: cart.length > 0,
  });
  const byId = new Map(products?.map((p) => [p.id, p]) ?? []);
  const subtotal = cart.reduce((sum, l) => {
    const p = byId.get(l.chocolateId);
    return p ? sum + p.price_cents * l.quantity : sum;
  }, 0);

  const m = useMutation({
    mutationFn: postCheckout,
    onSuccess: (res) => {
      clearCart();
      router.push(
        `/checkout/success?order_id=${res.order_id}&total=${res.total_cents}`
      );
    },
    onError: (e: Error) => {
      toast.error("Checkout failed", { description: e.message });
    },
  });

  if (!isReady) {
    return <p className="text-sm text-muted-foreground">Preparing…</p>;
  }

  if (cart.length === 0) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/50 p-8 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05] sm:p-10">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-3 text-sm text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/shop"
          className={buttonVariants({ className: "mt-6" })}
        >
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Checkout</h1>
      <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm dark:bg-muted/25">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="font-heading font-semibold tabular-nums text-foreground">
          {isLoading ? "…" : formatPrice(subtotal)}
        </span>
      </p>
      <form
        className="mt-8 max-w-md space-y-5 rounded-xl border border-border/70 bg-card/60 p-6 shadow-sm ring-1 ring-black/[0.04] dark:bg-card/40 dark:ring-white/[0.06] sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({
            customer_name: name.trim(),
            customer_email: email.trim(),
            items: cart.map((l) => ({
              chocolate_id: l.chocolateId,
              quantity: l.quantity,
            })),
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <Button type="submit" disabled={m.isPending}>
          {m.isPending ? "Placing order…" : "Place order"}
        </Button>
      </form>
    </div>
  );
}
