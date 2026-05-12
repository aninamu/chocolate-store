import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order placed",
  description: "Confirmation for your demo checkout.",
};

export default function CheckoutSuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
