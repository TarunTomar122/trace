import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Space_Grotesk, Geist_Mono, Newsreader } from "next/font/google";
import { PostHogProvider } from "@/lib/posthog";
import { APPLE_TOUCH_ICON, WEB_APP_ICONS } from "@/lib/app-icons";
import ThemeProvider from "@/components/ThemeProvider";
import AffiliateTracker from "@/components/AffiliateTracker";
import "./globals.css";
import Script from "next/script";

import { Analytics } from "@vercel/analytics/next"

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-edition-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trace — A feed for builders",
  description:
    "Aggregated tech news and the practical engineering, design, and product work behind it.",
  keywords: ["AI summaries", "trending news", "content curation", "daily briefing", "topic overviews", "RSS alternative"],
  authors: [{ name: "Trace", url: "https://www.yourtrace.online" }],
  creator: "Trace",
  publisher: "Trace",
  applicationName: "Trace",
  category: "Technology",
  metadataBase: new URL('https://www.yourtrace.online'),
  alternates: {
    canonical: 'https://www.yourtrace.online/',
    languages: {
      'en-US': 'https://www.yourtrace.online/',
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.yourtrace.online",
    siteName: "Trace",
    title: "Trace — A feed for builders",
    description:
      "Aggregated tech news and the practical engineering, design, and product work behind it.",
    images: [
      {
        url: "https://www.yourtrace.online/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Trace — A feed for builders",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trace — A feed for builders",
    description:
      "Tech news, build logs, architecture, open source, design, and product in one feed.",
    images: ["https://www.yourtrace.online/twitter-image"],
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
    icon: WEB_APP_ICONS,
    apple: [APPLE_TOUCH_ICON],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Trace",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
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
        "description": "Trace is a feed for builders: aggregated tech news plus build logs, architecture, open source, design, and product thinking."
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
        "sameAs": [
          "https://x.com/tarat_211",
          "https://play.google.com/store/apps/details?id=online.yourtrace.app"
        ]
      }
    ]
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://www.googleapis.com" />
        <link rel="preconnect" href="https://apis.google.com" />
        <link rel="preconnect" href="https://accounts.google.com" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://us-assets.i.posthog.com" />
        <link rel="dns-prefetch" href="https://datafa.st" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Trace guides"
          href="https://www.yourtrace.online/rss.xml"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${spaceGrotesk.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          suppressHydrationWarning
        />
        <ThemeProvider>
          <PostHogProvider>
            <Suspense fallback={null}>
              <AffiliateTracker />
            </Suspense>
            {children}
          </PostHogProvider>
        </ThemeProvider>
        <Analytics />
        <Script
          strategy="lazyOnload"
          async
          data-website-id="dfid_m3LeCX0KgJACmcFPThB33"
          data-domain="www.yourtrace.online"
          src="https://datafa.st/js/script.js"
        />
      </body>
    </html>
  );
}
