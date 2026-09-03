import type { Metadata } from "next";
import { StructuredDataList } from '@/components/StructuredData';
import {
  generateHomeApplicationSchema,
  HOME_FAQ_ITEMS,
  HOME_PRODUCT_DESCRIPTION,
} from '@/lib/home-seo';
import { generateFAQSchema } from '@/lib/seo';
import LandingScreen from '@/components/feed-v2/LandingScreen';

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

export default function HomePage() {
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
      <LandingScreen />
    </>
  );
}
