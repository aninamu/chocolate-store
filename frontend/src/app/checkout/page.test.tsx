import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CheckoutPage from "@/app/checkout/page";
import { renderWithProviders } from "@/test/render";
import type { Chocolate } from "@/lib/types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const fetchChocolatesMock = vi.fn();
const postCheckoutMock = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchChocolates: (...args: unknown[]) => fetchChocolatesMock(...args),
  postCheckout: (...args: unknown[]) => postCheckoutMock(...args),
}));

const PRODUCT: Chocolate = {
  id: "choc-1",
  name: "Dark Delight",
  slug: "dark-delight",
  description: "Rich dark chocolate",
  origin: "Ecuador",
  cacao_percentage: 72,
  price_cents: 1200,
  image_url: "https://example.com/dark.jpg",
  tags: ["dark"],
  in_stock: true,
  created_at: "2026-01-01T00:00:00Z",
  churrito_quote: null,
};

describe("CheckoutPage", () => {
  beforeEach(() => {
    cleanup();
    pushMock.mockReset();
    fetchChocolatesMock.mockReset();
    postCheckoutMock.mockReset();
    localStorage.clear();
    fetchChocolatesMock.mockResolvedValue([PRODUCT]);
  });

  it("shows empty cart message when cart is empty", async () => {
    renderWithProviders(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /back to shop/i })).toHaveAttribute(
      "href",
      "/shop"
    );
  });

  it("submits checkout, clears cart, and navigates on success", async () => {
    const user = userEvent.setup();
    postCheckoutMock.mockResolvedValueOnce({
      order_id: "order-99",
      total_cents: 2400,
    });

    renderWithProviders(<CheckoutPage />, {
      seedLocalStorage: {
        cart: [{ chocolateId: "choc-1", quantity: 2 }],
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(postCheckoutMock).toHaveBeenCalled();
    });

    expect(postCheckoutMock.mock.calls[0]?.[0]).toEqual({
      customer_name: "Ada Lovelace",
      customer_email: "ada@example.com",
      items: [{ chocolate_id: "choc-1", quantity: 2 }],
    });

    expect(pushMock).toHaveBeenCalledWith(
      "/checkout/success?order_id=order-99&total=2400"
    );
    expect(JSON.parse(localStorage.getItem("cs.cart.v1") || "[]")).toEqual([]);
  });

  it("shows toast when checkout fails", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    postCheckoutMock.mockRejectedValueOnce(new Error("card declined"));

    renderWithProviders(<CheckoutPage />, {
      seedLocalStorage: {
        cart: [{ chocolateId: "choc-1", quantity: 1 }],
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Checkout failed",
        expect.objectContaining({ description: "card declined" })
      );
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
