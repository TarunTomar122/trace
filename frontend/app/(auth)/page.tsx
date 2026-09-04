import type { Metadata } from "next";
import { StructuredDataList } from '@/components/StructuredData';
import {
  generateHomeApplicationSchema,
  HOME_FAQ_ITEMS,
  HOME_PRODUCT_DESCRIPTION,
} from '@/lib/home-seo';
import { generateFAQSchema } from '@/lib/seo';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession } from '@/lib/server-session';
import LandingScreen from '@/components/feed-v2/LandingScreen';
import LandingAuthRedirect from './LandingAuthRedirect';

export const metadata: Metadata = {
  title: "Trace: AI and tech news in five minutes",
  description: HOME_PRODUCT_DESCRIPTION,
  keywords: [
    "AI news aggregator",
    "tech news aggregator",
    "AI news feed",
    "technology news app",
    "daily tech briefing",
    "Chrome new tab news",
  ],
  alternates: {
    canonical: "https://www.yourtrace.online/",
  },
  openGraph: {
    title: "Trace: AI and tech news in five minutes",
    description: HOME_PRODUCT_DESCRIPTION,
    url: "https://www.yourtrace.online",
    type: "website",
  },
};

export default async function HomePage() {
  // signed-in readers skip the pitch: straight to the feed
  const sessionCookie = (await cookies()).get(TRACE_SESSION_COOKIE_NAME)?.value;
  if (sessionCookie && verifyTraceSession(sessionCookie)) {
    redirect('/feed');
  }
  return (
    <>
      <LandingAuthRedirect />
      <StructuredDataList
        schemas={[
          generateHomeApplicationSchema(),
          generateFAQSchema(
            HOME_FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a })),
          ),
        ]}
      />
      <LandingScreen />
    </>
  );
}
