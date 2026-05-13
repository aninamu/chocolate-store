import type { Metadata } from "next";

import { CheckoutPageClient } from "./checkout-page-client";

export const metadata: Metadata = {
  title: "Checkout · Chocolate Store",
  description: "Place your mock order.",
};

export default function Page() {
  return <CheckoutPageClient />;
}
