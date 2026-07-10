import type { CheckoutPayload, CheckoutResponse, Chocolate } from "@/lib/types";

const base = () => process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function fetchChocolates(params?: {
  tags?: string[];
  sort?: string;
}): Promise<Chocolate[]> {
  const u = new URL("/api/chocolates", base());
  if (params?.tags?.length) {
    for (const t of params.tags) {
      if (t) u.searchParams.append("tag", t);
    }
  }
  if (params?.sort) u.searchParams.set("sort", params.sort);
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load chocolates");
  return res.json() as Promise<Chocolate[]>;
}

export async function fetchChocolate(id: string): Promise<Chocolate> {
  const res = await fetch(`${base()}/api/chocolates/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("Not found");
  if (!res.ok) throw new Error("Failed to load chocolate");
  return res.json() as Promise<Chocolate>;
}

export async function fetchChocolatesByIds(ids: string[]): Promise<Chocolate[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  return Promise.all(unique.map((id) => fetchChocolate(id)));
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
