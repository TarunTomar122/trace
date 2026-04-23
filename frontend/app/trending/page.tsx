import type { Metadata } from 'next';
import Script from 'next/script';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import ScrollCTABanner from '@/components/ScrollCTABanner';
import { adminFirestore } from '@/lib/firebase-admin';
import { getDailyArchiveEntries } from '@/lib/daily-archive';
import TrendingContent from './TrendingContent';

// Dynamic — fetches fresh data on each request
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // cache for 1 hour

export const metadata: Metadata = {
  title: 'Trending Topics And Story Overviews | Trace',
  description:
    'Explore grouped trending topics with story overviews, timelines, and source coverage. Trace turns scattered updates into one clear page.',
  keywords: [
    'trending topics',
    'story overview',
    'news timeline',
    'grouped stories',
    'topic page',
    'source coverage',
    'story tracking',
    'Trace',
  ],
  alternates: {
    canonical: 'https://www.yourtrace.online/trending',
  },
  openGraph: {
    title: 'Trending Topics And Story Overviews | Trace',
    description:
      'Explore grouped trending topics with overviews, timelines, and source coverage.',
    url: 'https://www.yourtrace.online/trending',
    type: 'website',
    siteName: 'Trace',
    images: [{ url: 'https://www.yourtrace.online/opengraph-image', width: 1200, height: 630, alt: 'Trace — Trending Topics' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trending Topics And Story Overviews | Trace',
    description:
      'Grouped topics, story overviews, and timelines from across the web.',
    images: ['https://www.yourtrace.online/twitter-image'],
  },
};

const TRENDING_STORY_LIMIT = 3;

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

type TopicCard = TopicLink & {
  summary: string;
  sourceCount: number;
  articleCount: number;
  keyPoints: string[];
  thumbnail?: string;
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

async function getRecentGlobalFeedDocs(limitCount = 5) {
  if (!adminFirestore) return [];
  const globalFeedRef = adminFirestore
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily');

  const snapshot = await globalFeedRef
    .orderBy('__name__', 'desc')
    .limit(limitCount)
    .get();

  return snapshot.docs;
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

  // Prefer the latest non-empty global feed snapshot.
  const globalDocs = await getRecentGlobalFeedDocs();
  for (const doc of globalDocs) {
    const globalData = doc.data() || {};
    const trending = Array.isArray(globalData.trending) ? globalData.trending : [];
    if (trending.length > 0) {
      const items: TrendingItem[] = trending.map((item: GlobalTrendingItem, idx: number) => {
        const rawSlides = item.summary?.short_article?.slides;
        const slides = rawSlides?.length ? cleanSlides(rawSlides) : [];
        const body = item.summary?.short_article?.body || '';
        const subtitle = item.summary?.short_article?.subtitle || '';
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
      return items.slice(0, TRENDING_STORY_LIMIT);
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
    const items: TrendingItem[] = rows.slice(0, TRENDING_STORY_LIMIT).map((item: UnifiedNewsletterItem, idx: number) => ({
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

  const items: TrendingItem[] = deduped.slice(0, TRENDING_STORY_LIMIT).map((item, idx) => ({
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
    const globalDocs = await getRecentGlobalFeedDocs();
    for (const doc of globalDocs) {
      const data = doc.data() || {};
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
      if (topics.size >= 14) break;
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
    .slice(0, 14)
    .map(([slug, label]) => ({ slug, label }));
}

async function getTopicCards(limitCount = 6): Promise<TopicCard[]> {
  if (!adminFirestore) return [];

  const cards = new Map<string, TopicCard>();

  try {
    const globalDocs = await getRecentGlobalFeedDocs();
    for (const doc of globalDocs) {
      const data = doc.data() || {};
      const trendingTopics: Array<GlobalTopic & { summary?: string; thumbnail?: string }> = Array.isArray(data.trending_topics)
        ? data.trending_topics
        : [];

      for (const topic of trendingTopics) {
        const slug = normalizeTopicSlug(topic?.topic_key ?? topic?.id);
        if (!slug || cards.has(slug)) continue;
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
          continue;
        }
        cards.set(slug, {
          slug,
          label,
          summary: stripMarkdown((topic as { summary?: string }).summary || `Trace groups coverage around ${label} into one topic page so you can catch up faster.`),
          sourceCount: topic.source_count || 0,
          articleCount: topic.article_count || 0,
          keyPoints: Array.isArray(topic.key_points) ? topic.key_points.slice(0, 3) : [],
          thumbnail: (topic as { thumbnail?: string }).thumbnail,
        });
        if (cards.size >= limitCount) break;
      }
      if (cards.size >= limitCount) break;
    }
  } catch (error) {
    console.error('[trending] Failed to load global topic cards:', error);
  }

  if (cards.size >= limitCount) {
    return Array.from(cards.values()).slice(0, limitCount);
  }

  try {
    const latestDate = await getLatestTrendingDate();
    if (latestDate) {
      const topicDocs = await adminFirestore
        .collection('trending_news')
        .doc(latestDate)
        .collection('topics')
        .limit(limitCount * 2)
        .get();

      topicDocs.forEach((doc) => {
        if (cards.size >= limitCount) return;
        const data = (doc.data() || {}) as TrendingTopicDoc & {
          summary?: string;
          details?: string;
          display_name?: string;
          thumbnail?: string;
          source_count?: number;
          key_points?: string[];
        };
        const slug = normalizeTopicSlug(data.topic_key ?? data.topic_id ?? doc.id);
        if (!slug || cards.has(slug)) return;
        const rawLabel = data.display_name || data.name;
        const label = typeof rawLabel === 'string' && rawLabel.trim()
          ? rawLabel.trim()
          : formatTopicLabel(slug);
        if (!isEligibleTopicLink({
          slug,
          label,
          articleCount: data.article_count ?? data.articles?.length,
          sourceCount: data.source_count,
          keyPointCount: data.key_points?.length,
        })) {
          return;
        }
        cards.set(slug, {
          slug,
          label,
          summary: stripMarkdown(data.summary || data.details || `Trace groups coverage around ${label} into one topic page so you can catch up faster.`),
          sourceCount: data.source_count || 0,
          articleCount: data.article_count ?? data.articles?.length ?? 0,
          keyPoints: Array.isArray(data.key_points) ? data.key_points.slice(0, 3) : [],
          thumbnail: data.thumbnail,
        });
      });
    }
  } catch (error) {
    console.error('[trending] Failed to load fallback topic cards:', error);
  }

  return Array.from(cards.values()).slice(0, limitCount);
}

export default async function TrendingPage() {
  const [items, topicLinks, topicCards, recentDailyArchives] = await Promise.all([
    getTodaysItems(),
    getTopicLinks(),
    getTopicCards(),
    getDailyArchiveEntries(7),
  ]);
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Grouped Trending Topics',
    description:
      'Grouped trending topics with source counts, key points, and topic pages from Trace.',
    url: 'https://www.yourtrace.online/trending',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: topicCards.map((topic, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://www.yourtrace.online/topics/${topic.slug}`,
        name: topic.label,
      })),
    },
    about: topicLinks.slice(0, 10).map((topic) => ({
      '@type': 'Thing',
      name: topic.label,
      url: `https://www.yourtrace.online/topics/${topic.slug}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Script
        id="trending-collection-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <PublicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <TrendingContent
          items={items}
          topicCards={topicCards}
          recentDailyArchives={recentDailyArchives.map((e) => ({ date: e.date, topHeadline: e.topHeadline }))}
        />
      </main>
      <Footer />
      <ScrollCTABanner />
    </div>
  );
}
