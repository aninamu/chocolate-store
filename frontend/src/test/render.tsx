import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { ShopProvider } from "@/context/shop-state";
import type { CartLine } from "@/lib/types";

type SeedLocalStorage = {
  cart?: CartLine[];
  saved?: string[];
};

type ProviderOptions = {
  seedLocalStorage?: SeedLocalStorage;
  queryClient?: QueryClient;
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function seedLocalStorage(seed?: SeedLocalStorage): void {
  if (seed?.cart) {
    localStorage.setItem("cs.cart.v1", JSON.stringify(seed.cart));
  }
  if (seed?.saved) {
    localStorage.setItem("cs.saved.v1", JSON.stringify(seed.saved));
  }
}

function AllProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ShopProvider>{children}</ShopProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: ProviderOptions & Omit<RenderOptions, "wrapper">
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();
  seedLocalStorage(options?.seedLocalStorage);

  return {
    queryClient,
    ...render(ui, {
      ...options,
      wrapper: ({ children }) => (
        <AllProviders queryClient={queryClient}>{children}</AllProviders>
      ),
    }),
  };
}
