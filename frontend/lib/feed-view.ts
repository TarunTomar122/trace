import { unstable_cache } from 'next/cache';
import type { FeedStory, PulseItem } from '@/components/feed-v2/FeedApp';
import { parseHeadlines, type HeadlineRef } from '@/lib/story-headlines';
import { imageUrlHasPlaceholderToken } from './media-url';
import { isSameStoryTitle } from '@/lib/feed-story-dedupe';
import { canonicalUrlKey } from '@/lib/feed-dedupe';
import { slotsFromRankedItems } from '@/lib/feed-topic-order';
import { filterSendWorthyTopics, rejectedStoryUrls } from './feed-value';
import { decodeHtmlEntities } from './feed-article-text';
import { canonicalLane } from './feed-links';

// Server-side feed data builders shared by /feed (FeedScreen) and
// /story/[id] (shared article page renders the real feed chrome).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

// Shared request cache: feed data is at most 60 seconds stale.
const getCachedFeed = unstable_cache(
  async (): Promise<{ date: string; data: Doc } | null> => {
    try {
      const { adminFirestore } = await import('@/lib/firebase-admin');
      if (!adminFirestore) return null;
      const ref = adminFirestore.collection('v3_user_feeds').doc('_global').collection('daily');
      const snap = await ref.orderBy('__name__', 'desc').limit(5).get();
      let picked: { date: string; data: Doc } | null = null;
      let pulseDoc: Doc | null = null;
      const hasPulse = (data: Doc) => {
        const dev = data.daily_pulse_roles?.developer;
        return Boolean(dev && ((dev.tools || []).length > 0 || (dev.discussions || []).length > 0 || (dev.blogs || []).length > 0));
      };
      for (const doc of snap.docs) {
        const data = doc.data();
        if (!picked && (data.trending || []).length > 0) picked = { date: doc.id, data };
        if (!pulseDoc && hasPulse(data)) pulseDoc = data;
        if (picked && pulseDoc) break;
      }
      if (!picked) return null;
      // After midnight the new day's doc has trending long before the
      // 3-hourly pulse merges its sections in — backfill pulse from the
      // newest doc that has it (same as mobile's snapshot merge).
      if (pulseDoc && pulseDoc !== picked.data && !hasPulse(picked.data)) {
        picked = { date: picked.date, data: { ...picked.data, daily_pulse_roles: pulseDoc.daily_pulse_roles } };
      }
      return picked;
    } catch (error) {
      console.error('[feed-view] failed to load global feed:', error);
      return null;
    }
  },
  ['global-feed-v2'],
  { revalidate: 60 },
);

