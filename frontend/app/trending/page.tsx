import type { Metadata } from 'next';
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

function shortHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
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
      const items: TrendingItem[] = trending.map((item: any, idx: number) => {
        // For slides-based summaries, join slides into summary
        const slides = item.summary?.short_article?.slides;
        const body = item.summary?.short_article?.body;
        const subtitle = item.summary?.short_article?.subtitle;
        const summary = body || (slides?.length ? slides.join(' ') : subtitle) || '';

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
    const items: TrendingItem[] = rows.slice(0, 12).map((item: any, idx: number) => ({
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

export default async function TrendingPage() {
  const items = await getTodaysItems();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="py-6 border-b border-gray-100 dark:border-gray-800 mb-6">
          <h1 className="text-xl font-bold mb-0.5">Today's Top Reads</h1>
          <p className="text-sm text-secondary/50">
            The best content from hundreds of sources, curated daily
          </p>
        </div>

        <TrendingContent items={items} />
      </main>
      <Footer />
    </div>
  );
}
