import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Header } from "@/components/Header";
import { ShopProvider } from "@/context/shop-state";

vi.mock("next/navigation", () => ({
  usePathname: () => "/cart",
}));

function renderHeader() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={client}>
      <ShopProvider>
        <Header />
      </ShopProvider>
    </QueryClientProvider>,
  );
}

describe("Header accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  it("toggle mobile navigation exposes aria-expanded and targets the expanded panel", async () => {
    const user = userEvent.setup();
    renderHeader();

    const menuBtn = screen.getByRole("button", { name: /^open menu$/i });
    const panelId = menuBtn.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");

    await user.click(menuBtn);

    const closeBtn = screen.getByRole("button", { name: /^close menu$/i });
    expect(closeBtn).toHaveAttribute("aria-expanded", "true");
    expect(closeBtn.getAttribute("aria-controls")).toBe(panelId);

    const mobileNav = document.getElementById(panelId ?? "");
    expect(mobileNav).not.toBeNull();
    within(mobileNav as HTMLElement).getByRole("link", { name: /^Shop$/ });
  });

  it("marks the active route on desktop navigation links", () => {
    renderHeader();

    const [desktopNav] = screen.getAllByRole("navigation", {
      name: /^Desktop navigation$/i,
    });
    within(desktopNav!).getByRole("link", {
      current: "page",
      name: /^Cart$/,
    });
  });
});
