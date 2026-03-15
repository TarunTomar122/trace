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
  title: "Trace — Trending Topics with AI Summaries",
  description: "High-signal trending topics grouped from many sources, with summaries, key points, and timelines that help you catch up fast.",
  keywords: ["AI summaries", "trending news", "content curation", "daily briefing", "topic overviews", "RSS alternative"],
  authors: [{ name: "Trace" }],
  metadataBase: new URL('https://www.yourtrace.online'),
  alternates: {
    canonical: 'https://www.yourtrace.online/',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.yourtrace.online",
    siteName: "Trace",
    title: "Trace — Trending Topics with AI Summaries",
    description: "High-signal trending topics grouped from many sources, with summaries, key points, and timelines.",
    images: [
      {
        url: "/trace.png",
        width: 1200,
        height: 630,
        alt: "Trace — Trending topics with AI summaries",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trace — Trending Topics with AI Summaries",
    description: "High-signal trending topics with AI summaries that help you catch up faster.",
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
    icon: [
      { url: "/trace.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/trace.png",
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
        "description": "Stop checking 10 apps every morning. Trace scans the sources you care about and gives you a short daily brief with links worth opening.",
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
        "description": "Trending topics with AI summaries, key points, and timelines that help you catch up faster",
        "image": "https://www.yourtrace.online/trace.png",
        "offers": {
          "@type": "Offer",
          "price": "2.99",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": "2026-12-31",
          "url": "https://www.yourtrace.online/profile"
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://www.yourtrace.online/#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What does Trace include?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Trace gives you trending topics grouped from many sources, each with an AI summary, key points, and a timeline."
            }
          },
          {
            "@type": "Question",
            "name": "How much does Trace cost?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Trace starts with a free trial and then costs $2.99 per month. You can cancel anytime from your profile."
            }
          },
          {
            "@type": "Question",
            "name": "How does personalization work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "You choose the topics you care about. Trace uses those inputs to prioritize and summarize the stories in your daily feed."
            }
          }
        ]
      }
    ]
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          suppressHydrationWarning
        />
        <ThemeProvider>
          <PostHogProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
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
