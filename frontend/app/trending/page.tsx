import type { Metadata } from 'next';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import { adminFirestore } from '@/lib/firebase-admin';
import TrendingContent from './TrendingContent';

// Dynamic — fetches fresh data on each request
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // cache for 1 hour

export const metadata: Metadata = {
  title: "Today's Top Reads — Trace",
  description:
    "The most interesting articles from hundreds of sources, curated and summarized daily. Free to read.",
  keywords: [
    'daily reads',
    'curated articles',
    'content curation',
    'trending articles',
    'tech news',
    'RSS alternative',
    'Trace',
  ],
  alternates: {
    canonical: 'https://www.yourtrace.online/trending',
  },
  openGraph: {
    title: "Today's Top Reads — Trace",
    description:
      "The most interesting articles from hundreds of sources, curated daily. Free to read.",
    url: 'https://www.yourtrace.online/trending',
    type: 'website',
    siteName: 'Trace',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Today's Top Reads — Trace",
    description:
      "The most interesting articles from hundreds of sources, curated daily.",
  },
};

type TrendingItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  thumbnail?: string;
};

type TopicLink = {
  slug: string;
  label: string;
};

type GlobalTrendingItem = {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  source?: string;
  source_name?: string;
  summary?: {
    short_article?: {
      slides?: string[];
      body?: string;
      subtitle?: string;
    };
  };
};

type UnifiedNewsletterItem = {
  id?: string;
  title?: string;
  url?: string;
  summary?: string;
  source?: string;
  thumbnail?: string;
};

type GlobalTopic = {
  id?: string;
  topic_key?: string;
  title?: string;
  article_count?: number;
  source_count?: number;
  timeline?: Array<unknown>;
  key_points?: string[];
};

type TrendingTopicDoc = {
  topic_key?: string;
  topic_id?: string;
  display_name?: string;
  name?: string;
  article_count?: number;
  articles?: Array<unknown>;
};

function getTodayIstDate(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

async function getLatestUnifiedDate(): Promise<string | null> {
  if (!adminFirestore) return null;
  const snapshot = await adminFirestore
    .collection('unified_newsletters')
    .orderBy('date', 'desc')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id || snapshot.docs[0].data().date || null;
}

async function getLatestTrendingDate(): Promise<string | null> {
  if (!adminFirestore) return null;
  const snapshot = await adminFirestore
    .collection('trending_news')
    .orderBy('date', 'desc')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id || snapshot.docs[0].data().date || null;
}

function normalizeTopicSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return null;
  return cleaned.replace(/\s+/g, '-');
}

