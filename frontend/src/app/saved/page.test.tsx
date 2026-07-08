import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SavedPage from "@/app/saved/page";
import type { Chocolate } from "@/lib/types";

const { fixtures } = vi.hoisted(() => {
  const savedId = "00000000-0000-4000-8000-000000000001";
  const unsavedId = "00000000-0000-4000-8000-000000000002";
  const savedImageUrl =
    "https://images.unsplash.com/photo-1493925410384-84f842e616fb?w=600&q=80";

  const make = (id: string, name: string, imageUrl: string) => ({
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    description: "",
    origin: "Peru",
    cacao_percentage: 70,
    price_cents: 500,
    image_url: imageUrl,
    tags: ["dark"],
    in_stock: true,
    created_at: "2026-01-01T00:00:00.000Z",
    churrito_quote: null,
  });

  return {
    fixtures: {
      savedId,
      savedImageUrl,
      chocolates: [
        make(savedId, "Saved Bar", savedImageUrl),
        make(
          unsavedId,
          "Unsaved Bar",
          "https://images.unsplash.com/photo-1511381939415-e44015466834?w=600&q=80"
        ),
      ],
    },
  };
});

vi.mock("@/lib/api", () => ({
  fetchChocolates: vi.fn(() => Promise.resolve(fixtures.chocolates)),
}));

vi.mock("@/context/shop-state", () => ({
  useShop: () => ({ saved: [fixtures.savedId] }),
}));

// Expose the image_url the page hands to each card without pulling in next/image.
vi.mock("@/components/ChocolateCard", () => ({
  ChocolateCard: ({ chocolate }: { chocolate: Chocolate }) => (
    <div
      data-testid="product-card"
      data-name={chocolate.name}
      data-image-url={chocolate.image_url}
    />
  ),
}));

function renderSavedPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SavedPage />
    </QueryClientProvider>
  );
}

describe("SavedPage", () => {
  it("passes saved products' image_url through untouched", async () => {
    renderSavedPage();

    const card = await screen.findByTestId("product-card");
    // Regression guard for #79 (demo: break saved page product images only):
    // the saved list must not rewrite image_url (e.g. /photo- -> /broken-photo-).
    expect(card).toHaveAttribute("data-image-url", fixtures.savedImageUrl);
    expect(card.getAttribute("data-image-url")).not.toContain("/broken-photo-");
  });

  it("lists only saved chocolates", async () => {
    renderSavedPage();

    const cards = await screen.findAllByTestId("product-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-name", "Saved Bar");
  });
});
