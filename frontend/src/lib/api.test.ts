import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchCartChocolates,
  fetchChocolate,
  fetchChocolates,
  postCheckout,
} from "@/lib/api";

describe("fetchChocolates", () => {
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

  it("appends repeated tag params when tags are provided", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");

    await fetchChocolates({ tags: ["dark", "milk"] });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("http://api.test/api/chocolates");
    expect(url).toContain("tag=dark");
    expect(url).toContain("tag=milk");
  });

  it("sends one tag param for a single selected tag", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");

    await fetchChocolates({ tags: ["dark"] });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("tag=dark");
    expect(url.split("tag=").length).toBe(2);
  });

  it("throws when response is not ok", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("", { status: 500 })
    );

    await expect(fetchChocolates()).rejects.toThrow("Failed to load chocolates");
  });

  it("appends repeated id params when ids are provided", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");

    await fetchChocolates({
      ids: [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ],
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("id=00000000-0000-4000-8000-000000000001");
    expect(url).toContain("id=00000000-0000-4000-8000-000000000002");
  });
});

describe("fetchCartChocolates", () => {
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

  it("returns empty list without calling fetch when ids are empty", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const out = await fetchCartChocolates([]);
    expect(out).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchChocolate", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ id: "x" }), { status: 200 })
        )
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws Not found on 404", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("", { status: 404 })
    );

    await expect(fetchChocolate("abc")).rejects.toThrow("Not found");
  });
});

describe("postCheckout", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ order_id: "o1", total_cents: 100 }),
            { status: 200 }
          )
        )
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns JSON on success", async () => {
    const body = {
      customer_name: "A",
      customer_email: "a@b.co",
      items: [{ chocolate_id: "00000000-0000-4000-8000-000000000001", quantity: 1 }],
    };
    const out = await postCheckout(body);
    expect(out.order_id).toBe("o1");
    expect(out.total_cents).toBe(100);
  });

  it("uses string detail from error body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "bad" }), { status: 400 })
    );

    await expect(
      postCheckout({
        customer_name: "A",
        customer_email: "a@b.co",
        items: [
          { chocolate_id: "00000000-0000-4000-8000-000000000001", quantity: 1 },
        ],
      })
    ).rejects.toThrow("bad");
  });
});
