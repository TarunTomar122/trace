import { getPublicBootstrapFeed } from '@/lib/feed-server';

export type StudioFeedDoc = Record<string, unknown>;

export type StudioNewsFeed = {
  date: string;
  forYou: StudioFeedDoc[];
  topics: StudioFeedDoc[];
  trending: StudioFeedDoc[];
};

/** Same global feed assembly as /feed (2-day lookback, dedupe, role buckets). */
export async function loadStudioNewsFeed(role = 'developer'): Promise<StudioNewsFeed> {
  const feed = await getPublicBootstrapFeed(role);
  if (!feed) {
    return { date: '', forYou: [], topics: [], trending: [] };
  }
  return {
    date: feed.date || '',
    forYou: (feed.for_you || []) as unknown as StudioFeedDoc[],
    topics: (feed.trending_topics || []) as unknown as StudioFeedDoc[],
    trending: (feed.trending || []) as unknown as StudioFeedDoc[],
  };
}

export function markCoveredKeys(
  covered: { ids: Set<string>; urls: Set<string> },
  items: StudioFeedDoc[],
): void {
  for (const item of items) {
    const id = String(item.id || '').trim();
    const url = String(item.url || '').trim();
    if (id) covered.ids.add(id);
    if (url) covered.urls.add(url);
  }
}
