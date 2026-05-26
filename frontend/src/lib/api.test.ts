import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPost,
  fetchChocolate,
  fetchFeed,
  fetchChocolates,
  likePost,
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

describe("fetchFeed", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [], next_offset: null }), {
            status: 200,
          })
        )
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes demo user header when provided", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    await fetchFeed(0, { "X-Demo-User-Id": "user-1" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("X-Demo-User-Id")).toBe("user-1");
  });

  it("throws when response is not ok", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response("", { status: 500 })
    );
    await expect(fetchFeed()).rejects.toThrow("Failed to load feed");
  });
});

describe("createPost", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ id: "p1", text: "hi" }), { status: 201 })
        )
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs JSON with demo headers", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    await createPost({ text: "hello" }, { "X-Demo-User-Id": "alice" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ text: "hello" });
    expect(new Headers(init.headers).get("X-Demo-User-Id")).toBe("alice");
  });
});

describe("likePost", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ like_count: 3 }), { status: 201 })
        )
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns like count from response", async () => {
    const count = await likePost("post-1", { "X-Demo-User-Id": "u1" });
    expect(count).toBe(3);
  });
});
