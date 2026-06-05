"use client";

import { Heart, Menu, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { buttonVariants, Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/CartDrawer";
import { useShop } from "@/context/shop-state";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/saved", label: "Saved" },
  { href: "/cart", label: "Cart" },
];

export function Header() {
  const { cart } = useShop();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const count = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-card/85 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/70 dark:border-border dark:bg-card/80 dark:supports-[backdrop-filter]:bg-card/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <Image
            src="/churrito-logo.png"
            alt="Churrito the Pomeranian, founder of Churrito's Chocolates"
            width={40}
            height={40}
            priority
            className="size-10 shrink-0 rounded-full object-cover ring-1 ring-border/60 dark:ring-border"
          />
          <span className="text-lg font-semibold tracking-tight">Churrito&apos;s Chocolates</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              className={buttonVariants({ variant: "ghost" })}
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
            className="relative md:hidden"
            onClick={() => setMobile((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="size-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="relative"
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
        <div className="border-t border-border/60 bg-muted/40 px-4 py-2 md:hidden dark:bg-muted/20">
          <div className="mx-auto flex max-w-6xl flex-col">
            {links.map((l) => (
              <Link
                key={l.href}
                className={buttonVariants({ variant: "ghost", className: "justify-start" })}
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
          <Image
            src="/churrito-logo.png"
            alt="Churrito's Chocolates mascot"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-border/60 dark:ring-border"
          />
          <span className="max-w-md leading-relaxed">
            Free shipping on orders over $50 · Ships within 2 business days
          </span>
        </p>
        <p className="flex items-center gap-2.5 sm:text-right">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border/60 dark:ring-border sm:order-last">
            <Heart className="size-4" />
          </span>
          <span className="max-w-md leading-relaxed">
            Handcrafted in small batches · © {new Date().getFullYear()} Churrito&apos;s Chocolates
          </span>
        </p>
      </div>
    </footer>
  );
}
