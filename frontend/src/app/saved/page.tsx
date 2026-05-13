import type { Metadata } from "next";

import { SavedPageClient } from "./saved-page-client";

export const metadata: Metadata = {
  title: "Saved for later · Chocolate Store",
  description: "Your saved chocolates.",
};

export default function Page() {
  return <SavedPageClient />;
}
