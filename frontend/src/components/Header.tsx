"use client";

import { ChevronDown, Heart, Menu, Package, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CartDrawer } from "@/components/CartDrawer";
import { useShop } from "@/context/shop-state";

const links = [
  { href: "/shop", label: "Shop", chevron: true },
  { href: "/saved", label: "Saved" },
  { href: "/cart", label: "Cart" },
] as const;

/** Grafana marketing site–style sticky top bar (dark navy, light links, orange accent CTAs). */
export function Header() {
  const pathname = usePathname();
  const { cart } = useShop();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const count = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <header className="sticky top-0 z-50 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-sm">
      <div
        aria-hidden
        className="h-px w-full shrink-0 bg-gradient-to-r from-transparent via-[#f54e00]/50 to-transparent opacity-90"
      />
      <div className="border-b border-white/[0.08] bg-[#111722] supports-[backdrop-filter]:bg-[#111722]/96">
        <div className="mx-auto flex h-[52px] max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:h-14 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 text-white transition-opacity hover:opacity-92"
          >
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-md bg-[#1f2837] shadow-inner ring-1 ring-white/[0.06]"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#f54e00]"
              >
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" opacity="0.35" />
                <path
                  d="M8 17c3-7 13-7 16 0-2.5 3.5-5 6-8 9-3-3-5.5-5.5-8-9z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline sm:text-[15px]">
              Chocolate Store
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex lg:justify-center xl:absolute xl:left-1/2 xl:top-1/2 xl:z-10 xl:-translate-x-1/2 xl:-translate-y-1/2">
            {links.map((l) => {
              const active =
                pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-3 py-2 text-[13px] font-medium text-[#b8c2cc] outline-none transition-colors",
                    "hover:bg-white/[0.06] hover:text-[#e9eef2]",
                    active && "bg-white/[0.07] text-[#e9eef2]",
                  )}
                >
                  <span>{l.label}</span>
                  {"chevron" in l && l.chevron ? (
                    <ChevronDown className="size-3.5 opacity-70" strokeWidth={2} aria-hidden />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="relative border-[#374151] bg-transparent text-white shadow-none backdrop-blur-sm hover:bg-white/[0.06] hover:text-white md:hidden"
              onClick={() => setMobile((v) => !v)}
              aria-label="Menu"
              aria-expanded={mobile}
            >
              <Menu className="size-[18px]" />
            </Button>
            <Link
              href="/shop"
              className={cn(
                buttonVariants({ variant: "default", size: "sm", className: "hidden xl:inline-flex" }),
                "h-9 border-0 bg-[#f54e00] px-4 text-[13px] font-semibold tracking-tight text-white shadow-none hover:bg-[#ff6a24] hover:shadow-md focus-visible:ring-[#f54e00]/35",
              )}
            >
              Browse shop
            </Link>
            <Button
              type="button"
              variant="outline"
              className="relative h-9 shrink-0 border-[#363f4f] bg-[#171d28] px-3 text-[13px] font-medium text-white shadow-none backdrop-blur-sm hover:bg-[#1f2837] hover:text-white"
              onClick={() => setCartOpen(true)}
              aria-label="Open cart"
            >
              <ShoppingCart className="size-[18px]" />
              {count > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-w-[1.125rem] items-center justify-center rounded-full bg-[#f54e00] px-1 text-[10px] font-bold leading-none text-white">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </div>

      {mobile ? (
        <div className="border-b border-[#252d3d] bg-[#0d1219] px-4 py-3 lg:hidden">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-0.5">
            {links.map((l) => {
              const active =
                pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-[15px] font-medium text-[#e9eef2] hover:bg-white/[0.06]",
                    active && "bg-white/[0.07]",
                  )}
                  onClick={() => setMobile(false)}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link
              href="/shop"
              className={cn(
                buttonVariants({ variant: "default" }),
                "mt-2 h-10 w-full bg-[#f54e00] text-white hover:bg-[#ff6a24]",
              )}
              onClick={() => setMobile(false)}
            >
              Browse shop
            </Link>
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
