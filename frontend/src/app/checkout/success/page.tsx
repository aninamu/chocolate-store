"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { formatPrice } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";

function SuccessInner() {
  const sp = useSearchParams();
  const orderId = sp.get("order_id");
  const totalCents = sp.get("total");

  const total = totalCents != null && totalCents !== "" ? parseInt(totalCents, 10) : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Order placed</h1>
      <p className="mt-2 text-muted-foreground">
        Your mock order is in the database. You can query it with{" "}
        <code className="rounded bg-muted px-1 text-sm">make psql</code> from the repo root.
      </p>
      {orderId ? (
        <p className="mt-3 text-sm">
          Order id: <code className="rounded bg-muted px-1">{orderId}</code>
        </p>
      ) : null}
      {total != null && !Number.isNaN(total) ? (
        <p className="mt-1 text-sm">
          Total: <span className="font-medium">{formatPrice(total)}</span>
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className={buttonVariants({ className: "inline-flex" })}
          href="/shop"
        >
          Keep shopping
        </Link>
        <Link
          className={buttonVariants({ variant: "secondary", className: "inline-flex" })}
          href="/"
        >
          Home
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
    >
      <SuccessInner />
    </Suspense>
  );
}
