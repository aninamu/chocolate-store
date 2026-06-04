import type { CheckoutPayload, CheckoutResponse, Chocolate } from "@/lib/types";

const base = () => process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const validChocolateSorts = new Set([
  "name",
  "price_asc",
  "price_desc",
  "cacao_desc",
]);

export type FetchChocolatesParams = {
  tags?: string[];
  sort?: string;
};

export function normalizeChocolatesParams(params?: FetchChocolatesParams) {
  const tags = (params?.tags ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const sort = validChocolateSorts.has(params?.sort ?? "")
    ? params?.sort ?? "name"
    : "name";

  return { tags, sort };
}

export function chocolatesQueryKey(params?: FetchChocolatesParams) {
  return ["chocolates", normalizeChocolatesParams(params)] as const;
}

export async function fetchChocolates(
  params?: FetchChocolatesParams
): Promise<Chocolate[]> {
  const normalized = normalizeChocolatesParams(params);
  const u = new URL("/api/chocolates", base());
  if (normalized.tags.length) {
    for (const t of normalized.tags) u.searchParams.append("tag", t);
  }
  u.searchParams.set("sort", normalized.sort);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error("Failed to load chocolates");
  return res.json() as Promise<Chocolate[]>;
}

export async function fetchChocolate(id: string): Promise<Chocolate> {
  const res = await fetch(`${base()}/api/chocolates/${id}`);
  if (res.status === 404) throw new Error("Not found");
  if (!res.ok) throw new Error("Failed to load chocolate");
  return res.json() as Promise<Chocolate>;
}

export async function postCheckout(
  body: CheckoutPayload
): Promise<CheckoutResponse> {
  const res = await fetch(`${base()}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: unknown };
    let msg = `Checkout failed (${res.status})`;
    if (typeof err.detail === "string") msg = err.detail;
    if (Array.isArray(err.detail)) {
      const parts = err.detail.map(
        (d: { msg?: string }) => (typeof d === "string" ? d : d?.msg) ?? ""
      );
      if (parts.some(Boolean)) msg = parts.join(" · ");
    }
    throw new Error(msg);
  }
  return res.json() as Promise<CheckoutResponse>;
}
