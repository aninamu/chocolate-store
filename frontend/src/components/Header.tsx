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
    <header className="sticky top-0 z-50 border-b border-border/80 bg-card/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/90 dark:border-border/80 dark:bg-card/90 dark:supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 font-mono">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <span className="rounded-sm border border-primary/45 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary dark:bg-primary/25">
            [EST. 2024]
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground/95">
            <span className="text-primary">{">"}</span> CHOCOLATE_STORE
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              className={buttonVariants({
                variant: "ghost",
                className: "font-mono text-xs tracking-widest uppercase",
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
            className="relative md:hidden border-primary/30 bg-card/80 hover:bg-primary/10"
            onClick={() => setMobile((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="size-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="relative border border-primary/30 bg-card/80 hover:bg-primary/10"
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
          >
            <ShoppingCart className="size-4" />
            {count > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
          </Button>
        </div>
      </div>
      {mobile ? (
        <div className="border-t border-border/60 bg-muted/25 px-4 py-2 md:hidden dark:bg-muted/20">
          <div className="mx-auto flex max-w-6xl flex-col">
            {links.map((l) => (
              <Link
                key={l.href}
                className={buttonVariants({
                  variant: "ghost",
                  className: "justify-start font-mono text-xs tracking-widest uppercase",
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
