import type { FeedItem, V3UserFeed } from './firestore.ts';
import { decodeHtmlEntities, stripMarkdown } from './feed-article-text.ts';

export type ExtensionArticle = {
  id: string;
  channel: 'edition' | 'pulse';
  title: string;
  summary: string;
  content: Array<{
    type: 'heading' | 'paragraph' | 'list_item';
    text: string;
  }>;
  source?: string;
  source_url: string;
  thumbnail?: string;
  published_at?: string;
  key_takeaways: string[];
};

export type ExtensionBrief = {
  version: 3;
  feed_date: string;
  assembled_at?: string;
  generated_at: string;
  articles: ExtensionArticle[];
};

const MAX_ARTICLES_PER_CHANNEL = 30;

export function hasCompleteExtensionPool(articles: ExtensionArticle[]): boolean {
  return articles.length >= 15
    && articles.some((article) => article.channel === 'edition')
    && articles.some((article) => article.channel === 'pulse');
}

function cleanDisplayText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return decodeHtmlEntities(stripMarkdown(value))
    .replace(/\u2014/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBlockText(value: string): string {
  return cleanDisplayText(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function toContentBlocks(value: unknown): ExtensionArticle['content'] {
  if (typeof value !== 'string') return [];
  const blocks: ExtensionArticle['content'] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = cleanBlockText(paragraph.join(' '));
    if (text) blocks.push({ type: 'paragraph', text });
    paragraph = [];
  };

  value.replace(/\r/g, '').split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      return;
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const text = cleanBlockText(heading[1]);
      if (text) blocks.push({ type: 'heading', text });
      return;
    }

    const listItem = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (listItem) {
      flushParagraph();
      const text = cleanBlockText(listItem[1]);
      if (text) blocks.push({ type: 'list_item', text });
      return;
    }

    paragraph.push(line);
  });
  flushParagraph();
  return blocks;
}

function safeWebUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function uniqueFeedItems(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const url = safeWebUrl(item.url);
    const key = url || cleanDisplayText(item.id);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toExtensionArticle(item: FeedItem, channel: ExtensionArticle['channel']): ExtensionArticle | null {
  const sourceUrl = safeWebUrl(item.url)
    || item.sources?.map((source) => safeWebUrl(source.url)).find(Boolean);
  const title = cleanDisplayText(item.title);
  if (!sourceUrl || !title) return null;

  const short = item.summary?.short_article;
  const thumbnail = safeWebUrl(item.thumbnail);
  const matchingSource = item.sources?.find((entry) => safeWebUrl(entry.url) === sourceUrl);
  const source = cleanDisplayText(item.source_name || item.source || matchingSource?.name)
    || new URL(sourceUrl).hostname.replace(/^www\./, '');
  const publishedAt = cleanDisplayText(item.published_at || item.published_date);
  const summary = cleanDisplayText(short?.subtitle || item.description);
  const content = toContentBlocks(short?.body || short?.subtitle || item.description);
  if (!content.length) return null;

  return {
    id: `${channel}:${cleanDisplayText(item.id) || sourceUrl}`,
    channel,
    title,
    summary,
    content,
    source_url: sourceUrl,
    key_takeaways: Array.isArray(short?.key_takeaways)
      ? short.key_takeaways.map(cleanDisplayText).filter(Boolean).slice(0, 4)
      : [],
    ...(source ? { source } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    ...(publishedAt ? { published_at: publishedAt } : {}),
  };
}

function buildChannel(items: FeedItem[], channel: ExtensionArticle['channel']): ExtensionArticle[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  return uniqueFeedItems(items)
    .flatMap((item) => {
      const article = toExtensionArticle(item, channel);
      return article ? [article] : [];
    })
    .filter((article) => {
      if (seenIds.has(article.id) || seenUrls.has(article.source_url)) return false;
      seenIds.add(article.id);
      seenUrls.add(article.source_url);
      return true;
    });
}

export function buildExtensionBrief(feed: V3UserFeed): ExtensionBrief {
  const editionItems = [
    ...(feed.for_you || []),
    ...(feed.trending || []),
    ...(feed.trending_topics || []).flatMap((topic) => topic.articles || []),
  ];
  const pulseItems = [
    ...(feed.pulse || []),
    ...(feed.build_pulse || []),
    ...(feed.community_pulse || []),
    ...(feed.daily_pulse?.tools || []),
    ...(feed.daily_pulse?.blogs || []),
    ...(feed.daily_pulse?.discussions || []),
  ];

  const edition = buildChannel(editionItems, 'edition').slice(0, MAX_ARTICLES_PER_CHANNEL);
  const editionUrls = new Set(edition.map((article) => article.source_url));
  const pulse = buildChannel(pulseItems, 'pulse')
    .filter((article) => !editionUrls.has(article.source_url))
    .slice(0, MAX_ARTICLES_PER_CHANNEL);

  return {
    version: 3,
    feed_date: feed.date,
    ...(feed.assembled_at ? { assembled_at: feed.assembled_at } : {}),
    generated_at: new Date().toISOString(),
    articles: [...edition, ...pulse],
  };
}
