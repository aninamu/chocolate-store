import type { Metadata } from "next";

import { ShopPageClient } from "./shop-page-client";

export const metadata: Metadata = {
  title: "Shop · Chocolate Store",
  description:
    "Filter by flavor notes and origin, then sort to find your next favorite bar.",
};

export default function Page() {
  return <ShopPageClient />;
}
