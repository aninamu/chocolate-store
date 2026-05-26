"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { DevMode } from "@/components/DevMode";
import { Toaster } from "@/components/ui/sonner";
import { DevModeProvider } from "@/context/dev-mode";
import { DemoUserProvider } from "@/context/demo-user";
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
          <DemoUserProvider>
            <DevModeProvider>
              {children}
              <DevMode />
              <Toaster position="top-center" richColors closeButton />
            </DevModeProvider>
          </DemoUserProvider>
        </ShopProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
