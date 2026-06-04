import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { fetchChocolate, fetchChocolates } from "@/lib/api";

const DEFAULT_CHOCOLATE_SORT = "name";
const CATALOG_STALE_TIME_MS = 5 * 60 * 1000;
const CATALOG_GC_TIME_MS = 15 * 60 * 1000;

type ChocolateListParams = {
  tags?: string[];
  sort?: string | null;
};

function normalizeChocolateListParams(params?: ChocolateListParams) {
  const tags = [...new Set(params?.tags?.map((t) => t.trim()).filter(Boolean) ?? [])].sort(
    (a, b) => a.localeCompare(b)
  );
  const sort = params?.sort?.trim() || DEFAULT_CHOCOLATE_SORT;

  return { tags, sort };
}

export function chocolatesQueryKey(params?: ChocolateListParams) {
  return ["chocolates", "list", normalizeChocolateListParams(params)] as const;
}

export function chocolatesQueryOptions(params?: ChocolateListParams) {
  const normalized = normalizeChocolateListParams(params);

  return queryOptions({
    queryKey: chocolatesQueryKey(normalized),
    queryFn: () =>
      fetchChocolates({
        tags: normalized.tags.length ? normalized.tags : undefined,
        sort: normalized.sort === DEFAULT_CHOCOLATE_SORT ? undefined : normalized.sort,
      }),
    staleTime: CATALOG_STALE_TIME_MS,
    gcTime: CATALOG_GC_TIME_MS,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

export function allChocolatesQueryOptions() {
  return chocolatesQueryOptions();
}

export function chocolateQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["chocolate", id] as const,
    queryFn: () => fetchChocolate(id),
    enabled: Boolean(id),
    staleTime: CATALOG_STALE_TIME_MS,
    gcTime: CATALOG_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
