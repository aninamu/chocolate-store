import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "jest-axe";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CheckoutPageClient } from "@/app/checkout/checkout-page-client";
import { CartDrawer } from "@/components/CartDrawer";
import { ChocolateCard } from "@/components/ChocolateCard";
import { Header } from "@/components/Header";
import { ShopProvider } from "@/context/shop-state";
import type { Chocolate } from "@/lib/types";

async function assertNoAxeViolations(container: Element) {
  const result = await axe(container, {
    rules: {
      // Isolated components are not full pages; landmark wrapping is optional in tests.
      region: { enabled: false },
    },
  });
  const violations = result.violations.filter((v) => {
    if (v.id !== "aria-command-name") return true;
    const onlyFocusGuards = v.nodes.every((n) =>
      n.html.includes("data-base-ui-focus-guard")
    );
    return !onlyFocusGuards;
  });
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/shop",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string; fill?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
  toastError: vi.fn(),
}));

const sampleChocolate: Chocolate = {
  id: "c-sample",
  name: "Sample Bar",
  slug: "sample-bar",
  description: "A smooth dark chocolate for testing.",
  origin: "Peru",
  cacao_percentage: 72,
  price_cents: 1299,
  image_url: "https://images.unsplash.com/photo-1606312619070-d48b4bdc5b4c",
  tags: ["dark", "single-origin"],
  in_stock: true,
  created_at: "2024-01-01T00:00:00Z",
};

function chocolatesFetchImpl(input: RequestInfo | URL) {
  const u =
    typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : input.href;
  if (u.includes("/api/chocolates")) {
    return Promise.resolve(
      new Response(JSON.stringify([sampleChocolate]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
  return Promise.resolve(new Response("{}", { status: 200 }));
}

function AppShell({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <ShopProvider>{children}</ShopProvider>
    </QueryClientProvider>
  );
}

describe("accessibility (jest-axe)", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(chocolatesFetchImpl);
  });

  it("Header", async () => {
    const { baseElement } = render(
      <AppShell>
        <Header />
      </AppShell>
    );
    await assertNoAxeViolations(baseElement);
  });

  it("ChocolateCard", async () => {
    const { baseElement } = render(
      <AppShell>
        <main>
          <ChocolateCard chocolate={sampleChocolate} />
        </main>
      </AppShell>
    );
    await assertNoAxeViolations(baseElement);
  });

  it("CartDrawer when open with a cart line", async () => {
    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([{ chocolateId: "c-sample", quantity: 2 }])
    );
    const { baseElement } = render(
      <AppShell>
        <CartDrawer open onOpenChange={() => {}} />
      </AppShell>
    );
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    await assertNoAxeViolations(baseElement);
  });

  it("Checkout form when cart has items", async () => {
    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([{ chocolateId: "c-sample", quantity: 1 }])
    );
    const { baseElement } = render(
      <AppShell>
        <main>
          <CheckoutPageClient />
        </main>
      </AppShell>
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    });
    await assertNoAxeViolations(baseElement);
  });
});
