import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { AuthProvider } from '@/contexts/AuthContext';
import { TRACE_SESSION_COOKIE_NAME, verifyTraceSession, isTraceSessionProfileFresh } from '@/lib/server-session';
import { hasActiveSubscription } from '@/lib/subscription-access';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import FeedApp from './FeedApp';
import FeedSkeleton from './FeedSkeleton';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

let feedCache: { at: number; v: { date: string; data: Doc } | null } | null = null;

async function loadFeed(): Promise<{ date: string; data: Doc } | null> {
  if (feedCache && Date.now() - feedCache.at < 5 * 60_000) return feedCache.v;
  const { adminFirestore } = await import('@/lib/firebase-admin');
  if (!adminFirestore) return null;
  const ref = adminFirestore.collection('v3_user_feeds').doc('_global').collection('daily');
  const snap = await ref.orderBy('__name__', 'desc').limit(2).get();
  let v: { date: string; data: Doc } | null = null;
  for (const doc of snap.docs) {
    const data = doc.data();
    if ((data.trending || []).length > 0) { v = { date: doc.id, data }; break; }
  }
  feedCache = { at: Date.now(), v };
  return v;
}

function thumb(url?: string | null): string | null {
  if (!url || typeof url !== 'string' || url.length < 10) return null;
  if (url.includes('placeholder') || url.includes('default')) return null;
  if (!/^https?:\/\//.test(url)) return null;
  return url;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function FeedScreen() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(TRACE_SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? verifyTraceSession(sessionCookie) : null;
  const sessionProfile = session?.profile && isTraceSessionProfileFresh(session) ? session.profile : null;
  const serverPro = hasActiveSubscription(sessionProfile);

  const feed = await loadFeed();
  const data = feed?.data || {};
  const pulse = data.daily_pulse_roles?.developer || { tools: [], discussions: [], blogs: [] };

  // Grouping lives in trending_topics (each topic bundles its articles).
  // Match flat trending items to their topic so cards show every outlet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const urlToTopic = new Map<string, any>();
  for (const topic of (data.trending_topics || [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of (topic.articles || [])) {
      if (a?.url && !urlToTopic.has(a.url)) urlToTopic.set(a.url, topic);
    }
  }

  // sibling outlet domains covering the same story (real grouping from the pipeline)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function groupSources(it: any): string[] {
    let domain = '';
    try { domain = new URL(it.url).hostname.replace(/^www\./, ''); } catch {}
    const out: string[] = domain ? [domain] : [];
    const topic = urlToTopic.get(it.url);
    if (!topic) return out;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of (topic.articles || [])) {
      try {
        const h = new URL(a.url).hostname.replace(/^www\./, '');
        if (h && h !== domain && !out.includes(h)) out.push(h);
      } catch { /* skip bad urls */ }
    }
    return out.slice(0, 4);
  }

  // Home order: multi-source (grouped) stories first, shuffled within each
  // tier on every load so the feed feels fresh. Trend score breaks no ties
  // on purpose: shuffle is the point.
  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const news: any[] = (() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = [...(data.trending || [])];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grouped = all.filter((it: any) => groupSources(it).length > 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const singles = all.filter((it: any) => groupSources(it).length <= 1);
    return [...shuffle(grouped), ...shuffle(singles)];
  })();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stories = news.map((it: any, i: number) => {
    const sa = it.summary?.short_article || {};
    let source = it.source_name || it.source || '';
    let domain = '';
    try { domain = new URL(it.url).hostname.replace(/^www\./, ''); } catch {}
    if (!source) source = domain;
    const sources = groupSources(it);
    // every grouped headline, clickable (timeline in the detail view)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topic = urlToTopic.get(it.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let coverage = topic ? (topic.articles || []).filter((a: any) => a?.url).map((a: any) => {
      let src = a.source_name || a.source || '';
      let dom = '';
      try { dom = new URL(a.url).hostname.replace(/^www\./, ''); } catch {}
      return { title: a.title || '', source: src || dom, url: a.url, time: timeAgo(a.published_date) };
    }) : [];
    if (coverage.length === 0 && it.url) {
      coverage = [{ title: it.title || '', source, url: it.url, time: timeAgo(it.published_date) }];
    }
    return {
      id: it.id || it.url || String(i),
      rank: i + 1,
      title: it.title || '',
      body: sa.body || it.description || '',
      takeaways: Array.isArray(sa.key_takeaways) ? sa.key_takeaways : [],
      img: thumb(it.thumbnail),
      source,
      sources,
      sourceNames: source ? [source] : [],
      coverage,
      time: timeAgo(it.published_date),
      cat: it.interest_id || 'tech',
      url: it.url || '#',
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toPulse = (arr: any[]): any[] =>
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

  const pulsePayload = {
    tools: toPulse(pulse.tools),
    discussions: toPulse(pulse.discussions),
    blogs: toPulse(pulse.blogs),
  };

  return (
    <AuthProvider>
      <Suspense fallback={<FeedSkeleton />}>
        <FeedApp
          stories={stories}
          pulse={pulsePayload}
          serverPro={serverPro}
          generated={data.daily_pulse_role_generated_at?.developer ? timeAgo(data.daily_pulse_role_generated_at.developer) : null}
        />
      </Suspense>
    </AuthProvider>
  );
}
