import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

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

// Warm, high-contrast serif used for headings to give the brand a premium,
// editorial feel that plain Geist Sans could not convey on its own.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Churrito's Chocolates",
  description:
    "Single-origin chocolate from the kitchen of Churrito the Pomeranian, founder and Chief Chocolatier.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} min-h-screen flex flex-col antialiased`}
      >
        <Providers>
          <div className="flex w-full min-h-screen flex-1 flex-col">
            <Header />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-5">
              {children}
            </main>
            <HomeFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
