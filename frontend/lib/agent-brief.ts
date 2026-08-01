import type { FeedItem, TrendingTopic, V3UserFeed } from '@/lib/firestore';

export type AgentBriefItem = {
  id: string;
  title: string;
  summary: string;
  why_it_matters?: string;
  key_takeaways: string[];
  url?: string;
  sources: Array<{ name: string; title: string; url: string }>;
  published_at?: string;
};

export type AgentBrief = {
  feed_date: string;
  assembled_at?: string;
  generated_at: string;
  top_news: AgentBriefItem[];
  builds: AgentBriefItem[];
  conversations: AgentBriefItem[];
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function fromFeedItem(item: FeedItem): AgentBriefItem {
  const short = item.summary?.short_article;
  return {
    id: item.id,
    title: cleanText(item.title),
    summary: cleanText(short?.subtitle || item.description || short?.body),
    why_it_matters: cleanText(short?.why_it_matters) || undefined,
    key_takeaways: Array.isArray(short?.key_takeaways)
      ? short.key_takeaways.map(cleanText).filter(Boolean).slice(0, 4)
      : [],
    url: cleanText(item.url) || undefined,
    sources: Array.isArray(item.sources)
      ? item.sources
          .filter((source) => source && cleanText(source.url))
          .slice(0, 5)
          .map((source) => ({
            name: cleanText(source.name),
            title: cleanText(source.title),
            url: cleanText(source.url),
          }))
      : [],
    published_at: cleanText(item.published_at || item.published_date) || undefined,
  };
}

function fromTopic(topic: TrendingTopic): AgentBriefItem {
  const leadArticle = topic.articles?.[0];
  return {
    id: topic.id,
    title: cleanText(topic.title),
    summary: cleanText(topic.summary),
    key_takeaways: Array.isArray(topic.key_points)
      ? topic.key_points.map(cleanText).filter(Boolean).slice(0, 4)
      : [],
    url: cleanText(leadArticle?.url) || undefined,
    sources: (topic.articles || [])
      .flatMap((article) => article.sources || [])
      .filter((source, index, sources) => (
        Boolean(cleanText(source.url))
        && sources.findIndex((candidate) => candidate.url === source.url) === index
      ))
      .slice(0, 5)
      .map((source) => ({
        name: cleanText(source.name),
        title: cleanText(source.title),
        url: cleanText(source.url),
      })),
    published_at: cleanText(topic.last_updated_at) || undefined,
  };
}

function unique(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.id || item.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildAgentBrief(feed: V3UserFeed, requestedLimit = 8): AgentBrief {
  const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 8, 1), 20);
  const topics = (feed.trending_topics || []).slice(0, limit).map(fromTopic);
  const fallbackNews = unique([...(feed.trending || []), ...(feed.for_you || [])])
    .slice(0, limit)
    .map(fromFeedItem);
  const builds = unique([...(feed.build_pulse || []), ...(feed.daily_pulse?.tools || [])])
    .slice(0, limit)
    .map(fromFeedItem);
  const conversations = unique([
    ...(feed.community_pulse || []),
    ...(feed.daily_pulse?.discussions || []),
  ])
    .slice(0, limit)
    .map(fromFeedItem);

  return {
    feed_date: feed.date,
    assembled_at: feed.assembled_at,
    generated_at: new Date().toISOString(),
    top_news: topics.length > 0 ? topics : fallbackNews,
    builds,
    conversations,
  };
}
