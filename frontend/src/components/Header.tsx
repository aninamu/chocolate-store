"use client";

import { Heart, Menu, Package, ShoppingCart } from "lucide-react";
import Image from "next/image";
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
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Image
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=64&q=80"
            width={32}
            height={32}
            alt=""
            className="rounded-sm"
          />
          <span className="text-lg">chocolate.store</span>
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
          <Link className={buttonVariants()} href="/shop">
            Browse
          </Link>
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
        <div className="border-t bg-card px-4 py-2 md:hidden">
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
    <footer className="mt-20 border-t py-8 text-sm text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4">
        <p className="flex items-center gap-2">
          <Package className="size-4" /> Local demo: FastAPI, Postgres, Redis, Next.js.
        </p>
        <p className="mt-1 flex items-center gap-2">
          <Heart className="size-4" />
          Add items to the cart, save for later, or place a mock order—no sign-in.
        </p>
      </div>
    </footer>
  );
}
