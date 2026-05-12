import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved for later",
  description:
    "Chocolates you saved — open a product page to add or remove items.",
};

export default function SavedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
