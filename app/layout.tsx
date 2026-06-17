import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { EnvBadge } from "@/components/dev/env-badge";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
        <EnvBadge />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
