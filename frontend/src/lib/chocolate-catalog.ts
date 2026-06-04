export const DEFAULT_CHOCOLATE_SORT = "name" as const;

export type ChocolateSort =
  | typeof DEFAULT_CHOCOLATE_SORT
  | "price_asc"
  | "price_desc"
  | "cacao_desc";

export type ChocolateListParams = {
  tags?: string[];
  sort?: string;
};

export type NormalizedChocolateListParams = {
  tags: string[];
  sort: ChocolateSort;
};

export function normalizeChocolateListParams(
  params?: ChocolateListParams
): NormalizedChocolateListParams {
  const tags = [
    ...new Set((params?.tags ?? []).map((t) => t.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const raw = params?.sort?.trim() || DEFAULT_CHOCOLATE_SORT;
  const sort: ChocolateSort =
    raw === "price_asc" || raw === "price_desc" || raw === "cacao_desc"
      ? raw
      : DEFAULT_CHOCOLATE_SORT;
  return { tags, sort };
}

/** Shared React Query key for any chocolates list fetch. */
export function chocolateListQueryKey(params?: ChocolateListParams) {
  const { tags, sort } = normalizeChocolateListParams(params);
  return ["chocolates", "list", { tags, sort }] as const;
}

export function buildChocolatesListSearchParams(
  params?: ChocolateListParams
): URLSearchParams {
  const { tags, sort } = normalizeChocolateListParams(params);
  const sp = new URLSearchParams();
  for (const t of tags) {
    sp.append("tag", t);
  }
  sp.set("sort", sort);
  return sp;
}
