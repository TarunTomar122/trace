import type { Metadata } from "next";
import { StructuredDataList } from '@/components/StructuredData';
import {
  generateHomeApplicationSchema,
} from '@/lib/home-seo';
import { generateFAQSchema } from '@/lib/seo';
import { LANDING_FAQ } from '@/components/feed-v2/LandingScreen';
import LandingScreen from '@/components/feed-v2/LandingScreen';
import LandingAuthRedirect from './LandingAuthRedirect';
import { listDailyEditions } from '@/lib/daily-editions';

export const metadata: Metadata = {
  title: "Trace: free daily tech and AI news digest",
  description: "Trace reads 100+ tech sources, merges coverage of each event into one story and links every report. Free daily feed and 08:30 UK email. Open source.",
  keywords: [
    "AI news aggregator",
    "tech news aggregator",
    "AI news feed",
    "technology news app",
    "daily tech briefing",
    "daily AI briefing",
    "AI news for founders",
    "Chrome new tab news",
  ],
  alternates: {
    canonical: "https://www.yourtrace.online/",
  },
  openGraph: {
    title: "Trace: free daily tech and AI news digest",
    description: "Trace reads 100+ tech sources, merges coverage of each event into one story and links every report. Free daily feed and 08:30 UK email. Open source.",
    url: "https://www.yourtrace.online",
    type: "website",
    images: [
      {
        url: "https://www.yourtrace.online/opengraph-image?v=redesign-2026-10",
        width: 1200,
        height: 630,
        alt: "Trace: free daily tech and AI news digest",
      },
    ],
  },
};

// Cached for everyone: signed-in readers are sent to /feed by proxy.ts
// before this page is reached, so it never reads cookies.
export const revalidate = 600;

export default async function HomePage() {
  // Today's real brief for the Trace Daily row's preview (demo stories if none yet).
  const [edition] = await listDailyEditions(1);
  return (
    <>
      <LandingAuthRedirect />
      <StructuredDataList
        schemas={[
          generateHomeApplicationSchema(),
          generateFAQSchema(
            LANDING_FAQ.map((item) => ({ question: item.q, answer: item.a })),
          ),
        ]}
      />
      <LandingScreen edition={edition ?? null} />
    </>
  );
}
