import { TRACE_WEBSITE_URL } from '@/constants/contact';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';

export const SHARE_SITE_ORIGIN = TRACE_WEBSITE_URL;

const FEED_TYPE_PREFIX: Record<string, string> = {
  for_you: 'fy',
  trending: 'tr',
};

export type ShareableArticle = Pick<FeedItem, 'id' | 'feed_type' | 'metadata'>;

export function normalizeArticleShareId(article: ShareableArticle): string | null {
  const rawId = typeof article.id === 'string' ? article.id.trim() : '';
  if (!rawId) return null;

  if (rawId.startsWith('fy_') || rawId.startsWith('tr_')) {
    return rawId;
  }

  const feedType = article.feed_type || article.metadata?.feed_type;
  const prefix = feedType ? FEED_TYPE_PREFIX[feedType] : null;
  if (!prefix) return null;

  return `${prefix}_${rawId}`;
}

export function buildArticleShareUrl(article: ShareableArticle): string | null {
  const shareId = normalizeArticleShareId(article);
  if (!shareId) return null;
  return `${SHARE_SITE_ORIGIN}/articles/${shareId}`;
}

export function buildTopicShareUrl(topic: Pick<TrendingTopic, 'id' | 'topic_key'>): string | null {
  const topicSlug = topic.topic_key || topic.id;
  if (!topicSlug) return null;
  return `${SHARE_SITE_ORIGIN}/topics/${encodeURIComponent(topicSlug)}`;
}

export function isSingletonTopic(topic: Pick<TrendingTopic, 'source_count' | 'article_count'>): boolean {
  return (topic.source_count ?? 0) <= 1 || (topic.article_count ?? 0) <= 1;
}

export function buildTopicCardShareUrl(
  topic: TrendingTopic,
  primaryArticle?: FeedItem | null,
): string | null {
  if (isSingletonTopic(topic) && primaryArticle) {
    return buildArticleShareUrl(primaryArticle) || buildTopicShareUrl(topic);
  }
  return buildTopicShareUrl(topic);
}

export function formatShareMessage(overview: string, shareUrl?: string | null): string {
  const excerpt = overview.trim().slice(0, 300);
  const url = shareUrl?.trim() || SHARE_SITE_ORIGIN;
  return excerpt ? `${excerpt}\n\n${url}` : url;
}
