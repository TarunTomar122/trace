import type { FeedItem, TrendingTopic } from '@/lib/firestore';
import { dedupeByStoryTitle, isSameStoryTitle } from '@/lib/feed-story-dedupe';

/** Rolling freshness window for news feed sections (trending, topics, for_you). */
export const FEED_CONTENT_MAX_AGE_HOURS = 36;

const MAX_AGE_MS = FEED_CONTENT_MAX_AGE_HOURS * 60 * 60 * 1000;

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function canonicalUrlKey(url?: string | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

function sourceTitleKey(item: Pick<FeedItem, 'title' | 'source' | 'source_name'>): string {
  const source = String(item.source_name || item.source || '').trim().toLowerCase();
  const title = normalizeTitle(item.title || '');
  if (!title) return '';
  return `${source}|${title}`;
}

export function getFeedItemTimestamp(
  item: Pick<FeedItem, 'published_date' | 'published_at' | 'fetched_at'>,
): string | undefined {
  return item.published_date || item.published_at || item.fetched_at;
}

export function isWithinFeedMaxAge(timestamp?: string | null): boolean {
  // Daily feed items often lack a precise published_date — keep them rather than drop.
  if (!timestamp) return true;
  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts <= MAX_AGE_MS;
}

export function filterFeedItemsByMaxAge(items: FeedItem[]): FeedItem[] {
  return items.filter((item) => isWithinFeedMaxAge(getFeedItemTimestamp(item)));
}

function latestTopicTimestamp(topic: TrendingTopic): string | undefined {
  const stamps = (topic.articles || [])
    .map((article) => getFeedItemTimestamp(article))
    .filter((value): value is string => Boolean(value));
  if (stamps.length === 0) return undefined;
  return stamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

export function filterTrendingTopicsByMaxAge(items: TrendingTopic[]): TrendingTopic[] {
  return items
    .filter((topic) => isWithinFeedMaxAge(latestTopicTimestamp(topic)))
    .map((topic) => ({
      ...topic,
      articles: filterFeedItemsByMaxAge(topic.articles || []),
    }))
    .filter((topic) => (topic.articles?.length ?? 0) > 0);
}

export function dedupeFeedItems(items: FeedItem[]): FeedItem[] {
  const seenUrl = new Set<string>();
  const seenId = new Set<string>();
  const seenSourceTitle = new Set<string>();
  const out: FeedItem[] = [];

  for (const item of items) {
    const urlKey = canonicalUrlKey(item.url);
    const idKey = String(item.id || '').trim();
    const titleKey = sourceTitleKey(item);

    if (urlKey && seenUrl.has(urlKey)) continue;
    if (idKey && seenId.has(idKey)) continue;
    if (titleKey && seenSourceTitle.has(titleKey)) continue;

    if (urlKey) seenUrl.add(urlKey);
    if (idKey) seenId.add(idKey);
    if (titleKey) seenSourceTitle.add(titleKey);
    out.push(item);
  }

  return out;
}

export function dedupeTrendingTopics(items: TrendingTopic[]): TrendingTopic[] {
  const seenTopic = new Set<string>();
  const seenUrl = new Set<string>();
  const out: TrendingTopic[] = [];

  for (const topic of items) {
    const topicKey =
      String(topic.topic_key || topic.id || '').trim() || normalizeTitle(topic.title || '');
    if (!topicKey || seenTopic.has(topicKey)) continue;

    const articles = (topic.articles || []).filter((article) => {
      const urlKey = canonicalUrlKey(article.url);
      if (urlKey && seenUrl.has(urlKey)) return false;
      if (urlKey) seenUrl.add(urlKey);
      return true;
    });
    if (articles.length === 0) continue;

    seenTopic.add(topicKey);
    out.push({ ...topic, articles });
  }

  return out;
}

export function applyFeedDedupe<
  T extends {
    for_you?: FeedItem[];
    trending?: FeedItem[];
    trending_topics?: TrendingTopic[];
  },
>(feed: T): T {
  const forYou = dedupeByStoryTitle(dedupeFeedItems(feed.for_you || []));
  const trendingTopics = dedupeTrendingTopics(feed.trending_topics || []);
  const topicArticleUrls = new Set<string>();
  for (const topic of trendingTopics) {
    for (const article of topic.articles || []) {
      const key = canonicalUrlKey(article.url);
      if (key) topicArticleUrls.add(key);
    }
  }

  const topicTitleList = trendingTopics
    .map((topic) => topic.title || '')
    .filter(Boolean);
  const forYouDeduped = forYou.filter((item) => {
    const urlKey = canonicalUrlKey(item.url);
    if (urlKey && topicArticleUrls.has(urlKey)) return false;
    const title = item.title || '';
    if (title && topicTitleList.some((topicTitle) => isSameStoryTitle(title, topicTitle))) {
      return false;
    }
    return true;
  });

  const trendingFiltered = dedupeByStoryTitle(dedupeFeedItems(feed.trending || [])).filter((item) => {
    const urlKey = canonicalUrlKey(item.url);
    return !urlKey || !topicArticleUrls.has(urlKey);
  });

  const trendingDeduped = dedupeFeedItems(
    trendingFiltered.filter((item) => {
      const title = item.title || '';
      if (!title) return true;
      return !topicTitleList.some((topicTitle) => isSameStoryTitle(title, topicTitle));
    }),
  );

  return {
    ...feed,
    for_you: forYouDeduped,
    trending: trendingDeduped,
    trending_topics: trendingTopics,
  };
}

/** Age filter + dedupe — use on mobile/API paths that need a rolling window. */
export function applyFeedFreshnessAndDedupe<
  T extends {
    for_you?: FeedItem[];
    trending?: FeedItem[];
    trending_topics?: TrendingTopic[];
  },
>(feed: T): T {
  return applyFeedDedupe({
    ...feed,
    for_you: filterFeedItemsByMaxAge(feed.for_you || []),
    trending: filterFeedItemsByMaxAge(feed.trending || []),
    trending_topics: filterTrendingTopicsByMaxAge(feed.trending_topics || []),
  });
}
