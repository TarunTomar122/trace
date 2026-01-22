import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trending Topics - Trace',
  description: 'Discover the latest in frontend performance, design, AI agents, startups, music production, and vibe coding. Curated content from across the web.',
  keywords: [
    'trending topics',
    'tech news',
    'developer resources',
    'curated content',
    'frontend performance',
    'design trends',
    'AI agents',
    'startups',
    'music production',
    'vibe coding',
  ],
  openGraph: {
    title: 'Trending Topics - Trace',
    description: 'Discover the latest curated content across tech, design, and more',
    type: 'website',
    url: 'https://www.yourtrace.online/trending',
    siteName: 'Trace',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trending Topics - Trace',
    description: 'Discover the latest curated content across tech, design, and more',
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

