"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useShop } from "@/context/shop-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MAX_QTY = 99;

type Props = {
  chocolateId: string;
  productName: string;
  inStock: boolean;
  isReady: boolean;
  /** Card grid: compact Add + stepper. Detail page: large CTA. */
  size: "sm" | "lg";
  className?: string;
};

export function AddToCartControl({
  chocolateId,
  productName,
  inStock,
  isReady,
  size,
  className,
}: Props) {
  const { cart, addToCart, setQty } = useShop();

  const qty = useMemo(
    () => cart.find((l) => l.chocolateId === chocolateId)?.quantity ?? 0,
    [cart, chocolateId]
  );

  const addDisabled = !inStock || !isReady;
  const canIncrement = qty < MAX_QTY;

  if (qty === 0) {
    return (
      <Button
        type="button"
        className={cn(size === "sm" && "flex-1", className)}
        size={size === "sm" ? "sm" : "lg"}
        disabled={addDisabled}
        onClick={() => {
          addToCart(chocolateId, 1);
          toast("Added to cart", {
            description: productName,
            position: "bottom-left",
          });
        }}
      >
        <ShoppingCart className="size-4" />
        <span className={size === "sm" ? "ml-1.5" : "ml-2"}>
          {size === "sm" ? "Add" : "Add to cart"}
        </span>
      </Button>
    );
  }

  const iconSize = size === "sm" ? "icon-sm" : "icon-lg";
  const stepperClass =
    size === "sm"
      ? "h-7 min-h-7 rounded-[min(var(--radius-md),12px)]"
      : "h-9 min-h-9 rounded-lg";

  return (
    <div
      className={cn(
        "flex items-stretch gap-1 rounded-lg border border-border/80 bg-card/40 p-0.5 shadow-sm backdrop-blur-sm dark:border-input dark:bg-card/30",
        stepperClass,
        size === "sm" && "flex-1",
        className
      )}
      role="group"
      aria-label={`Quantity in cart: ${qty}`}
    >
      <Button
        type="button"
        variant="outline"
        size={iconSize}
        className="shrink-0 border-transparent bg-transparent shadow-none hover:bg-muted/80"
        aria-label="Decrease quantity"
        disabled={!isReady}
        onClick={() => setQty(chocolateId, qty - 1)}
      >
        <Minus className="size-4" />
      </Button>
      <span
        className={cn(
          "flex min-w-8 flex-1 items-center justify-center tabular-nums font-medium text-foreground",
          size === "sm" ? "text-[0.8rem]" : "text-sm"
        )}
        aria-live="polite"
      >
        {qty}
      </span>
      <Button
        type="button"
        variant="outline"
        size={iconSize}
        className="shrink-0 border-transparent bg-transparent shadow-none hover:bg-muted/80"
        aria-label="Increase quantity"
        disabled={!isReady || !canIncrement}
        onClick={() => setQty(chocolateId, Math.min(MAX_QTY, qty + 1))}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
