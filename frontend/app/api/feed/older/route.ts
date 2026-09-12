import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { mapTrendingToStories } from '@/lib/feed-view';
import { getTodayIstDate, ISO_DATE_RE } from '@/lib/daily-date-utils';
import type { FeedStory } from '@/components/feed-v2/FeedApp';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 48;
// Walk at most this many daily docs per request so a long stretch of thin
// days still returns quickly; the client just clicks again to keep going.
const MAX_DAYS_SCANNED = 8;
const DOCS_PER_QUERY = 5;

interface OlderStoriesPage {
  stories: FeedStory[];
  nextBefore: string | null;
}

function storyKey(story: FeedStory): string {
  const raw = story.url && story.url !== '#' ? story.url : story.id;
  return raw.replace(/[#?].*$/, '').replace(/\/$/, '');
}

// Global daily docs are immutable once the day passes, so the page for a
// given cursor can be cached hard.
const getOlderStories = unstable_cache(
  async (before: string, limit: number): Promise<OlderStoriesPage> => {
    const { adminFirestore } = await import('@/lib/firebase-admin');
    if (!adminFirestore) return { stories: [], nextBefore: null };

    const collection = adminFirestore
      .collection('v3_user_feeds')
      .doc('_global')
      .collection('daily');

    const collected: FeedStory[] = [];
    const seen = new Set<string>();
    let cursor = before;
    let scanned = 0;
    let exhausted = false;

    while (collected.length < limit && scanned < MAX_DAYS_SCANNED) {
      const snapshot = await collection
        .where(FieldPath.documentId(), '<', cursor)
        .orderBy(FieldPath.documentId(), 'desc')
        .limit(DOCS_PER_QUERY)
        .get();
      if (snapshot.empty) {
        exhausted = true;
        break;
      }
      for (const doc of snapshot.docs) {
        cursor = doc.id;
        scanned += 1;
        const data = doc.data() || {};
        const dayStories = mapTrendingToStories(data.trending, data.trending_topics);
        for (const story of dayStories) {
          const key = storyKey(story);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          collected.push(story);
        }
        // Whole days only: mid-day cursors would need per-doc offsets and
        // could skip stories if a doc grows later.
        if (collected.length >= limit || scanned >= MAX_DAYS_SCANNED) break;
      }
    }

    return { stories: collected, nextBefore: exhausted ? null : cursor };
  },
  ['feed-older'],
  { revalidate: 3600 },
);

export async function GET(request: NextRequest) {
  const beforeParam = request.nextUrl.searchParams.get('before') || '';
  const limitParam = Number(request.nextUrl.searchParams.get('limit') || '');
  const limit = Number.isFinite(limitParam)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.round(limitParam)))
    : DEFAULT_LIMIT;

  const today = getTodayIstDate();
  let before = today;
  if (beforeParam) {
    if (!ISO_DATE_RE.test(beforeParam)) {
      return NextResponse.json({ error: 'Invalid before date' }, { status: 400 });
    }
    before = beforeParam > today ? today : beforeParam;
  }

  try {
    const page = await getOlderStories(before, limit);
    return NextResponse.json(page, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('[api/feed/older]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
