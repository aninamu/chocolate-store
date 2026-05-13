import type { Metadata } from "next";

import { CheckoutSuccessPageClient } from "./success-page-client";

export const metadata: Metadata = {
  title: "Order placed · Chocolate Store",
  description: "Your mock order was recorded.",
};

export default function Page() {
  return <CheckoutSuccessPageClient />;
}
