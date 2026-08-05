import type { FeedItem, V3UserFeed } from './firestore.ts';
import { decodeHtmlEntities, stripMarkdown } from './feed-article-text.ts';

export type ExtensionArticle = {
  id: string;
  channel: 'edition';
  title: string;
  summary: string;
  content: Array<{
    type: 'heading' | 'paragraph' | 'list_item';
    text: string;
  }>;
  tag: string;
  source?: string;
  source_url: string;
  thumbnail?: string;
  published_at?: string;
  key_takeaways: string[];
};

export type ExtensionBrief = {
  version: 4;
  feed_date: string;
  assembled_at?: string;
  generated_at: string;
  articles: ExtensionArticle[];
};

const MAX_ARTICLES = 60;

export function hasCompleteExtensionPool(articles: ExtensionArticle[]): boolean {
  return articles.length >= 30
    && articles.every((article) => article.channel === 'edition');
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

function toExtensionArticle(item: FeedItem): ExtensionArticle | null {
  if (item.type === 'brief') return null;
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
  const rawTag = (Array.isArray(item.tags) ? item.tags.map(cleanDisplayText).find(Boolean) : undefined)
    || cleanDisplayText(item.interest_id);
  const tag = rawTag.replace(/[-_]+/g, ' ');
  if (!tag) return null;
  const summary = cleanDisplayText(short?.subtitle || item.description);
  const content = toContentBlocks(short?.body || short?.subtitle || item.description);
  if (!content.length) return null;

  return {
    id: `edition:${cleanDisplayText(item.id) || sourceUrl}`,
    channel: 'edition',
    title,
    summary,
    content,
    source_url: sourceUrl,
    key_takeaways: Array.isArray(short?.key_takeaways)
      ? short.key_takeaways.map(cleanDisplayText).filter(Boolean).slice(0, 4)
      : [],
    tag,
    ...(source ? { source } : {}),
    ...(thumbnail ? { thumbnail } : {}),
    ...(publishedAt ? { published_at: publishedAt } : {}),
  };
}

function buildEdition(items: FeedItem[]): ExtensionArticle[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  return uniqueFeedItems(items)
    .flatMap((item) => {
      const article = toExtensionArticle(item);
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
  const edition = buildEdition(editionItems).slice(0, MAX_ARTICLES);

  return {
    version: 4,
    feed_date: feed.date,
    ...(feed.assembled_at ? { assembled_at: feed.assembled_at } : {}),
    generated_at: new Date().toISOString(),
    articles: edition,
  };
}
