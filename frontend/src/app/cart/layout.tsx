import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cart",
  description:
    "Review items in your cart and adjust quantities before checkout.",
};

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
