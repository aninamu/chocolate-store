import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Header, HomeFooter } from "@/components/Header";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "chocolate store",
  description: "Field-engineer friendly demo: browse, save, cart, and mock checkout.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-5">{children}</main>
          <HomeFooter />
        </Providers>
      </body>
    </html>
  );
}
