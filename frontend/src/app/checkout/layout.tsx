import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Place a mock order with customer name and email.",
};

export default function CheckoutSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
