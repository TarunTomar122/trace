import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { applyFeedFreshnessAndDedupe } from '@/lib/feed-dedupe';
import { getBootstrapFeedForUid } from '@/lib/feed-server';
import { filterSendWorthyTopics, rejectedStoryUrls } from '@/lib/feed-value';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';

function isFeedItem(value: unknown): value is FeedItem {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.url === 'string'
  );
}

function isTrendingTopic(value: unknown): value is TrendingTopic {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.topic_key === 'string'
  );
}

// Mobile-only feed endpoint. Intentionally separate from /api/feed so web
// refactors never accidentally break the mobile contract.
// Auth: Firebase ID token via Authorization: Bearer <token> only (no cookies).
// Response: subset of V3UserFeed — only the fields the mobile app renders.

export async function GET(request: NextRequest) {
  if (!adminAuth || !adminFirestore) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = request.nextUrl.searchParams.get('role') ?? '';
  const daysParam = Number(request.nextUrl.searchParams.get('days') || '1');
  const lookbackDays = Number.isFinite(daysParam) ? Math.max(1, Math.min(2, daysParam)) : 1;

  try {
    const feed = await getBootstrapFeedForUid(uid, role);
    if (!feed) return NextResponse.json(null);

    let mergedTrending = feed.trending ?? [];
    let mergedTrendingTopics = filterSendWorthyTopics(feed.trending_topics ?? []);

    if (lookbackDays > 1) {
      const globalSnapshot = await adminFirestore
        .collection('v3_user_feeds')
        .doc('_global')
        .collection('daily')
        .orderBy('__name__', 'desc')
        .limit(lookbackDays)
        .get();

      const allTrending: FeedItem[] = [];
      const allTopics: TrendingTopic[] = [];
      for (const docSnap of globalSnapshot.docs) {
        const data = docSnap.data() as Record<string, unknown>;
        const rejected = rejectedStoryUrls(
          Array.isArray(data.trending_topics) ? data.trending_topics : [],
        );
        if (Array.isArray(data.trending)) {
          allTrending.push(
            ...data.trending
              .filter(isFeedItem)
              .filter((item) => !rejected.has(String(item?.url || '').trim())),
          );
        }
        if (Array.isArray(data.trending_topics)) {
          allTopics.push(...filterSendWorthyTopics(data.trending_topics).filter(isTrendingTopic));
        }
      }

      const seenArticle = new Set<string>();
      mergedTrending = allTrending.filter((item) => {
        const key = String(item?.url || item?.id || '').trim();
        if (!key || seenArticle.has(key)) return false;
        seenArticle.add(key);
        return true;
      });

      const seenTopic = new Set<string>();
      mergedTrendingTopics = allTopics.filter((topic) => {
        const key = String(topic?.id || topic?.topic_key || '').trim();
        if (!key || seenTopic.has(key)) return false;
        seenTopic.add(key);
        return true;
      });
    }

    const fresh = applyFeedFreshnessAndDedupe({
      trending: mergedTrending,
      trending_topics: mergedTrendingTopics,
    });

    return NextResponse.json(
      {
        date: feed.date,
        assembled_at: feed.assembled_at ?? null,
        trending: fresh.trending,
        trending_topics: fresh.trending_topics,
        daily_pulse: feed.daily_pulse ?? null,
        community_pulse: feed.community_pulse ?? [],
        build_pulse: feed.build_pulse ?? [],
        metadata: feed.metadata ?? null,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('[api/mobile/feed]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
