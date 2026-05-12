"use client";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ShopTagPicker } from "@/components/ShopTagPicker";

function TestHarness() {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const tagOptions = ["dark", "nutty"];

  return (
    <ShopTagPicker
      triggerId="tags-trigger"
      tagOptions={tagOptions}
      selectedTags={selectedTags}
      isPending={false}
      onToggle={(t) =>
        setSelectedTags((prev) =>
          prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
        )
      }
      onClearAll={() => setSelectedTags([])}
    />
  );
}

describe("ShopTagPicker accessibility", () => {
  it("uses a disclosure region for tag checkboxes, not a listbox role", async () => {
    const user = userEvent.setup();
    render(<TestHarness />);

    const tagButton = screen.getByRole("button", { name: /^any tag$/i });
    expect(tagButton).toHaveAttribute("aria-expanded", "false");
    const panelId = tagButton.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(tagButton);
    expect(tagButton).toHaveAttribute("aria-expanded", "true");

    const region = document.getElementById(panelId ?? "");
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("role", "region");
    expect(region).toHaveAttribute("aria-labelledby", tagButton.id);

    expect(
      within(region as HTMLElement).getByRole("checkbox", { name: /^dark$/ }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(tagButton).toHaveAttribute("aria-expanded", "false");
    });
    expect(document.activeElement).toBe(tagButton);
  });
});
