import type { ReactNode } from "react";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartDrawer } from "@/components/CartDrawer";
import { renderWithProviders } from "@/test/render";
import type { Chocolate } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    ...rest
  }: {
    alt?: string;
    src?: string;
    [key: string]: unknown;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ""} src={typeof src === "string" ? src : undefined} {...rest} />
  ),
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

const fetchChocolatesMock = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchChocolates: (...args: unknown[]) => fetchChocolatesMock(...args),
}));

const PRODUCT: Chocolate = {
  id: "drawer-1",
  name: "Hazelnut Praline",
  slug: "hazelnut-praline",
  description: "Nutty and smooth",
  origin: "Switzerland",
  cacao_percentage: 55,
  price_cents: 1100,
  image_url: "https://example.com/hazelnut.jpg",
  tags: ["milk"],
  in_stock: true,
  created_at: "2026-01-01T00:00:00Z",
  churrito_quote: null,
};

describe("CartDrawer", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    fetchChocolatesMock.mockReset();
    fetchChocolatesMock.mockResolvedValue([PRODUCT]);
  });

  it("shows empty state when cart has no items", () => {
    renderWithProviders(<CartDrawer open onOpenChange={vi.fn()} />);

    expect(screen.getByText("No items yet.")).toBeInTheDocument();
  });

  it("loads products and shows subtotal for cart lines", async () => {
    renderWithProviders(<CartDrawer open onOpenChange={vi.fn()} />, {
      seedLocalStorage: {
        cart: [{ chocolateId: "drawer-1", quantity: 2 }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Hazelnut Praline")).toBeInTheDocument();
    });
    expect(fetchChocolatesMock).toHaveBeenCalled();
    expect(screen.getByText("$22.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /checkout/i })).toHaveAttribute(
      "href",
      "/checkout"
    );
  });

  it("clears cart from the drawer footer", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CartDrawer open onOpenChange={vi.fn()} />, {
      seedLocalStorage: {
        cart: [{ chocolateId: "drawer-1", quantity: 1 }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Hazelnut Praline")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^clear$/i }));

    await waitFor(() => {
      expect(localStorage.getItem("cs.cart.v1")).toBe("[]");
    });
  });
});
