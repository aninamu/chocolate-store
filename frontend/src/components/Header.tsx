"use client";

import { Heart, Menu, Package, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { buttonVariants, Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/CartDrawer";
import { useShop } from "@/context/shop-state";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/saved", label: "Saved" },
  { href: "/cart", label: "Cart" },
];

export function Header() {
  const { cart } = useShop();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const count = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <header className="sticky top-0 z-50 overflow-hidden border-b-4 border-[#5a321a] bg-[#ffe8a8] shadow-[0_6px_0_#a95f2a,0_16px_28px_rgba(90,50,26,0.18)] dark:border-[#f4c86a] dark:bg-[#362215] dark:shadow-[0_6px_0_#120a06,0_16px_28px_rgba(0,0,0,0.38)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-[radial-gradient(circle_at_18px_0,#7a3f1d_0_12px,transparent_13px),radial-gradient(circle_at_58px_0,#7a3f1d_0_8px,transparent_9px)] bg-[length:86px_14px] opacity-80 dark:bg-[radial-gradient(circle_at_18px_0,#f4c86a_0_12px,transparent_13px),radial-gradient(circle_at_58px_0,#f4c86a_0_8px,transparent_9px)]" />
      <div className="relative mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="group flex items-center gap-3 font-semibold tracking-tight text-[#3d2518] transition-transform hover:-rotate-1 hover:scale-[1.02] dark:text-[#fff2c6]"
        >
          <span className="-rotate-3 rounded-full border-2 border-[#5a321a] bg-[#fff7d1] px-2.5 py-1 text-xs font-black uppercase tracking-widest text-[#7a3f1d] shadow-[3px_3px_0_#d6903d] transition-transform group-hover:-rotate-6 dark:border-[#f4c86a] dark:bg-[#52311b] dark:text-[#ffe8a8] dark:shadow-[3px_3px_0_#120a06]">
            Est. 2024
          </span>
          <span className="text-xl font-black tracking-[-0.04em] drop-shadow-[2px_2px_0_rgba(255,255,255,0.85)] dark:drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)]">
            Chocolate Store
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              className={buttonVariants({
                variant: "ghost",
                className:
                  "rounded-full border-2 border-[#5a321a] bg-[#fff8dd] px-4 font-black text-[#3d2518] shadow-[3px_3px_0_#c97732] transition-transform hover:-translate-y-0.5 hover:bg-white hover:shadow-[4px_4px_0_#c97732] dark:border-[#f4c86a] dark:bg-[#52311b] dark:text-[#fff2c6] dark:shadow-[3px_3px_0_#120a06] dark:hover:bg-[#6a3c1d] dark:hover:shadow-[4px_4px_0_#120a06]",
              })}
              href={l.href}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="relative rounded-full border-2 border-[#5a321a] bg-[#fff8dd] text-[#3d2518] shadow-[3px_3px_0_#c97732] hover:bg-white dark:border-[#f4c86a] dark:bg-[#52311b] dark:text-[#fff2c6] dark:shadow-[3px_3px_0_#120a06] md:hidden"
            onClick={() => setMobile((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="size-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="relative rounded-full border-2 border-[#5a321a] bg-[#fff8dd] text-[#3d2518] shadow-[3px_3px_0_#c97732] transition-transform hover:-rotate-3 hover:-translate-y-0.5 hover:bg-white dark:border-[#f4c86a] dark:bg-[#52311b] dark:text-[#fff2c6] dark:shadow-[3px_3px_0_#120a06]"
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
          >
            <ShoppingCart className="size-4" />
            {count > 0 ? (
              <span className="absolute -right-2 -top-2 flex size-6 rotate-12 items-center justify-center rounded-full border-2 border-[#5a321a] bg-[#b7662d] text-xs font-black text-white shadow-[2px_2px_0_#3d2518] dark:border-[#f4c86a] dark:bg-[#f4c86a] dark:text-[#24150c] dark:shadow-[2px_2px_0_#120a06]">
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
          </Button>
        </div>
      </div>
      {mobile ? (
        <div className="border-t-4 border-[#5a321a] bg-[#fff2bd] px-4 py-3 md:hidden dark:border-[#f4c86a] dark:bg-[#2a190f]">
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                className={buttonVariants({
                  variant: "ghost",
                  className:
                    "justify-start rounded-full border-2 border-[#5a321a] bg-[#fff8dd] font-black text-[#3d2518] shadow-[3px_3px_0_#c97732] hover:bg-white dark:border-[#f4c86a] dark:bg-[#52311b] dark:text-[#fff2c6] dark:shadow-[3px_3px_0_#120a06]",
                })}
                href={l.href}
                onClick={() => setMobile(false)}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}

export function HomeFooter() {
  return (
    <footer className="mt-20 border-t border-border/70 bg-muted/30 py-10 text-sm text-muted-foreground dark:bg-muted/15">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border/60 dark:ring-border">
            <Package className="size-4" />
          </span>
          <span className="max-w-md leading-relaxed">
            Free shipping on orders over $50 · Ships within 2 business days
          </span>
        </p>
        <p className="flex items-center gap-2.5 sm:text-right">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border/60 dark:ring-border sm:order-last">
            <Heart className="size-4" />
          </span>
          <span className="max-w-md leading-relaxed">
            Handcrafted in small batches · © {new Date().getFullYear()} Chocolate Store
          </span>
        </p>
      </div>
    </footer>
  );
}
