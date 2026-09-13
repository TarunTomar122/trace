import { unstable_cache } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession, isTraceSessionProfileFresh } from '@/lib/server-session';
import { hasActiveSubscription } from '@/lib/subscription-access';
import { resolveSubscriptionOfferFromHeaders } from '@/lib/subscription-offer';
import { SUBSCRIPTION_PRICE_DEFAULT } from '@/lib/subscription-pricing';
import type { FeedStory, PulseItem } from '@/components/feed-v2/FeedApp';
import { imageUrlHasPlaceholderToken } from './media-url';

// Server-side feed data builders shared by /feed (FeedScreen) and
// /story/[id] (shared article page renders the real feed chrome).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

// Shared request cache: feed data is at most 5 minutes stale.
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
  ['global-feed'],
  { revalidate: 300 },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPromotedTools = unstable_cache(
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

// Unique visitors to /feed over the last 30 days (PostHog $pageview),
// falling back to the signed-in monthly-active count from Firestore.
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

async function siteVisitorsLastMonth(): Promise<number> {
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
            "SELECT count(DISTINCT distinct_id) AS visitors FROM events WHERE event = '$pageview' AND timestamp >= toStartOfMonth(now() - INTERVAL 1 MONTH) AND timestamp < toStartOfMonth(now())",
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

// PostHog is the truth. Until the Vercel key lands, the Firestore count
// understates reach, so floor the fallback at a conservative 1.5K.
const FALLBACK_REACH = 1500;

const getMonthlyReach = unstable_cache(
  async (): Promise<number> => {
    const visitors = await siteVisitorsLastMonth();
    if (visitors > 0) return visitors;
    const actives = await monthlyActiveCount();
    return Math.max(actives, FALLBACK_REACH);
  },
  ['monthly-reach'],
  { revalidate: 21600 },
);

export function thumb(url?: string | null): string | null {
  if (!url || typeof url !== 'string' || url.length < 10) return null;
  if (!/^https?:\/\//.test(url)) return null;
  if (imageUrlHasPlaceholderToken(url)) return null;
  return url;
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

export async function getServerPro(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(TRACE_SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? verifyTraceSession(sessionCookie) : null;
  const sessionProfile = session?.profile && isTraceSessionProfileFresh(session) ? session.profile : null;
  return hasActiveSubscription(sessionProfile);
}

export interface FeedViewData {
  stories: FeedStory[];
  pulse: { tools: PulseItem[]; discussions: PulseItem[]; blogs: PulseItem[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promoted: any[];
  monthlyReach: number;
  generated: string | null;
  serverPro: boolean;
  feedDate: string;
  priceDisplay: string;
  feedError: boolean;
}

/**
 * Map one daily doc's flat `trending` items (+ `trending_topics` grouping)
 * into FeedStory cards. Shared by today's feed and the older-stories API.
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

  const coveredUrls = new Set<string>();
  const topicStories: FeedStory[] = [];

  // One card per grouped topic. The flat trending array can hold several
  // articles from the same topic; cards must follow the grouping.
  (trendingTopics || []).forEach((topic, i) => {
    const articles = (topic?.articles || []).filter((a: { url?: string }) => a?.url);
    for (const a of articles) coveredUrls.add(a.url);
    if (!topic?.title && articles.length === 0) return;

    const first = articles[0] || {};
    const newest = articles.reduce(
      (best: { published_date?: string }, a: { published_date?: string }) =>
        (Date.parse(a?.published_date || '') > Date.parse(best?.published_date || '') ? a : best),
      first,
    );
    const sources: string[] = [];
    for (const a of articles) {
      const d = domainOf(a.url);
      if (d && !sources.includes(d)) sources.push(d);
    }
    let source = first.source_name || first.source || sources[0] || '';
    if (!source) source = domainOf(first.url || '');

    const coverage = articles.map((a: { title?: string; source_name?: string; source?: string; url: string; published_date?: string }) => ({
      title: a.title || '',
      source: a.source_name || a.source || domainOf(a.url),
      url: a.url,
      time: timeAgo(a.published_date),
    }));

    topicStories.push({
      id: topic.id || topic.topic_key || `topic-${i}`,
      rank: i + 1,
      title: topic.title || first.title || '',
      body: topic.summary || first.summary?.short_article?.body || first.description || '',
      takeaways: Array.isArray(topic.key_points) ? topic.key_points : [],
      img: thumb(topic.thumbnail) || thumb(first.thumbnail),
      source,
      sources,
      sourceNames: source ? [source] : [],
      coverage,
      time: timeAgo(newest?.published_date || first.published_date),
      ts: Date.parse(newest?.published_date || first.published_date || '') || 0,
      cat: topic.interest_id || first.interest_id || 'tech',
      url: first.url || '#',
    });
  });

  // Flat items not folded into a topic stay as their own cards.
  const standalone: FeedStory[] = [];
  const seen = new Set<string>();
  for (const it of trending || []) {
    const url = String(it?.url || '');
    if (!url || coveredUrls.has(url) || seen.has(url)) continue;
    seen.add(url);
    const sa = it.summary?.short_article || {};
    let source = it.source_name || it.source || '';
    const domain = domainOf(url);
    if (!source) source = domain;
    standalone.push({
      id: it.id || url,
      rank: 0,
      title: it.title || '',
      body: sa.body || it.description || '',
      takeaways: Array.isArray(sa.key_takeaways) ? sa.key_takeaways : [],
      img: thumb(it.thumbnail),
      source,
      sources: domain ? [domain] : [],
      sourceNames: source ? [source] : [],
      coverage: [{ title: it.title || '', source, url, time: timeAgo(it.published_date) }],
      time: timeAgo(it.published_date),
      ts: Date.parse(it?.published_date || '') || 0,
      cat: it.interest_id || 'tech',
      url,
    });
  }

  // Home default (Top mode): most-grouped first, recency breaks ties.
  // (Client re-sorts for Recent mode / other tabs; stories carry ts.)
  const combined = [...topicStories, ...standalone];
  combined.sort((a, b) => b.sources.length - a.sources.length || b.ts - a.ts);
  return combined.map((story, i) => ({ ...story, rank: i + 1 }));
}

export async function loadFeedViewData(): Promise<FeedViewData> {
  const [feedResult, promoted, monthlyReach, serverPro] = await Promise.all([
    getCachedFeed(),
    getPromotedTools(),
    getMonthlyReach(),
    getServerPro(),
  ]);
  const feedDate = feedResult?.date || '';
  const data = feedResult?.data || {};
  const pulse = data.daily_pulse_roles?.developer || { tools: [], discussions: [], blogs: [] };

  // Localized checkout price (IN gets ₹49) for the paywall CTAs.
  let priceDisplay = SUBSCRIPTION_PRICE_DEFAULT;
  try {
    priceDisplay = resolveSubscriptionOfferFromHeaders(await headers()).priceDisplay;
  } catch {
    /* keep the default display */
  }

  const stories = mapTrendingToStories(data.trending, data.trending_topics);

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
      img: thumb(t.thumbnail),
      read: t.reading_time_minutes || null,
    }));

  return {
    stories,
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
    serverPro,
    feedDate,
    priceDisplay,
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
  const direct = stories.find((s) => s.id === id);
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
