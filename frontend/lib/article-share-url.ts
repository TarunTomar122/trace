export const SHARE_SITE_ORIGIN = 'https://www.yourtrace.online';

export const FEED_TYPE_PREFIX: Record<string, string> = {
  for_you: 'fy',
  trending: 'tr',
};

export type ShareableArticle = {
  id: string;
  feed_type?: string;
  metadata?: { feed_type?: string };
};

export function normalizeArticleShareId(article: ShareableArticle): string | null {
  const rawId = typeof article.id === 'string' ? article.id.trim() : '';
  if (!rawId) return null;
  if (rawId.startsWith('fy_') || rawId.startsWith('tr_')) return rawId;
  const prefix = FEED_TYPE_PREFIX[article.feed_type || article.metadata?.feed_type || ''];
  return prefix ? `${prefix}_${rawId}` : null;
}

export function buildArticleShareUrl(article: ShareableArticle): string | null {
  const shareId = normalizeArticleShareId(article);
  return shareId ? `${SHARE_SITE_ORIGIN}/articles/${shareId}` : null;
}
