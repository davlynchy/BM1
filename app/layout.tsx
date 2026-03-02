import type { Metadata } from "next";
import { Inter, Viga } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const viga = Viga({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Bidmetric",
  description: "Commercial intelligence for construction contractors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${viga.variable}`}>
      <body>{children}</body>
    </html>
  );
}
