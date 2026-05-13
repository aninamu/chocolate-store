import type { Metadata } from "next";

import { HomePageClient } from "./home-page-client";

export const metadata: Metadata = {
  title: "Chocolate Store",
  description:
    "Field-engineer friendly demo: browse, save, cart, and mock checkout.",
};

export default function Page() {
  return <HomePageClient />;
}
