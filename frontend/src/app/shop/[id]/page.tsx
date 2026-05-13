import type { Metadata } from "next";

import { fetchChocolate } from "@/lib/api";

import { ProductDetailClient } from "./product-detail-client";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const c = await fetchChocolate(id);
    return {
      title: `${c.name} · Chocolate Store`,
      description: c.description?.slice(0, 160) ?? `Details for ${c.name}`,
    };
  } catch {
    return {
      title: "Product · Chocolate Store",
    };
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <ProductDetailClient id={id} />;
}
