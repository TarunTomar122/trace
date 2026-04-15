import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

export const revalidate = 3600; // Cache for 1 hour

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

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function sanitizeSource(source: string | undefined, url: string): string {
  // If source looks like an internal field name, extract from URL instead
  if (!source || source.includes('_') || source.startsWith('v3') || source.length < 3) {
    return getHostname(url);
  }
  return source;
}

/**
 * Public endpoint to fetch today's trending articles.
 * No authentication required.
 */
export async function GET() {
  try {
    if (!adminFirestore) {
      return NextResponse.json(
        { items: [], error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const today = getTodayIstDate();
    const latestUnifiedDate = await getLatestUnifiedDate();
    const latestDate = await getLatestTrendingDate();
    const dateToUse = latestUnifiedDate || latestDate || today;

    // Try unified_newsletters first
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
        source: sanitizeSource(item.source, item.url || ''),
        thumbnail: item.thumbnail || undefined,
      }));

      if (items.length > 0) {
        return NextResponse.json(
          { items },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          }
        );
      }
    }

    // Fallback to trending_news topics
    const topicsSnapshot = await adminFirestore
      .collection('trending_news')
      .doc(dateToUse)
      .collection('topics')
      .get();

    if (topicsSnapshot.empty) {
      return NextResponse.json({ items: [] });
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
      source: sanitizeSource(item.source_domain, item.url || ''),
      thumbnail: item.thumbnail || undefined,
    }));

    return NextResponse.json(
      { items },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error: unknown) {
    console.error('Error fetching trending:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { items: [], error: message },
      { status: 500 }
    );
  }
}
