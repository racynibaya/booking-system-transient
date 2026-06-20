import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import { Toaster } from "sonner";
import { EnvBadge } from "@/components/dev/env-badge";
import { Providers } from "./providers";
import "./globals.css";

// Body / UI sans — replaces Inter (the old Airbnb-Cereal substitute).
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

// Display serif — the editorial "local-guide" voice for headings.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Tuloy — Take bookings even while you sleep",
  description:
    "Tuloy turns your San Juan, La Union transient's Facebook page into a live, bookable calendar — guests reserve and pay a deposit on their own, with no double-bookings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
        <EnvBadge />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
