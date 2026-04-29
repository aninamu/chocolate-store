import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DevMode } from "@/components/DevMode";
import { DevModeProvider } from "@/context/dev-mode";

function setDesktopViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const isMd =
        /min-width:\s*48rem|min-width:\s*768px|768px/.test(query) ||
        query === "(min-width: 768px)";
      return {
        matches: isMd,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList;
    },
  });
}

function TestRoot({ children }: { children: ReactNode }) {
  return (
    <div>
      <div data-testid="host">
        {children}
      </div>
      <DevModeProvider>
        <DevMode />
      </DevModeProvider>
    </div>
  );
}

describe("DevMode", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    setDesktopViewport();
  });

  it("toggle starts in off state and enables dev mode on click", async () => {
    const user = userEvent.setup();
    render(
      <TestRoot>
        <p>Hello</p>
      </TestRoot>
    );

    const toggle = screen.getByTestId("dev-mode-toggle");
    expect(toggle).toHaveTextContent("Dev mode");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(toggle).toHaveTextContent("Dev mode on");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("with dev mode on, click selects an element and opens the sidebar with metadata", async () => {
    const user = userEvent.setup();
    render(
      <TestRoot>
        <p id="pick" className="prose" data-foo="bar">
          target text
        </p>
      </TestRoot>
    );

    await user.click(screen.getByTestId("dev-mode-toggle"));

    const p = within(screen.getByTestId("host")).getByText("target text");
    await user.click(p);

    expect(screen.getByText("Element")).toBeInTheDocument();
    const panel = screen.getByRole("dialog");
    expect(within(panel).getByText("Tag & identity")).toBeInTheDocument();
    expect(panel.textContent).toMatch(/<p>/);
    expect(panel.textContent).toContain("pick");
    expect(
      within(panel).getByText("prose", { selector: "p.text-muted-foreground" })
    ).toBeInTheDocument();
    expect(within(panel).getByText("data-foo")).toBeInTheDocument();

    await user.click(screen.getByTestId("dev-mode-toggle"));
    expect(screen.queryByText("Element")).not.toBeInTheDocument();
    const toggles = screen.getAllByTestId("dev-mode-toggle");
    expect(toggles[0]).toHaveTextContent("Dev mode");
  });
});
