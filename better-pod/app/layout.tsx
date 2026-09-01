import type { Metadata } from "next";
import { EB_Garamond, Figtree } from "next/font/google";
import "./globals.css";

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Better Pod — The living podcast for AI & tech news",
  description:
    "One 12-minute podcast every morning. Built from 40+ sources, with living memory of everything that happened before — yesterday, last month, last year — woven into today's story.",
  metadataBase: new URL("https://betterfell.example.com"),
  openGraph: {
    title: "Better Pod — The living podcast for AI & tech news",
    description:
      "A living, breathing 12-minute podcast that remembers everything and tells you what matters today.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${ebGaramond.variable} ${figtree.variable}`}>
      <body className="min-h-screen bg-[#ffffeb] text-[#1a1a1a] antialiased">
        {children}
      </body>
    </html>
  );
}
