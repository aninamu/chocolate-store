import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CartPage from "@/app/cart/page";
import type { Chocolate } from "@/lib/types";
import { ShopProvider } from "@/context/shop-state";
import * as api from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const product: Chocolate = {
  id: "c-test-1",
  name: "Test Bar Deluxe",
  slug: "test-bar",
  description: "A test chocolate.",
  origin: "Testland",
  cacao_percentage: 70,
  price_cents: 500,
  image_url: "https://example.com/img.jpg",
  tags: ["dark"],
  in_stock: true,
  created_at: "2024-01-01",
};

describe("CartPage accessibility", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.spyOn(api, "fetchChocolates").mockResolvedValue([product]);
    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([{ chocolateId: product.id, quantity: 2 }]),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    client.clear();
  });

  it("quantity inputs have accessible names including product titles", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <ShopProvider>
          <CartPage />
        </ShopProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(api.fetchChocolates).toHaveBeenCalled();
    });

    const spin = await screen.findByRole("spinbutton", {
      name: new RegExp(`Quantity for ${product.name}`, "i"),
    });

    await user.clear(spin);
    await user.type(spin, "3");

    expect(spin).toHaveAttribute("aria-label", `Quantity for ${product.name}`);
  });

  it("Remove buttons expose product-specific labels", async () => {
    render(
      <QueryClientProvider client={client}>
        <ShopProvider>
          <CartPage />
        </ShopProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(api.fetchChocolates).toHaveBeenCalled();
    });

    await screen.findByText(product.name);

    expect(
      screen.getByRole("button", {
        name: `Remove ${product.name} from cart`,
      }),
    ).toBeInTheDocument();
  });
});
