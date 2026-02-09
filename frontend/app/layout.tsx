import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { PostHogProvider } from "@/lib/posthog";
import ThemeProvider from "@/components/ThemeProvider";
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
  title: "Trace — Your RSS for the Web",
  description: "Never miss what matters. Trace curates content from YouTube, GitHub, Reddit, Hacker News, blogs, and hundreds more sources — all in one personalized feed.",
  keywords: ["personalized feed", "RSS alternative", "content curation", "reddit", "hacker news", "youtube", "arxiv", "github", "curated news", "topic feed", "daily digest"],
  authors: [{ name: "Trace" }],
  metadataBase: new URL('https://www.yourtrace.online'),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.yourtrace.online",
    siteName: "Trace",
    title: "Trace — Your RSS for the Web",
    description: "Never miss what matters. Trace curates content from YouTube, GitHub, Reddit, Hacker News, blogs, and hundreds more sources — all in one personalized feed.",
    images: [
      {
        url: "/trace.png",
        width: 1200,
        height: 630,
        alt: "Trace — Your RSS for the Web",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trace — Your RSS for the Web",
    description: "Never miss what matters. Content from hundreds of sources, curated around your interests.",
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
        "description": "Your RSS for the web — content from hundreds of sources, curated around your interests",
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
        "description": "Personalized feed from hundreds of sources, curated around your interests",
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
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
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
        <ThemeProvider>
          <PostHogProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </PostHogProvider>
        </ThemeProvider>
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
