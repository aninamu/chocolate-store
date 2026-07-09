import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { Chocolate } from "@/lib/types";

const { mockChocolate, mockSavedIds } = vi.hoisted(() => {
  const mockChocolate: Chocolate = {
    id: "c1",
    name: "Test Bar",
    slug: "test-bar",
    description: "A test chocolate",
    origin: "Testland",
    cacao_percentage: 70,
    price_cents: 499,
    image_url: "https://images.unsplash.com/photo-1234567890",
    tags: ["dark"],
    in_stock: true,
    created_at: "2026-01-01T00:00:00Z",
    churrito_quote: null,
  };
  return { mockChocolate, mockSavedIds: ["c1"] };
});

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/lib/api", () => ({
  fetchChocolates: vi.fn(() => Promise.resolve([mockChocolate])),
}));

vi.mock("@/context/shop-state", () => ({
  useShop: () => ({ saved: mockSavedIds }),
}));

vi.mock("@/components/ChocolateCard", () => ({
  ChocolateCard: ({ chocolate }: { chocolate: Chocolate }) => (
    <div data-testid="chocolate-card" data-image-url={chocolate.image_url}>
      {chocolate.name}
    </div>
  ),
}));

import SavedPage from "./page";

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
  it("passes saved chocolates through without rewriting image URLs", async () => {
    renderSavedPage();

    const card = await screen.findByTestId("chocolate-card");
    expect(card).toHaveAttribute("data-image-url", mockChocolate.image_url);
    expect(card.getAttribute("data-image-url")).not.toContain("broken-photo");
  });

  it("renders saved product cards after data loads", async () => {
    renderSavedPage();

    await waitFor(() => {
      expect(screen.getByText("Test Bar")).toBeInTheDocument();
    });
  });
});
