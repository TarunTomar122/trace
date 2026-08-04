import type { Metadata } from "next";
import LandingPageClient from "../LandingPageClient";
import { blogPosts } from "@/app/blog/content";
import type { V3UserFeed } from '@/lib/firestore';
import { StructuredDataList } from '@/components/StructuredData';
import {
  generateHomeApplicationSchema,
  HOME_FAQ_ITEMS,
  HOME_PRODUCT_DESCRIPTION,
} from '@/lib/home-seo';
import { generateFAQSchema } from '@/lib/seo';

export const metadata: Metadata = {
  title: "Trace — AI and developer news in one focused feed",
  description: HOME_PRODUCT_DESCRIPTION,
  keywords: [
    "developer news aggregator",
    "AI news aggregator",
    "tech news aggregator",
    "daily tech briefing",
    "open-source project discovery",
    "technical discussion summaries",
    "RSS alternative",
  ],
  alternates: {
    canonical: "https://www.yourtrace.online/",
  },
  openGraph: {
    title: "Trace — AI and developer news in one focused feed",
    description: HOME_PRODUCT_DESCRIPTION,
    url: "https://www.yourtrace.online",
    type: "website",
    siteName: "Trace",
    images: [
      {
        url: "https://www.yourtrace.online/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Trace — AI and developer news in one focused feed",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trace — AI and developer news in one focused feed",
    description: HOME_PRODUCT_DESCRIPTION,
    images: ["https://www.yourtrace.online/twitter-image"],
  },
};

export default async function HomePage() {
  const editionFeed = await import('@/lib/feed-server')
    .then(({ getPublicBootstrapFeed }) => getPublicBootstrapFeed('developer'))
    .catch((): V3UserFeed | null => null);
  return (
    <>
      <StructuredDataList
        schemas={[
          generateHomeApplicationSchema(),
          generateFAQSchema(
            HOME_FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a })),
          ),
        ]}
      />
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
    </>
  );
}
