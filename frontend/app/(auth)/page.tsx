import type { Metadata } from "next";
import LandingPageClient from "../LandingPageClient";

export const metadata: Metadata = {
  title: "Trace — Your daily tech, in one place",
  description:
    "Stories, conversations, and product launches from 50+ sources — grouped into one scannable daily pulse so you stay current without the tab stack.",
  keywords: [
    "tech news aggregator",
    "daily tech briefing",
    "AI news summary",
    "tech pulse",
    "product launches",
    "trending tech topics",
    "RSS alternative",
    "Feedly alternative",
    "tech newsletter",
    "developer news",
  ],
  alternates: {
    canonical: "https://www.yourtrace.online/",
  },
  openGraph: {
    title: "Trace — Your daily tech, in one place",
    description:
      "Stories, conversations, and product launches from 50+ sources — one daily pulse instead of ten half-read feeds.",
    url: "https://www.yourtrace.online",
    type: "website",
    siteName: "Trace",
    images: [
      {
        url: "https://www.yourtrace.online/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Trace — Your daily tech, in one place",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trace — Your daily tech, in one place",
    description:
      "Stories, conversations & launches. Stay current without bouncing between feeds.",
    images: ["https://www.yourtrace.online/twitter-image"],
  },
};

export default function HomePage() {
  return <LandingPageClient />;
}
