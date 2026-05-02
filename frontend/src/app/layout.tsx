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
  title: "Chocolate Store — craft chocolate delivered",
  description:
    "Small-batch bars and truffles from trusted origins. Shop by flavor, save favorites, and checkout in a few steps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased`}
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
