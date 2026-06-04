import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  allChocolatesQueryOptions,
  chocolatesQueryKey,
  chocolatesQueryOptions,
} from "@/lib/chocolate-queries";

describe("chocolate catalog query helpers", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes equivalent default catalog queries to the same key", () => {
    expect(allChocolatesQueryOptions().queryKey).toEqual(
      chocolatesQueryOptions({ sort: "name" }).queryKey
    );
  });

  it("normalizes tag order and blanks in query keys", () => {
    expect(chocolatesQueryKey({ tags: ["milk", "", "dark", "milk"] })).toEqual(
      chocolatesQueryKey({ tags: ["dark", "milk"] })
    );
  });

  it("reuses the cached default catalog fetch", async () => {
    const client = new QueryClient();

    await client.fetchQuery(allChocolatesQueryOptions());
    await client.fetchQuery(chocolatesQueryOptions({ sort: "name" }));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
