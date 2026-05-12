import type { Metadata } from "next";

import { fetchChocolate } from "@/lib/api";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const c = await fetchChocolate(id);
    return {
      title: c.name,
      description: c.description.slice(0, 160),
    };
  } catch {
    return { title: "Product", description: "Product details." };
  }
}

export default function ChocolateDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
