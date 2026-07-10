import type { Chocolate } from "@/lib/types";

const base = () => process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function fetchFeaturedChocolates(): Promise<Chocolate[]> {
  const res = await fetch(`${base()}/api/chocolates`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error("Failed to load chocolates");
  const data = (await res.json()) as Chocolate[];
  return data.slice(0, 3);
}
