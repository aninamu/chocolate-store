import type { ReactNode } from "react";
import { cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChocolateCard } from "@/components/ChocolateCard";
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

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

const CHOCOLATE: Chocolate = {
  id: "card-1",
  name: "Sea Salt Caramel",
  slug: "sea-salt-caramel",
  description: "Sweet and salty",
  origin: "Belgium",
  cacao_percentage: 45,
  price_cents: 950,
  image_url: "https://example.com/caramel.jpg",
  tags: ["milk", "caramel"],
  in_stock: true,
  created_at: "2026-01-01T00:00:00Z",
  churrito_quote: "Tail-wagging good.",
};

const OUT_OF_STOCK: Chocolate = {
  ...CHOCOLATE,
  id: "card-oos",
  name: "Sold Out Bar",
  in_stock: false,
};

describe("ChocolateCard", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("links to the product page and shows price", async () => {
    const { container } = renderWithProviders(<ChocolateCard chocolate={CHOCOLATE} />);
    const view = within(container);

    await waitFor(() => {
      const links = view.getAllByRole("link", { name: CHOCOLATE.name });
      expect(links.length).toBeGreaterThanOrEqual(1);
      for (const link of links) {
        expect(link).toHaveAttribute("href", `/shop/${CHOCOLATE.id}`);
      }
    });
    expect(view.getByText("$9.50")).toBeInTheDocument();
    expect(view.getByText("milk")).toBeInTheDocument();
  });

  it("toggles saved state", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<ChocolateCard chocolate={CHOCOLATE} />);
    const view = within(container);

    await waitFor(() => {
      expect(
        view.getAllByRole("button", { name: /save for later/i })[0]
      ).toBeEnabled();
    });

    await user.click(view.getAllByRole("button", { name: /save for later/i })[0]!);

    await waitFor(() => {
      expect(view.getAllByRole("button", { name: /unsave/i })[0]).toBeInTheDocument();
    });
    expect(JSON.parse(localStorage.getItem("cs.saved.v1") || "[]")).toEqual([
      CHOCOLATE.id,
    ]);
  });

  it("disables add when out of stock", async () => {
    const { container } = renderWithProviders(<ChocolateCard chocolate={OUT_OF_STOCK} />);
    const view = within(container);

    await waitFor(() => {
      for (const add of view.getAllByRole("button", { name: /add/i })) {
        expect(add).toBeDisabled();
      }
    });
  });
});
