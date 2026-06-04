import { describe, expect, it } from "vitest";

import {
  buildChocolatesListSearchParams,
  chocolateListQueryKey,
  normalizeChocolateListParams,
} from "@/lib/chocolate-catalog";

describe("normalizeChocolateListParams", () => {
  it("defaults to empty tags and name sort", () => {
    expect(normalizeChocolateListParams()).toEqual({ tags: [], sort: "name" });
    expect(normalizeChocolateListParams(undefined)).toEqual({
      tags: [],
      sort: "name",
    });
  });

  it("trims, dedupes, and sorts tags", () => {
    expect(
      normalizeChocolateListParams({ tags: [" milk ", "dark", "milk", ""] })
    ).toEqual({ tags: ["dark", "milk"], sort: "name" });
  });

  it("falls back unknown sort to name", () => {
    expect(normalizeChocolateListParams({ sort: "bogus" })).toEqual({
      tags: [],
      sort: "name",
    });
  });
});

describe("chocolateListQueryKey", () => {
  it("matches full catalog for default fetch and explicit name sort", () => {
    expect(chocolateListQueryKey()).toEqual(chocolateListQueryKey({ sort: "name" }));
    expect(chocolateListQueryKey()).toEqual(
      chocolateListQueryKey({ tags: [], sort: "name" })
    );
  });

  it("ignores tag order in the key", () => {
    expect(chocolateListQueryKey({ tags: ["dark", "milk"] })).toEqual(
      chocolateListQueryKey({ tags: ["milk", "dark"] })
    );
  });
});

describe("buildChocolatesListSearchParams", () => {
  it("always includes sort", () => {
    const sp = buildChocolatesListSearchParams();
    expect(sp.get("sort")).toBe("name");
  });

  it("emits repeated tag params", () => {
    const sp = buildChocolatesListSearchParams({ tags: ["dark", "milk"] });
    expect(sp.getAll("tag")).toEqual(["dark", "milk"]);
    expect(sp.get("sort")).toBe("name");
  });
});