export const getPromotedTools = unstable_cache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any[]> => {
    try {
      const { adminFirestore } = await import('@/lib/firebase-admin');
      if (!adminFirestore) return [];
      const snap = await adminFirestore.collection('promoted_tools').where('status', '==', 'active').get();
      const now = Date.now();
      return snap.docs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((d: any) => ({ id: d.id, ...(d.data() as Doc) }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((t: any) => {
          const exp = t.expires_at;
          const ms =
            exp && typeof exp.toMillis === 'function' ? exp.toMillis()
            : exp instanceof Date ? exp.getTime()
            : 0;
          return !ms || ms > now;
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => Number(b.created_at?.toMillis?.() || 0) - Number(a.created_at?.toMillis?.() || 0))
        .slice(0, 3)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((t: any) => ({ id: t.id, title: t.title || '', url: t.url || '#', sub: t.subtext || '' }));
    } catch {
      return [];
    }
  },
  ['promoted-tools'],
  { revalidate: 300 },
);

// Unique visitors to yourtrace.online over the last 30 days (PostHog
// $pageview), falling back to the signed-in monthly-active count from Firestore.
async function monthlyActiveCount(): Promise<number> {
  try {
    const { adminFirestore } = await import('@/lib/firebase-admin');
    if (!adminFirestore) return 0;
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const snap = await adminFirestore
      .collection('user_profiles')
      .where('lastActiveAt', '>', monthAgo)
      .count()
      .get();
    return snap.data().count || 0;
  } catch {
    return 0;
  }
}

let cachedPhProject: string | null = null;

async function siteVisitorsLast30Days(): Promise<number> {
  const personalKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!personalKey) return 0;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
  try {
    if (!cachedPhProject) {
      const res = await fetch(`${host}/api/projects/`, {
        headers: { Authorization: `Bearer ${personalKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      const id = data?.results?.[0]?.id;
      if (!id) return 0;
      cachedPhProject = String(id);
    }
    const res = await fetch(`${host}/api/projects/${cachedPhProject}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${personalKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: {
          kind: 'HogQLQuery',
          query:
            "SELECT count(DISTINCT distinct_id) AS visitors FROM events WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY AND timestamp < now() AND properties.$host ILIKE '%yourtrace.online%'",
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const n = Number(data?.results?.[0]?.[0]);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  } catch {
    return 0;
  }
}

const getMonthlyReach = unstable_cache(
  async (): Promise<number> => {
    const visitors = await siteVisitorsLast30Days();
    if (visitors > 0) return visitors;
    return monthlyActiveCount();
  },
  ['monthly-reach-v2'],
  { revalidate: 21600 },
);

export function thumb(url?: string | null): string | null {
  if (!url || typeof url !== 'string' || url.length < 10) return null;
  if (!/^https?:\/\//.test(url)) return null;
  if (imageUrlHasPlaceholderToken(url)) return null;
  return url;
}

function firstThumb(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    const value = thumb(url);
    if (value) return value;
  }
  return null;
}

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function dedupeKey(it: { url?: string; id?: string }): string {
  return (it.url || it.id || '').replace(/[#?].*$/, '').replace(/\/$/, '');
}

export interface FeedViewData {
  stories: FeedStory[];
  headlines: HeadlineRef[];
  pulse: { tools: PulseItem[]; discussions: PulseItem[]; blogs: PulseItem[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promoted: any[];
  monthlyReach: number;
  generated: string | null;
  feedDate: string;
  feedError: boolean;
}

/**
 * Map one daily doc's flat `trending` items (+ `trending_topics` grouping)
 * into FeedStory cards. Shared by today's feed and the older-stories API.
 *
 * Walk the ranked `trending` edition first so a #1 singleton (lab-blog model
 * launch, etc.) is not buried behind 48 coverage-sorted topic cards. Topic
 * grouping still wins when a ranked URL already belongs to a cluster.
 */
export function mapTrendingToStories(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trending: any[] | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trendingTopics: any[] | undefined,
): FeedStory[] {
  const domainOf = (url: string): string => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  };

  // Jev marks stories with no reader value (puzzle answers, executive moves,
  // opinion pieces) as jev_send_worthy === 0. They must not reach a lane, and
  // flat rows pointing at their URLs go with them.
  const usableTopics = filterSendWorthyTopics(trendingTopics || []);
  const rejectedUrls = rejectedStoryUrls(trendingTopics);

  const topicIndex = new Map<object, number>();
  usableTopics.forEach((topic, i) => topicIndex.set(topic, i));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topicStory = (topic: any, i: number): FeedStory | null => {
    const articles = (topic?.articles || []).filter((a: { url?: string }) => a?.url);
    if (!topic?.title && articles.length === 0) return null;

    const first = articles[0] || {};
    // Newest dated article (an undated first one must not hide the rest), else
    // the topic's last update: the same age the email measures.
    const newest = articles.reduce(
      (best: { published_date?: string }, a: { published_date?: string }) =>
        (Date.parse(a?.published_date || '') > (Date.parse(best?.published_date || '') || 0) ? a : best),
      first,
    );
    const newestDate = newest?.published_date || first.published_date
      || (typeof topic.last_updated_at === 'string' ? topic.last_updated_at : '');
    const sources: string[] = [];
    for (const a of articles) {
      const d = domainOf(a.url);
      if (d && !sources.includes(d)) sources.push(d);
    }
    let source = first.source_name || first.source || sources[0] || '';
    if (!source) source = domainOf(first.url || '');

    const coverage = articles.map((a: { title?: string; source_name?: string; source?: string; url: string; published_date?: string }) => ({
      title: decodeHtmlEntities(a.title || ''),
      source: a.source_name || a.source || domainOf(a.url),
      url: a.url,
      time: timeAgo(a.published_date),
    }));

    let img = firstThumb(topic.thumbnail, first.thumbnail, first.og_image, first.image);
    if (!img) {
      for (const article of articles) {
        img = firstThumb(article.thumbnail, article.og_image, article.image);
        if (img) break;
      }
    }

    return {
      id: topic.id || topic.topic_key || `topic-${i}`,
      threadId: topic.thread_id || undefined,
      rank: i + 1,
      title: decodeHtmlEntities(topic.title || first.title || ''),
      body: topic.summary || first.summary?.short_article?.body || first.description || '',
      takeaways: Array.isArray(topic.key_points) ? topic.key_points : [],
      img,
      source,
      sources,
      sourceNames: source ? [source] : [],
      coverage,
      time: timeAgo(newestDate),
      ts: Date.parse(newestDate) || 0,
      cat: canonicalLane(topic.interest_id || first.interest_id),
      url: first.url || '#',
      tags: Array.isArray(topic.tags) ? topic.tags.filter((t: unknown) => typeof t === 'string') : [],
      // Carried so the Home edition can drop stories Jev judged worthless.
      sendWorthy: typeof topic.jev_send_worthy === 'number' ? topic.jev_send_worthy : null,
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemStory = (it: any): FeedStory | null => {
    const url = String(it?.url || '');
    if (!url) return null;
    const sa = it.summary?.short_article || {};
    let source = it.source_name || it.source || '';
    const domain = domainOf(url);
    if (!source) source = domain;
    return {
      id: it.id || url,
      rank: 0,
      title: decodeHtmlEntities(it.title || ''),
      body: sa.body || it.description || '',
      takeaways: Array.isArray(sa.key_takeaways) ? sa.key_takeaways : [],
      img: firstThumb(it.thumbnail, it.og_image, it.image),
      source,
      sources: domain ? [domain] : [],
      sourceNames: source ? [source] : [],
      coverage: [{ title: decodeHtmlEntities(it.title || ''), source, url, time: timeAgo(it.published_date) }],
      time: timeAgo(it.published_date),
      ts: Date.parse(it?.published_date || '') || 0,
      cat: canonicalLane(it.interest_id),
      url,
      sendWorthy: typeof it.jev_send_worthy === 'number' ? it.jev_send_worthy : null,
    };
  };

  const stories: FeedStory[] = [];
  const usableTrending = (trending || []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) =>
      !rejectedUrls.has(String(item?.url || '').trim()) && item?.jev_send_worthy !== 0,
  );
  for (const slot of slotsFromRankedItems(usableTrending, usableTopics, (url) => canonicalUrlKey(url) || url)) {
    const story = slot.kind === 'topic'
      ? topicStory(slot.topic, topicIndex.get(slot.topic) ?? stories.length)
      : itemStory(slot.item);
    if (story) stories.push(story);
  }

  return foldSameEventStories(stories);
}

function coverageUrls(story: FeedStory): string[] {
  return [story.url, ...story.coverage.map((link) => link.url)].filter(Boolean);
}

function sameEventStory(a: FeedStory, b: FeedStory): boolean {
  if (a.threadId && b.threadId && a.threadId === b.threadId) return true;
  const aUrls = new Set(coverageUrls(a).map((url) => canonicalUrlKey(url)).filter(Boolean));
  for (const url of coverageUrls(b)) {
    const key = canonicalUrlKey(url);
    if (key && aUrls.has(key)) return true;
  }
  if (isSameStoryTitle(a.title, b.title)) return true;
  if (a.coverage.some((link) => link.title && isSameStoryTitle(link.title, b.title))) return true;
  if (b.coverage.some((link) => link.title && isSameStoryTitle(link.title, a.title))) return true;
  return false;
}

function mergeStoryCoverage(target: FeedStory, extra: FeedStory): void {
  const extraRicher = extra.coverage.length > target.coverage.length;
  if (extraRicher) {
    target.title = extra.title || target.title;
    target.body = extra.body || target.body;
    target.takeaways = extra.takeaways.length ? extra.takeaways : target.takeaways;
    target.source = extra.source || target.source;
    if (extra.img) target.img = extra.img;
    target.cat = extra.cat || target.cat;
    if (extra.tags?.length) target.tags = extra.tags;
    target.url = extra.url || target.url;
  } else if (!target.img && extra.img) {
    target.img = extra.img;
  }
  if (!target.body && extra.body) target.body = extra.body;
  if (!target.takeaways.length && extra.takeaways.length) target.takeaways = extra.takeaways;

  const seen = new Set(target.coverage.map((link) => canonicalUrlKey(link.url)).filter(Boolean));
  for (const link of extra.coverage) {
    const key = canonicalUrlKey(link.url);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    target.coverage.push(link);
  }
  for (const domain of extra.sources) {
    if (domain && !target.sources.includes(domain)) target.sources.push(domain);
  }
  for (const name of extra.sourceNames) {
    if (name && !target.sourceNames.includes(name)) target.sourceNames.push(name);
  }
  if (!target.threadId && extra.threadId) target.threadId = extra.threadId;
  if (extra.ts > target.ts) {
    target.ts = extra.ts;
    if (extra.time) target.time = extra.time;
  }
  const merged = new Set(target.mergedIds || []);
  merged.add(extra.id);
  for (const id of extra.mergedIds || []) merged.add(id);
  target.mergedIds = [...merged];
}

/** Fold same-event singletons and split clusters into one coverage card. */
export function foldSameEventStories(stories: FeedStory[]): FeedStory[] {
  const out: FeedStory[] = [];
  for (const story of stories) {
    const match = out.find((existing) => sameEventStory(existing, story));
    if (match) {
      mergeStoryCoverage(match, story);
      continue;
    }
    out.push({
      ...story,
      coverage: [...story.coverage],
      sources: [...story.sources],
      sourceNames: [...story.sourceNames],
      mergedIds: story.mergedIds ? [...story.mergedIds] : undefined,
    });
  }
  return out.map((story, i) => ({ ...story, rank: i + 1 }));
}

export async function loadFeedViewData(): Promise<FeedViewData> {
  const [feedResult, promoted, monthlyReach] = await Promise.all([
    getCachedFeed(),
    getPromotedTools(),
    getMonthlyReach(),
  ]);
  const feedDate = feedResult?.date || '';
  const data = feedResult?.data || {};
  const pulse = data.daily_pulse_roles?.developer || { tools: [], discussions: [], blogs: [] };

  const stories = mapTrendingToStories(data.trending, data.trending_topics);
  const headlines = parseHeadlines(data.headlines);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toPulse = (arr: any[]): PulseItem[] =>
    (arr || []).map((t) => ({
      id: t.id,
      title: t.title || '',
      sum: t.summary?.short_article?.body || '',
      sub: t.summary?.body || '',
      source: t.source || t.source_name || '',
      signal: t.signal || '',
      url: t.url || '#',
      img: firstThumb(t.thumbnail, t.og_image, t.image),
      read: t.reading_time_minutes || null,
    }));

  return {
    stories,
    headlines,
    pulse: {
      tools: toPulse(pulse.tools),
      discussions: toPulse(pulse.discussions),
      blogs: toPulse(pulse.blogs),
    },
    promoted,
    monthlyReach,
    generated: data.daily_pulse_role_generated_at?.developer
      ? timeAgo(data.daily_pulse_role_generated_at.developer)
      : null,
    feedDate,
    feedError: !feedResult,
  };
}

/** Walk recent daily archive docs for a shared story that left today's feed. */
export async function findStoryInArchive(id: string, maxDays = 10): Promise<FeedStory | null> {
  try {
    const { adminFirestore } = await import('@/lib/firebase-admin');
    if (!adminFirestore) return null;
    const snap = await adminFirestore
      .collection('v3_user_feeds').doc('_global').collection('daily')
      .orderBy('__name__', 'desc')
      .limit(maxDays + 1)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const story = findSharedStory(mapTrendingToStories(data.trending, data.trending_topics), id);
      if (story) return story;
    }
  } catch (error) {
    console.error('[feed-view] archive story lookup failed:', error);
  }
  return null;
}

/** Find one story by shared id (exact id, then URL-key fallback like StoryShare). */
export function findSharedStory(stories: FeedStory[], id: string): FeedStory | null {
  const direct = stories.find((s) => s.id === id || (s.mergedIds || []).includes(id));
  if (direct) return direct;
  const want = id.replace(/[#?].*$/, '').replace(/\/$/, '');
  if (!want) return null;
  return stories.find((s) => {
    if (s.id === id) return true;
    const key = dedupeKey({ url: s.url, id: s.id });
    if (key !== '' && (key === want || key === id)) return true;
    // Topic cards bundle several articles; a shared link to any of them
    // should open the merged card.
    return s.coverage.some((c) => {
      const ck = dedupeKey({ url: c.url, id: '' });
      return ck !== '' && (ck === want || ck === id);
    });
  }) || null;
}
