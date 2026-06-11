"use client";

import { PartyPopper } from "lucide-react";
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
    <div className="max-w-xl">
      <div className="mb-6 inline-flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20 dark:bg-primary/25">
        <PartyPopper className="size-6" aria-hidden />
      </div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Order placed</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Your mock order is in the database. You can query it with{" "}
        <code className="rounded-md border border-border/60 bg-muted/80 px-1.5 py-0.5 text-sm font-medium text-foreground dark:bg-muted/50">
          make mongosh
        </code>{" "}
        from the repo root.
      </p>
      {orderId ? (
        <p className="mt-4 text-sm">
          Order id:{" "}
          <code className="rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 text-xs dark:bg-muted/40">
            {orderId}
          </code>
        </p>
      ) : null}
      {total != null && !Number.isNaN(total) ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Total:{" "}
          <span className="font-heading font-semibold tabular-nums text-foreground">{formatPrice(total)}</span>
        </p>
      ) : null}
      <div className="mt-10 flex flex-wrap gap-3">
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
