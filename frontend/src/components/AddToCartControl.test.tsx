import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AddToCartControl } from "@/components/AddToCartControl";
import { ShopProvider } from "@/context/shop-state";

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

function getEnabledAddWithin(container: HTMLElement) {
  const root = within(container);
  const candidates = root.queryAllByRole("button", { name: /add/i });
  const enabled = candidates.filter((b) => !(b as HTMLButtonElement).disabled);
  expect(enabled.length).toBeGreaterThanOrEqual(1);
  return enabled[enabled.length - 1]!;
}

describe("AddToCartControl", () => {
  it("shows Add when qty is 0 and calls toast on add", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    const { container } = render(
      <ShopProvider>
        <AddToCartControl
          chocolateId="c99"
          productName="Test Bar"
          inStock
          isReady
          size="sm"
        />
      </ShopProvider>
    );

    await user.click(getEnabledAddWithin(container));

    expect(toast).toHaveBeenCalledWith(
      "Added to cart",
      expect.objectContaining({ description: "Test Bar" })
    );
  });

  it("is disabled when out of stock", async () => {
    const user = userEvent.setup();

    render(
      <ShopProvider>
        <AddToCartControl
          chocolateId="c1"
          productName="X"
          inStock={false}
          isReady
          size="sm"
        />
      </ShopProvider>
    );

    const add = screen.getByRole("button", { name: /add/i });
    expect(add).toBeDisabled();
    await user.click(add);
    const { toast } = await import("sonner");
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows stepper after add and increments quantity", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ShopProvider>
        <AddToCartControl
          chocolateId="c2"
          productName="Y"
          inStock
          isReady
          size="sm"
        />
      </ShopProvider>
    );

    await user.click(getEnabledAddWithin(container));
    expect(screen.getByLabelText(/quantity in cart/i)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /increase quantity/i }));
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
