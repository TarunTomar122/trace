import type { Metadata } from "next";
import { StructuredDataList } from '@/components/StructuredData';
import {
  generateHomeApplicationSchema,
} from '@/lib/home-seo';
import { generateFAQSchema } from '@/lib/seo';
import { LANDING_FAQ } from '@/components/feed-v2/LandingScreen';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  looksSignedIn,
  TRACE_SESSION_COOKIE_NAME,
  TRACE_SIGNED_IN_COOKIE_NAME,
} from '@/lib/server-session';
import LandingScreen from '@/components/feed-v2/LandingScreen';
import LandingAuthRedirect from './LandingAuthRedirect';
import { listDailyEditions } from '@/lib/daily-editions';

export const metadata: Metadata = {
  title: "Fastest way to catch up on tech & AI news | Trace",
  description: "100+ tech sources, 10 stories, 5 minutes. Every morning, free.",
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
    title: "Fastest way to catch up on tech & AI news | Trace",
    description: "100+ tech sources, 10 stories, 5 minutes. Every morning, free.",
    url: "https://www.yourtrace.online",
    type: "website",
    images: [
      {
        url: "https://www.yourtrace.online/opengraph-image?v=redesign-2026-10",
        width: 1200,
        height: 630,
        alt: "Fastest way to catch up on tech & AI news | Trace",
      },
    ],
  },
};

export default async function HomePage() {
  // signed-in readers skip the pitch: straight to the feed
  const jar = await cookies();
  if (looksSignedIn(jar.get(TRACE_SESSION_COOKIE_NAME)?.value, jar.get(TRACE_SIGNED_IN_COOKIE_NAME)?.value)) {
    redirect('/feed');
  }
  // Today's real brief for the Daily Brief row's preview (demo stories if none yet).
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
