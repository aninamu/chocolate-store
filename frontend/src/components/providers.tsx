"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

const DevMode = dynamic(
  () => import("@/components/DevMode").then((m) => m.DevMode),
  { ssr: false }
);
import { Toaster } from "@/components/ui/sonner";
import { DevModeProvider } from "@/context/dev-mode";
import { ShopProvider } from "@/context/shop-state";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={client}>
        <ShopProvider>
          <DevModeProvider>
            {children}
            <DevMode />
            <Toaster position="top-center" richColors closeButton />
          </DevModeProvider>
        </ShopProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
