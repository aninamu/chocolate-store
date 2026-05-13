import type { Metadata } from "next";

import { CartPageClient } from "./cart-page-client";

export const metadata: Metadata = {
  title: "Cart · Chocolate Store",
  description: "Review your cart before checkout.",
};

export default function Page() {
  return <CartPageClient />;
}
