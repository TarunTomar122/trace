import type { Metadata } from "next";
import LandingPageClient from "../LandingPageClient";
import { blogPosts } from "@/app/blog/content";
import type { V3UserFeed } from '@/lib/firestore';

export const metadata: Metadata = {
  title: "Trace — A feed for builders",
  description:
    "Aggregated tech news, build logs, architecture breakdowns, open-source projects, design, and product thinking for builders.",
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
    title: "Trace — A feed for builders",
    description:
      "Aggregated tech news plus the practical engineering, design, and product work behind it.",
    url: "https://www.yourtrace.online",
    type: "website",
    siteName: "Trace",
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
};

export default async function HomePage() {
  const editionFeed = await import('@/lib/feed-server')
    .then(({ getPublicBootstrapFeed }) => getPublicBootstrapFeed('developer'))
    .catch((): V3UserFeed | null => null);
  return (
    <LandingPageClient
      editionFeed={editionFeed}
      recentBlogPosts={[...blogPosts]
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, 3)
        .map((post) => ({
          href: `/blog/${post.slug}`,
          date: post.date,
          title: post.title,
        }))}
    />
  );
}
