import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trending Topics And Story Overviews | Trace',
  description: 'Explore grouped trending topics with story overviews, timelines, and source coverage from across the web.',
  keywords: [
    'trending topics',
    'story overviews',
    'news timeline',
    'grouped stories',
    'topic pages',
    'source coverage',
    'trace',
  ],
  openGraph: {
    title: 'Trending Topics And Story Overviews | Trace',
    description: 'Explore grouped trending topics with story overviews, timelines, and source coverage.',
    type: 'website',
    url: 'https://www.yourtrace.online/trending',
    siteName: 'Trace',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trending Topics And Story Overviews | Trace',
    description: 'Grouped topics, story overviews, and timelines from across the web.',
  },
  alternates: {
    canonical: 'https://www.yourtrace.online/trending',
  },
};

export default function TrendingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
