import { render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, beforeEach } from "vitest";

import { ShopProvider, useShop } from "@/context/shop-state";

function Harness() {
  const {
    isReady,
    cart,
    saved,
    addToCart,
    setQty,
    clearCart,
    removeFromCart,
    toggleSaved,
    isSaved,
  } = useShop();
  return (
    <div>
      <span data-testid="ready">{String(isReady)}</span>
      <span data-testid="cart">{JSON.stringify(cart)}</span>
      <span data-testid="saved">{JSON.stringify(saved)}</span>
      <span data-testid="saved-flag">{String(isSaved("c1"))}</span>
      <button type="button" onClick={() => addToCart("c1", 2)}>
        add
      </button>
      <button type="button" onClick={() => addToCart("c2", 1)}>
        add-c2
      </button>
      <button type="button" onClick={() => setQty("c2", 5)}>
        set-c2-5
      </button>
      <button type="button" onClick={() => setQty("c2", 0)}>
        set-c2-0
      </button>
      <button type="button" onClick={() => removeFromCart("c2")}>
        remove-c2
      </button>
      <button type="button" onClick={() => clearCart()}>
        clear
      </button>
      <button type="button" onClick={() => toggleSaved("c1")}>
        toggle
      </button>
    </div>
  );
}

describe("ShopProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("rehydrates cart from localStorage when ready", async () => {
    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([{ chocolateId: "x", quantity: 3 }])
    );

    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );
    await waitFor(() =>
      expect(view.getByTestId("cart").textContent).toContain("x")
    );
  });

  it("addToCart merges quantities and persists", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );

    await user.click(within(container).getByRole("button", { name: "add" }));
    await waitFor(() =>
      expect(view.getByTestId("cart").textContent).toContain('"quantity":2')
    );

    await user.click(within(container).getByRole("button", { name: "add" }));
    await waitFor(() =>
      expect(view.getByTestId("cart").textContent).toContain('"quantity":4')
    );

    const stored = JSON.parse(localStorage.getItem("cs.cart.v1") || "[]");
    expect(stored).toEqual([{ chocolateId: "c1", quantity: 4 }]);
  });

  it("toggleSaved updates saved list", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );

    expect(view.getByTestId("saved-flag").textContent).toBe("false");
    await user.click(within(container).getByRole("button", { name: "toggle" }));
    await waitFor(() =>
      expect(view.getByTestId("saved-flag").textContent).toBe("true")
    );
    expect(JSON.parse(localStorage.getItem("cs.saved.v1") || "[]")).toEqual([
      "c1",
    ]);
  });

  it("setQty updates quantity without changing cart order", async () => {
    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([
        { chocolateId: "c1", quantity: 1 },
        { chocolateId: "c2", quantity: 1 },
        { chocolateId: "c3", quantity: 1 },
      ])
    );

    const user = userEvent.setup();
    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );

    await user.click(within(container).getByRole("button", { name: "set-c2-5" }));
    await waitFor(() => {
      const cart = JSON.parse(view.getByTestId("cart").textContent || "[]");
      expect(cart).toEqual([
        { chocolateId: "c1", quantity: 1 },
        { chocolateId: "c2", quantity: 5 },
        { chocolateId: "c3", quantity: 1 },
      ]);
    });
  });

  it("addToCart increments existing line without changing cart order", async () => {
    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([
        { chocolateId: "c1", quantity: 1 },
        { chocolateId: "c2", quantity: 1 },
        { chocolateId: "c3", quantity: 1 },
      ])
    );

    const user = userEvent.setup();
    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );

    await user.click(within(container).getByRole("button", { name: "add-c2" }));
    await waitFor(() => {
      const cart = JSON.parse(view.getByTestId("cart").textContent || "[]");
      expect(cart).toEqual([
        { chocolateId: "c1", quantity: 1 },
        { chocolateId: "c2", quantity: 2 },
        { chocolateId: "c3", quantity: 1 },
      ]);
    });
  });

  it("removeFromCart drops a line and persists", async () => {
    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([
        { chocolateId: "c1", quantity: 1 },
        { chocolateId: "c2", quantity: 2 },
      ])
    );

    const user = userEvent.setup();
    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );

    await user.click(within(container).getByRole("button", { name: "remove-c2" }));
    await waitFor(() => {
      const cart = JSON.parse(view.getByTestId("cart").textContent || "[]");
      expect(cart).toEqual([{ chocolateId: "c1", quantity: 1 }]);
    });
    expect(JSON.parse(localStorage.getItem("cs.cart.v1") || "[]")).toEqual([
      { chocolateId: "c1", quantity: 1 },
    ]);
  });

  it("clearCart empties cart and persists", async () => {
    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([{ chocolateId: "c1", quantity: 3 }])
    );

    const user = userEvent.setup();
    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );

    await user.click(within(container).getByRole("button", { name: "clear" }));
    await waitFor(() =>
      expect(view.getByTestId("cart").textContent).toBe("[]")
    );
    expect(localStorage.getItem("cs.cart.v1")).toBe("[]");
  });

  it("setQty to zero removes the line", async () => {
    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([
        { chocolateId: "c1", quantity: 1 },
        { chocolateId: "c2", quantity: 2 },
      ])
    );

    const user = userEvent.setup();
    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );

    await user.click(within(container).getByRole("button", { name: "set-c2-0" }));
    await waitFor(() => {
      const cart = JSON.parse(view.getByTestId("cart").textContent || "[]");
      expect(cart).toEqual([{ chocolateId: "c1", quantity: 1 }]);
    });
  });

  it("falls back to empty cart when localStorage JSON is corrupt", async () => {
    localStorage.setItem("cs.cart.v1", "{not-json");

    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );
    expect(view.getByTestId("cart").textContent).toBe("[]");
  });

  it("syncs cart from storage events in other tabs", async () => {
    const { container } = render(
      <ShopProvider>
        <Harness />
      </ShopProvider>
    );
    const view = within(container);

    await waitFor(() =>
      expect(view.getByTestId("ready").textContent).toBe("true")
    );

    localStorage.setItem(
      "cs.cart.v1",
      JSON.stringify([{ chocolateId: "remote", quantity: 4 }])
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "cs.cart.v1",
        newValue: JSON.stringify([{ chocolateId: "remote", quantity: 4 }]),
      })
    );

    await waitFor(() => {
      const cart = JSON.parse(view.getByTestId("cart").textContent || "[]");
      expect(cart).toEqual([{ chocolateId: "remote", quantity: 4 }]);
    });
  });
});
