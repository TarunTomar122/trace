const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_POOL_SIZE = 60;

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

function normalizeArticle(value) {
  assertObject(value, 'Article');
  if (typeof value.id !== 'string' || !value.id.trim()) throw new TypeError('Article id is required');
  if (!['edition', 'pulse'].includes(value.channel)) throw new TypeError('Article channel is required');
  if (typeof value.title !== 'string' || !value.title.trim()) throw new TypeError('Article title is required');

  const thumbnail = value.thumbnail ? safeUrl(value.thumbnail, 'Article thumbnail') : undefined;
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

  return {
    id: value.id.trim(),
    channel: value.channel,
    title: value.title.trim(),
    summary: typeof value.summary === 'string' ? value.summary.trim() : '',
    content,
    sourceUrl: safeUrl(value.source_url, 'Article source'),
    source: typeof value.source === 'string' ? value.source.trim() : '',
    publishedAt: typeof value.published_at === 'string' ? value.published_at.trim() : '',
    keyTakeaways: Array.isArray(value.key_takeaways)
      ? value.key_takeaways.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 4)
      : [],
    ...(thumbnail ? { thumbnail } : {}),
  };
}

export function normalizeArticlePool(payload) {
  assertObject(payload, 'Article response');
  if (payload.version !== 3) throw new TypeError('Unsupported article response version');
  if (typeof payload.feed_date !== 'string' || !payload.feed_date.trim()) {
    throw new TypeError('Article feed date is required');
  }
  if (!Array.isArray(payload.articles)) throw new TypeError('Articles are required');

  const seen = new Set();
  const articles = payload.articles
    .slice(0, MAX_POOL_SIZE)
    .map(normalizeArticle)
    .filter((article) => {
      if (seen.has(article.id) || seen.has(article.sourceUrl)) return false;
      seen.add(article.id);
      seen.add(article.sourceUrl);
      return true;
    });
  if (articles.length < 15) throw new TypeError('At least 15 articles are required');
  if (!articles.some(({ channel }) => channel === 'edition')
      || !articles.some(({ channel }) => channel === 'pulse')) {
    throw new TypeError('Edition and Pulse articles are required');
  }

  return {
    version: 3,
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

export function selectRandomArticles(articles, limit = 15, random = Math.random) {
  const count = Math.max(0, Math.trunc(limit));
  const selected = shuffle(articles, random).slice(0, count);
  const edition = articles.filter((article) => article.channel === 'edition');
  const pulse = articles.filter((article) => article.channel === 'pulse');

  if (selected.length > 1 && edition.length && pulse.length) {
    for (const channel of ['edition', 'pulse']) {
      if (selected.some((article) => article.channel === channel)) continue;
      const replacement = shuffle(channel === 'edition' ? edition : pulse, random)
        .find((article) => !selected.some((item) => item.id === article.id));
      const replaceIndex = selected.findLastIndex((article) => article.channel !== channel);
      if (replacement && replaceIndex >= 0) selected[replaceIndex] = replacement;
    }
  }

  return shuffle(selected, random);
}

export function isCacheFresh(cachedAt, now = Date.now()) {
  const timestamp = typeof cachedAt === 'string' ? Date.parse(cachedAt) : Number.NaN;
  return Number.isFinite(timestamp) && now >= timestamp && now - timestamp < CACHE_TTL_MS;
}
