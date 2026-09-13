import type { Metadata } from 'next';
import FeedScreen from '@/components/feed-v2/FeedScreen';
import { feedTabLabel, normalizeFeedTab } from '@/lib/feed-links';

export const dynamic = 'force-dynamic';

// Shared lane links (/feed?tab=markets, /feed?q=market) get their own title
// and description so redirects look intentional in previews.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tab = normalizeFeedTab(first(sp.tab) ?? first(sp.q));
  if (tab === 'all' || tab === 'profile' || tab === 'bookmarks') return {};
  const label = feedTabLabel(tab);
  const title = `${label} news | Trace`;
  const description = `Today's ${label.toLowerCase()} stories, ranked across outlets and summarized with key points.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.yourtrace.online/feed?tab=${tab}`,
    },
    twitter: { title, description },
  };
}

// The redesigned feed. Access is resolved server-side from the Trace
// session cookie inside FeedScreen (same session the runtime feed uses).
export default function FeedPage() {
  return <FeedScreen />;
}
