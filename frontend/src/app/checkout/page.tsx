"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import Link from "next/link";

import { postCheckout, fetchChocolates } from "@/lib/api";
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
      <div>
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="mt-2 text-muted-foreground">Your cart is empty.</p>
        <Link
          href="/shop"
          className={buttonVariants({ variant: "secondary", className: "mt-4" })}
        >
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Mock checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        No real payment. We store an order in Postgres for the demo.
      </p>
      <p className="mt-2 text-sm">
        Subtotal: <span className="font-medium">{isLoading ? "…" : formatPrice(subtotal)}</span>
      </p>
      <form
        className="mt-6 max-w-md space-y-4"
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
          {m.isPending ? "Placing order…" : "Place order (mock payment)"}
        </Button>
      </form>
    </div>
  );
}
