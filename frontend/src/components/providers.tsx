"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";

import { DevMode } from "@/components/DevMode";
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

  useEffect(() => {
    const emitDebugLog = (hypothesisId: string, message: string, data: Record<string, unknown>) => {
      fetch("http://127.0.0.1:7350/ingest/37f73b68-7782-4cd7-81bf-7ce4f361283b", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "597800",
        },
        body: JSON.stringify({
          sessionId: "597800",
          runId: "initial",
          hypothesisId,
          location: "src/components/providers.tsx:Providers",
          message,
          data,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    };

    const styleSheets = Array.from(document.styleSheets).map((sheet) => {
      try {
        return { href: sheet.href ?? "inline", rules: sheet.cssRules.length };
      } catch {
        return { href: sheet.href ?? "inline", rules: "inaccessible" };
      }
    });

    // #region agent log H1
    emitDebugLog("H1", "Stylesheet inventory on mount", {
      styleSheetCount: document.styleSheets.length,
      styleSheets,
    });
    // #endregion

    const rootStyle = getComputedStyle(document.documentElement);
    // #region agent log H2
    emitDebugLog("H2", "Root CSS variable snapshot", {
      backgroundVar: rootStyle.getPropertyValue("--background").trim(),
      foregroundVar: rootStyle.getPropertyValue("--foreground").trim(),
      fontSansVar: rootStyle.getPropertyValue("--font-geist-sans").trim(),
    });
    // #endregion

    const probe = document.createElement("div");
    probe.className = "hidden bg-background text-foreground";
    document.body.appendChild(probe);
    const probeStyle = getComputedStyle(probe);
    // #region agent log H3
    emitDebugLog("H3", "Tailwind utility probe", {
      display: probeStyle.display,
      backgroundColor: probeStyle.backgroundColor,
      color: probeStyle.color,
    });
    // #endregion
    probe.remove();

    const bodyStyle = getComputedStyle(document.body);
    // #region agent log H4
    emitDebugLog("H4", "Body computed styles", {
      className: document.body.className,
      backgroundImage: bodyStyle.backgroundImage,
      backgroundColor: bodyStyle.backgroundColor,
      color: bodyStyle.color,
    });
    // #endregion

    const homeTerminal = document.querySelector(".home-terminal-bg");
    // #region agent log H5
    emitDebugLog("H5", "Homepage scoped class status", {
      hasHomeTerminalClass: Boolean(homeTerminal),
      htmlClassName: document.documentElement.className,
    });
    // #endregion
  }, []);

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
