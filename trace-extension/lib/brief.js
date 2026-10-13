const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_POOL_SIZE = 60;
export const FREE_SUMMARY_LIMIT = 5;

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function safeUrl(value, label) {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a URL`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${label} must be a URL`);
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new TypeError(`${label} must use HTTP or HTTPS`);
  }
  return url.toString();
}

function normalizeArticle(value, responseVersion = 5) {
  assertObject(value, 'Article');
  if (typeof value.id !== 'string' || !value.id.trim()) throw new TypeError('Article id is required');
  if (value.channel !== 'edition') throw new TypeError('Edition article channel is required');
  if (typeof value.title !== 'string' || !value.title.trim()) throw new TypeError('Article title is required');

  const thumbnail = value.thumbnail ? safeUrl(value.thumbnail, 'Article thumbnail') : undefined;
  if (typeof value.tag !== 'string' || !value.tag.trim()) {
    throw new TypeError('Article story tag is required');
  }
  const content = Array.isArray(value.content)
    ? value.content
        .filter((block) => (
          block
          && ['heading', 'paragraph', 'list_item'].includes(block.type)
          && typeof block.text === 'string'
          && block.text.trim()
        ))
        .map((block) => ({ type: block.type, text: block.text.trim() }))
    : [];
  if (!content.length) throw new TypeError('Article full-read content is required');

  const id = responseVersion === 4 ? value.id.trim().replace(/^edition:/, '') : value.id.trim();
  const shareUrl = value.share_url || (/^(?:fy|tr)_/.test(id) ? `https://www.yourtrace.online/articles/${id}` : '');

  return {
    id,
    channel: value.channel,
    title: value.title.trim(),
    summary: typeof value.summary === 'string' ? value.summary.trim() : '',
    content,
    tag: value.tag.trim(),
    sourceUrl: safeUrl(value.source_url, 'Article source'),
    shareUrl: shareUrl ? safeUrl(shareUrl, 'Article share URL') : '',
    source: typeof value.source === 'string' ? value.source.trim() : '',
    publishedAt: typeof value.published_at === 'string' ? value.published_at.trim() : '',
    keyTakeaways: Array.isArray(value.key_takeaways)
      ? value.key_takeaways.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 4)
      : [],
    ...(thumbnail ? { thumbnail } : {}),
  };
}

export function normalizeBookmarks(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map((article) => normalizeArticle({
    ...article,
    source_url: article?.sourceUrl,
    share_url: article?.shareUrl,
    published_at: article?.publishedAt,
    key_takeaways: article?.keyTakeaways,
  })).filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
}

export function normalizeRemoteBookmarks(value) {
  if (!Array.isArray(value)) return [];
  return normalizeBookmarks(value.flatMap((bookmark) => {
    const metadata = bookmark?.item_metadata;
    if (!metadata || typeof bookmark?.item_id !== 'string') return [];
    const description = typeof metadata.description === 'string' && metadata.description.trim()
      ? metadata.description.trim()
      : metadata.title;
    const shareUrl = /^(?:fy|tr)_/.test(bookmark.item_id)
      ? `https://www.yourtrace.online/articles/${bookmark.item_id}`
      : '';
    const sourceUrl = metadata.url || shareUrl;
    if (!sourceUrl) return [];
    return [{
      id: bookmark.item_id,
      channel: 'edition',
      title: metadata.title,
      summary: description,
      content: [{ type: 'paragraph', text: description }],
      tag: Array.isArray(metadata.tags) && metadata.tags[0] ? metadata.tags[0] : 'Saved',
      sourceUrl,
      shareUrl,
      source: metadata.source || '',
      publishedAt: metadata.timestamp || '',
      keyTakeaways: [],
      ...(metadata.thumbnail ? { thumbnail: metadata.thumbnail } : {}),
    }];
  }));
}

export function normalizeArticlePool(payload) {
  assertObject(payload, 'Article response');
  if (![4, 5].includes(payload.version)) throw new TypeError('Unsupported article response version');
  if (typeof payload.feed_date !== 'string' || !payload.feed_date.trim()) {
    throw new TypeError('Article feed date is required');
  }
  if (!Array.isArray(payload.articles)) throw new TypeError('Articles are required');

  const seen = new Set();
  const articles = payload.articles
    .slice(0, MAX_POOL_SIZE)
    .map((article) => normalizeArticle(article, payload.version))
    .filter((article) => {
      if (seen.has(article.id) || seen.has(article.sourceUrl)) return false;
      seen.add(article.id);
      seen.add(article.sourceUrl);
      return true;
    });
  if (articles.length < 30) throw new TypeError('At least 30 articles are required');
  if (!articles.every(({ channel }) => channel === 'edition')) {
    throw new TypeError('Only Edition articles are supported');
  }

  return {
    version: 5,
    feedDate: payload.feed_date.trim(),
    generatedAt: typeof payload.generated_at === 'string' ? payload.generated_at : null,
    articles,
  };
}

function shuffle(items, random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function selectRandomArticles(articles, limit = 31, random = Math.random) {
  const count = Math.max(0, Math.trunc(limit));
  return shuffle(articles, random).slice(0, count);
}

export function filterArticlesByTag(articles, tag) {
  return tag ? articles.filter((article) => article.tag === tag) : articles;
}

export function isCacheFresh(cachedAt, now = Date.now()) {
  const timestamp = typeof cachedAt === 'string' ? Date.parse(cachedAt) : Number.NaN;
  return Number.isFinite(timestamp) && now >= timestamp && now - timestamp < CACHE_TTL_MS;
}

export function normalizeSummaryReads(value, date = new Date().toISOString().slice(0, 10)) {
  if (!value || value.date !== date || !Array.isArray(value.ids)) return { date, ids: [] };
  return { date, ids: [...new Set(value.ids.filter((id) => typeof id === 'string' && id))] };
}

// Trace is free: every reader can open every summary. The read log stays for
// the "seen" state; the old five-a-day cap is gone.
export function canOpenSummary() {
  return true;
}

export function addSummaryRead(reads, articleId) {
  if (reads.ids.includes(articleId) || reads.ids.length >= FREE_SUMMARY_LIMIT) return reads;
  return { ...reads, ids: [...reads.ids, articleId] };
}
