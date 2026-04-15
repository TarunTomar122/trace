import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

type RawTrendingArticle = {
  title?: string;
  subtitle?: string;
  details?: string;
  url?: string;
  source_domain?: string;
  thumbnail?: string;
  published_date?: string;
};

function getTodayIstDate(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function shortHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

export async function GET(request: NextRequest) {
  try {
    if (!adminAuth || !adminFirestore) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(token);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '6', 10), 20);

    const today = getTodayIstDate();
    const latestUnifiedSnapshot = await adminFirestore
      .collection('unified_newsletters')
      .orderBy('date', 'desc')
      .limit(1)
      .get();
    const latestUnifiedDate = latestUnifiedSnapshot.empty
      ? null
      : (
          latestUnifiedSnapshot.docs[0].id
          || latestUnifiedSnapshot.docs[0].data().date
          || null
        );

    const latestDateSnapshot = await adminFirestore
      .collection('trending_news')
      .orderBy('date', 'desc')
      .limit(1)
      .get();

    const latestDate = latestDateSnapshot.empty
      ? null
      : (latestDateSnapshot.docs[0].id || latestDateSnapshot.docs[0].data().date || null);
    const dateToUse = latestUnifiedDate || latestDate || today;

    const unifiedDoc = await adminFirestore
      .collection('unified_newsletters')
      .doc(dateToUse)
      .get();
    if (unifiedDoc.exists) {
      const unified = unifiedDoc.data() || {};
      const unifiedItems = Array.isArray(unified.items) ? unified.items : [];
      const mapped = unifiedItems.slice(0, limit).map((item: any, idx: number) => {
        const summaryText = String(item.summary || '').trim();
        return {
          id: item.id || `trending-${idx}-${shortHash(String(item.url || idx))}`,
          type: item.type || 'news',
          title: String(item.title || ''),
          description: summaryText,
          url: String(item.url || ''),
          thumbnail: item.thumbnail || null,
          tags: Array.isArray(item.tags) ? item.tags : [],
          summary: summaryText
            ? {
                short_article: {
                  subtitle: summaryText,
                  body: summaryText,
                  outline: [],
                },
                reading_time_minutes: 2,
              }
            : undefined,
          metadata: {
            why_relevant: 'Trending now',
            feed_category: 'trending_news',
            is_hot: true,
          },
        };
      }).filter((item: any) => item.url && item.title);

      if (mapped.length > 0) {
        return NextResponse.json({
          items: mapped,
          feedDate: dateToUse,
          metadata: { is_preview: true, source: 'unified_newsletters' },
        });
      }
    }

    const topicsSnapshot = await adminFirestore
      .collection('trending_news')
      .doc(dateToUse)
      .collection('topics')
      .get();

    if (topicsSnapshot.empty) {
      return NextResponse.json({
        items: [],
        feedDate: dateToUse,
        metadata: { is_preview: true, source: 'trending_news' },
      });
    }

    const allArticles: RawTrendingArticle[] = [];
    topicsSnapshot.docs.forEach((doc) => {
      const topicData = doc.data();
      const topicName = String(topicData?.name || doc.id);
      const topicId = doc.id;
      const articles = (topicData?.articles || []) as RawTrendingArticle[];
      for (const article of articles) {
        allArticles.push({
          ...article,
          // Keep topic context for feed badges
          subtitle: article.subtitle || '',
          details: article.details || '',
          source_domain: article.source_domain || '',
          // attach ad-hoc fields for mapping
          ...(article as any),
          topic_id: topicId,
          topic_name: topicName,
        } as RawTrendingArticle & { topic_id: string; topic_name: string });
      }
    });

    // Dedupe by URL and keep newest by published_date.
    const byUrl = new Map<string, RawTrendingArticle & { topic_id: string; topic_name: string }>();
    for (const item of allArticles as Array<RawTrendingArticle & { topic_id: string; topic_name: string }>) {
      const url = String(item.url || '').trim();
      if (!url) continue;
      const existing = byUrl.get(url);
      if (!existing) {
        byUrl.set(url, item);
        continue;
      }
      if (String(item.published_date || '') > String(existing.published_date || '')) {
        byUrl.set(url, item);
      }
    }

    const deduped = Array.from(byUrl.values()).sort((a, b) =>
      String(b.published_date || '').localeCompare(String(a.published_date || ''))
    );

    const items = deduped.slice(0, limit).map((item, idx) => {
      const subtitle = String(item.subtitle || '').trim();
      const details = String(item.details || '').trim();
      const url = String(item.url || '').trim();
      const topicName = (item as any).topic_name || 'Trending';

      return {
        id: `trending-${idx}-${shortHash(url)}`,
        type: 'news',
        title: String(item.title || ''),
        description: details || subtitle,
        url,
        thumbnail: item.thumbnail || null,
        tags: [(item as any).topic_id].filter(Boolean),
        summary: (subtitle || details)
          ? {
              short_article: {
                subtitle,
                body: details || subtitle,
                outline: [],
              },
              reading_time_minutes: 2,
            }
          : undefined,
        metadata: {
          why_relevant: `Trending in ${topicName}`,
          feed_category: 'trending_news',
          is_hot: false,
        },
      };
    });

    return NextResponse.json({
      items,
      feedDate: dateToUse,
      metadata: { is_preview: true, source: 'trending_news' },
    });
  } catch (error: unknown) {
    console.error('Error fetching trending feed:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

