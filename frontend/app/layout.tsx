import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";
import Script from "next/script";

import { Analytics } from "@vercel/analytics/next"

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trace - Build Your Own Feed",
  description: "A personalized feed with content from across the web",
  keywords: ["personalized feed", "content from across the web", "reddit", "hacker news", "youtube", "arxiv", "github", "AI intelligence", "adaptive learning", "knowledge curation", "growth mindset"],
  authors: [{ name: "Trace" }],
  metadataBase: new URL('https://www.yourtrace.online'),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.yourtrace.online",
    siteName: "Trace",
    title: "Trace - Build Your Own Feed",
    description: "A personalized feed with content from across the web",
    images: [
      {
        url: "/trace.png",
        width: 1200,
        height: 630,
        alt: "Trace - Build Your Own Feed",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trace - Build Your Own Feed",
    description: "A personalized feed with content from across the web",
    images: ["/trace.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://www.yourtrace.online/#website",
        "url": "https://www.yourtrace.online",
        "name": "Trace",
        "description": "Build your own feed with content from across the web",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://www.yourtrace.online/feed?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "Organization",
        "@id": "https://www.yourtrace.online/#organization",
        "name": "Trace",
        "url": "https://www.yourtrace.online",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.yourtrace.online/trace.png"
        },
        "sameAs": []
      },
      {
        "@type": "Product",
        "@id": "https://www.yourtrace.online/#product",
        "name": "Trace Pro",
        "description": "Premium feed with content from across the web",
        "image": "https://www.yourtrace.online/trace.png",
        "offers": {
          "@type": "Offer",
          "price": "2.99",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": "2026-12-31",
          "url": "https://www.yourtrace.online/profile"
        }
      }
    ]
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
        <Script
          defer
          data-website-id="dfid_m3LeCX0KgJACmcFPThB33"
          data-domain="www.yourtrace.online"
          src="https://datafa.st/js/script.js"
        />
      </body>
    </html>
  );
}
