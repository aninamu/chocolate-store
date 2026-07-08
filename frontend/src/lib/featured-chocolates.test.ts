import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFeaturedChocolates } from "@/lib/featured-chocolates";

describe("fetchFeaturedChocolates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the first three chocolates from the API", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "1", name: "A" },
          { id: "2", name: "B" },
          { id: "3", name: "C" },
          { id: "4", name: "D" },
        ]),
        { status: 200 },
      ),
    );

    const featured = await fetchFeaturedChocolates();

    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/chocolates", {
      next: { revalidate: 30 },
    });
    expect(featured).toEqual([
      { id: "1", name: "A" },
      { id: "2", name: "B" },
      { id: "3", name: "C" },
    ]);
  });

  it("throws when the API response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );

    await expect(fetchFeaturedChocolates()).rejects.toThrow(
      "Failed to load chocolates",
    );
  });
});