function formatTopicLabel(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function looksLikeRawSource(value: string): boolean {
  return /(^|[-_/])(rss|feed)([-_/]|$)|\.com|\.ai|blog-rss/i.test(value);
}

function isEligibleTopicLink(input: {
  slug: string;
  label: string;
  articleCount?: number;
  sourceCount?: number;
  timelineCount?: number;
  keyPointCount?: number;
}): boolean {
  const hasContent =
    (input.articleCount ?? 0) > 0 ||
    (input.sourceCount ?? 0) > 0 ||
    (input.timelineCount ?? 0) > 0 ||
    (input.keyPointCount ?? 0) > 0;

  if (!hasContent) return false;
  if (looksLikeRawSource(input.slug) || looksLikeRawSource(input.label)) return false;
  return true;
}

function shortHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

// Strip "Slide N:" prefix from slides
function cleanSlides(slides: string[]): string[] {
  return slides.map(s => s.replace(/^Slide\s*\d+:\s*/i, ''));
}

// Strip markdown formatting for plain text display
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

async function getTodaysItems(): Promise<TrendingItem[]> {
  if (!adminFirestore) {
    return [];
  }

  const today = getTodayIstDate();

  // Try the new global feed first (v3_user_feeds/_global/daily/{date})
  const globalFeedRef = adminFirestore
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily');

  const globalSnapshot = await globalFeedRef
    .orderBy('__name__', 'desc')
    .limit(1)
    .get();

  if (!globalSnapshot.empty) {
    const globalData = globalSnapshot.docs[0].data() || {};
    const trending = Array.isArray(globalData.trending) ? globalData.trending : [];
    if (trending.length > 0) {
      const items: TrendingItem[] = trending.map((item: GlobalTrendingItem, idx: number) => {
        // For slides-based summaries, prefer slides over short body
        const rawSlides = item.summary?.short_article?.slides;
        const slides = rawSlides?.length ? cleanSlides(rawSlides) : [];
        const body = item.summary?.short_article?.body || '';
        const subtitle = item.summary?.short_article?.subtitle || '';
        // Use slides if available and body is short (likely just subtitle), strip markdown
        const rawSummary = (slides.length ? slides.join(' ') : '') || (body.length > 100 ? body : subtitle) || '';
        const summary = stripMarkdown(rawSummary);

        return {
          id: item.id || `trending-${idx}-${shortHash(item.url || String(idx))}`,
          title: item.title || '',
          url: item.url || '',
          summary,
          source: item.source_name || item.source || '',
          thumbnail: item.thumbnail || undefined,
        };
      });
      return items;
    }
  }

  // Fallback to legacy unified_newsletters
  const latestUnifiedDate = await getLatestUnifiedDate();
  const latestDate = await getLatestTrendingDate();
  const dateToUse = latestUnifiedDate || latestDate || today;

  const unifiedDoc = await adminFirestore
    .collection('unified_newsletters')
    .doc(dateToUse)
    .get();

  if (unifiedDoc.exists) {
    const data = unifiedDoc.data() || {};
    const rows = Array.isArray(data.items) ? data.items : [];
    const items: TrendingItem[] = rows.slice(0, 12).map((item: UnifiedNewsletterItem, idx: number) => ({
      id: item.id || `trending-${idx}-${shortHash(item.url || String(idx))}`,
      title: item.title || '',
      url: item.url || '',
      summary: item.summary || '',
      source: item.source || '',
      thumbnail: item.thumbnail || undefined,
    }));
    if (items.length > 0) {
      return items;
    }
  }

  // Fallback to trending_news collection
  const topicsSnapshot = await adminFirestore
    .collection('trending_news')
    .doc(dateToUse)
    .collection('topics')
    .get();

  if (topicsSnapshot.empty) {
    return [];
  }

  type RawArticle = {
    title?: string;
    subtitle?: string;
    details?: string;
    url?: string;
    source_domain?: string;
    thumbnail?: string;
    published_date?: string;
  };

  const allArticles: RawArticle[] = [];
  topicsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const articles = (data?.articles || []) as RawArticle[];
    allArticles.push(...articles);
  });

  const seen = new Set<string>();
  const deduped = allArticles.filter((a) => {
    const url = (a.url || '').trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  deduped.sort((a, b) =>
    String(b.published_date || '').localeCompare(String(a.published_date || ''))
  );

  const items: TrendingItem[] = deduped.slice(0, 12).map((item, idx) => ({
    id: item.url ? `trending-${idx}-${shortHash(item.url)}` : `trending-${idx}`,
    title: item.title || '',
    url: item.url || '',
    summary: item.subtitle || item.details || '',
    source: item.source_domain || '',
    thumbnail: item.thumbnail || undefined,
  }));

  return items;
}

async function getTopicLinks(): Promise<TopicLink[]> {
  if (!adminFirestore) return [];

  const topics = new Map<string, string>();

  try {
    const globalSnapshot = await adminFirestore
      .collection('v3_user_feeds')
      .doc('_global')
      .collection('daily')
      .orderBy('__name__', 'desc')
      .limit(1)
      .get();

    if (!globalSnapshot.empty) {
      const data = globalSnapshot.docs[0].data() || {};
      const trendingTopics: GlobalTopic[] = Array.isArray(data.trending_topics) ? data.trending_topics : [];
      trendingTopics.forEach((topic) => {
        const slug = normalizeTopicSlug(topic?.topic_key ?? topic?.id);
        if (!slug || topics.has(slug)) return;
        const label = typeof topic?.title === 'string' && topic.title.trim()
          ? topic.title.trim()
          : formatTopicLabel(slug);
        if (!isEligibleTopicLink({
          slug,
          label,
          articleCount: topic.article_count,
          sourceCount: topic.source_count,
          timelineCount: topic.timeline?.length,
          keyPointCount: topic.key_points?.length,
        })) {
          return;
        }
        topics.set(slug, label);
      });
    }
  } catch (error) {
    console.error('[trending] Failed to load global topic links:', error);
  }

  try {
    const latestDate = await getLatestTrendingDate();
    if (latestDate) {
      const topicDocs = await adminFirestore
        .collection('trending_news')
        .doc(latestDate)
        .collection('topics')
        .limit(12)
        .get();

      topicDocs.forEach((doc) => {
        const data = (doc.data() || {}) as TrendingTopicDoc;
        const slug = normalizeTopicSlug(data.topic_key ?? data.topic_id ?? doc.id);
        if (!slug || topics.has(slug)) return;
        const rawLabel = data.display_name || data.name;
        const label = typeof rawLabel === 'string' && rawLabel.trim()
          ? rawLabel.trim()
          : formatTopicLabel(slug);
        if (!isEligibleTopicLink({
          slug,
          label,
          articleCount: data.article_count ?? data.articles?.length,
        })) {
          return;
        }
        topics.set(slug, label);
      });
    }
  } catch (error) {
    console.error('[trending] Failed to load trending topic links:', error);
  }

  return Array.from(topics.entries())
    .slice(0, 8)
    .map(([slug, label]) => ({ slug, label }));
}

export default async function TrendingPage() {
  const [items, topicLinks] = await Promise.all([getTodaysItems(), getTopicLinks()]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main className="mx-auto px-6 lg:px-10 max-w-[1600px]">
        {/* Header */}
        <div className="py-6 border-b border-gray-100 dark:border-gray-800 mb-6">
          <h1 className="text-xl font-bold mb-0.5">Today&apos;s Top Reads</h1>
          <p className="text-sm text-secondary/50">
            The best content from hundreds of sources, curated daily
          </p>
          {topicLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {topicLinks.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/topics/${topic.slug}`}
                  className="inline-flex items-center rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-secondary hover:border-border hover:text-foreground transition-colors"
                >
                  {topic.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <TrendingContent items={items} />
      </main>
      <Footer />
    </div>
  );
}
