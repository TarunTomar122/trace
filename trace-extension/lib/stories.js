// Trace's stories for the new tab: the site's Home, one card per event
// (GET /api/extension/stories, payload version 6). Everything from the network is
// checked here before it is cached or rendered.

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_STORIES = 40;
const SPONSOR_SLOTS = 3;

function webUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function text(value, max = 4000) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

const CAT_LABELS = { ai: 'AI', markets: 'Markets', robotics: 'Robotics', startups: 'Startups', tech: 'Tech', 'ux-design': 'Design' };

// The site renders **bold** in its copy; plain text here.
function plain(value) {
  return typeof value === 'string' ? value.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1') : value;
}

function paragraphs(value) {
  if (typeof value !== 'string') return [];
  return plain(value).split(/\n\s*\n/).map((part) => text(part)).filter(Boolean).slice(0, 12);
}

function normalizeStory(value) {
  if (!value || typeof value !== 'object') return null;
  const id = text(value.id, 200);
  const title = text(value.title, 300);
  const url = webUrl(value.url);
  if (!id || !title || !url) return null;
  const traceUrl = webUrl(value.trace_url);
  const img = webUrl(value.img);
  const coverage = Array.isArray(value.coverage)
    ? value.coverage
      .map((item) => ({ title: text(item?.title, 300), source: text(item?.source, 80), url: webUrl(item?.url) }))
      .filter((item) => item.title && item.url)
      .slice(0, 4)
    : [];
  const body = text(plain(value.body));
  const detail = paragraphs(value.detail);
  return {
    id,
    title,
    body,
    detail: detail.length ? detail : (body ? [body] : []),
    cat: text(value.cat, 40) || 'tech',
    catLabel: text(value.cat_label, 40) || CAT_LABELS[text(value.cat, 40)] || 'Tech',
    img,
    source: text(value.source, 80),
    sourceCount: Number.isFinite(value.source_count) ? Math.max(1, Math.trunc(value.source_count)) : 1,
    url,
    traceUrl,
    coverage,
    ts: Number.isFinite(value.ts) ? value.ts : 0,
  };
}

function normalizeSponsor(value) {
  const id = text(value?.id, 64);
  const title = text(value?.title, 80);
  const href = webUrl(value?.href);
  if (!id || !title || !href || !href.startsWith('https://www.yourtrace.online/')) return null;
  return { id, title, sub: text(value?.sub, 240), host: text(value?.host, 120), href };
}

export function normalizeStoryPool(payload) {
  if (!payload || typeof payload !== 'object' || payload.version !== 6) throw new TypeError('Unsupported story response');
  if (!Array.isArray(payload.stories)) throw new TypeError('Stories are required');
  const seen = new Set();
  const stories = payload.stories.map(normalizeStory).filter((story) => {
    if (!story || seen.has(story.id) || seen.has(story.url)) return false;
    seen.add(story.id);
    seen.add(story.url);
    return true;
  }).slice(0, MAX_STORIES);
  if (stories.length < 8) throw new TypeError('Too few stories');
  const sponsors = (Array.isArray(payload.sponsors) ? payload.sponsors : []).map(normalizeSponsor).filter(Boolean).slice(0, SPONSOR_SLOTS);
  const sponsorUrl = webUrl(payload.sponsor_url);
  return {
    feedDate: text(payload.feed_date, 20),
    stories,
    sponsors,
    sponsorUrl: sponsorUrl.startsWith('https://www.yourtrace.online/') ? sponsorUrl : '',
  };
}

export function filterStories(stories, cat) {
  return cat ? stories.filter((story) => story.cat === cat) : stories;
}

/** Topic tabs in the site's order, only those with stories today. */
export function storyTopics(stories) {
  const order = ['ai', 'markets', 'robotics', 'startups', 'tech', 'ux-design'];
  const present = new Map(stories.map((story) => [story.cat, story.catLabel]));
  return [...present.keys()]
    .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map((cat) => ({ cat, label: present.get(cat) }));
}

export function isCacheFresh(cachedAt, now = Date.now()) {
  const timestamp = typeof cachedAt === 'string' ? Date.parse(cachedAt) : Number.NaN;
  return Number.isFinite(timestamp) && now >= timestamp && now - timestamp < CACHE_TTL_MS;
}

/** "2h ago" from a ms timestamp; empty when unknown or in the future. */
export function agoLabel(ts, now = Date.now()) {
  if (!Number.isFinite(ts) || ts <= 0 || ts > now + 60_000) return '';
  const minutes = Math.max(1, Math.round((now - ts) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Bookmarks sync with the site's /api/bookmarks (the same records as the web app's Saved).
export function bookmarkPayload(story) {
  return {
    item_id: story.id,
    item_metadata: {
      type: 'article',
      title: story.title,
      // The site refuses an empty description and caps it at 2200 characters.
      ...((story.body || story.detail.join('\n\n')) ? { description: (story.body || story.detail.join('\n\n')).slice(0, 2000) } : {}),
      url: story.url,
      thumbnail: story.img || null,
      tags: [story.cat],
      source: story.source,
      timestamp: story.ts ? new Date(story.ts).toISOString() : '',
    },
  };
}

export function normalizeBookmarks(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((item) => {
    const story = normalizeStory({
      ...item,
      trace_url: item?.traceUrl,
      cat_label: item?.catLabel,
      source_count: item?.sourceCount,
      detail: Array.isArray(item?.detail) ? item.detail.join('\n\n') : item?.detail,
    });
    if (!story || seen.has(story.id)) return [];
    seen.add(story.id);
    return [story];
  });
}

export function normalizeRemoteBookmarks(value, origin = 'https://www.yourtrace.online') {
  if (!Array.isArray(value)) return [];
  return normalizeBookmarks(value.flatMap((bookmark) => {
    const meta = bookmark?.item_metadata;
    if (!meta || typeof bookmark?.item_id !== 'string') return [];
    const ts = Date.parse(meta.timestamp || '');
    return [{
      id: bookmark.item_id,
      title: meta.title,
      body: meta.description || '',
      cat: Array.isArray(meta.tags) && meta.tags[0] ? meta.tags[0] : 'tech',
      img: meta.thumbnail || '',
      source: meta.source || '',
      url: meta.url,
      // fy_ ids are single articles (old new-tab saves); story ids, tr_ ones included, open as stories.
      traceUrl: new URL(`/${/^fy_/.test(bookmark.item_id) ? 'articles' : 'story'}/${encodeURIComponent(bookmark.item_id)}`, origin).toString(),
      ts: Number.isFinite(ts) ? ts : 0,
    }];
  }));
}

/** Puts each [position, item] at that final position in the list (ascending, no shifting). */
export function insertAt(list, inserts) {
  const out = [...list];
  [...inserts].sort((a, b) => a[0] - b[0]).forEach(([at, item]) => {
    if (at <= out.length) out.splice(at, 0, item);
  });
  return out;
}
