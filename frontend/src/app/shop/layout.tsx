import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Filter chocolates by tags, sort by name or price, and browse the catalog.",
};

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
