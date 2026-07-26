import { cache } from 'react';
import { FieldPath } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { getTodayIstDate, ISO_DATE_RE } from '@/lib/daily-date-utils';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';

export { addCalendarDaysIso, getTodayIstDate, getYesterdayIstDate } from '@/lib/daily-date-utils';

type GlobalDailyDoc = {
  date?: unknown;
  assembled_at?: unknown;
  trending_count?: unknown;
  trending_topics_count?: unknown;
  metadata?: {
    trending_count?: unknown;
    trending_topics_count?: unknown;
  };
  trending?: unknown;
  trending_topics?: unknown;
};

export type DailyArchiveEntry = {
  date: string;
  assembledAt?: string;
  trendingCount: number;
  topicCount: number;
  topHeadline?: string;
};

export type DailyArchiveFeed = {
  date: string;
  assembledAt?: string;
  trending: FeedItem[];
  trendingTopics: TrendingTopic[];
};

function toIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return null;
  return trimmed;
}

function asFeedItems(value: unknown): FeedItem[] {
  return Array.isArray(value) ? (value as FeedItem[]) : [];
}

function asTrendingTopics(value: unknown): TrendingTopic[] {
  return Array.isArray(value) ? (value as TrendingTopic[]) : [];
}

function asNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function getArchiveCounts(data: GlobalDailyDoc): { trendingCount: number; topicCount: number } | null {
  const trendingCount =
    asNonNegativeInteger(data.trending_count) ??
    asNonNegativeInteger(data.metadata?.trending_count);
  const topicCount =
    asNonNegativeInteger(data.trending_topics_count) ??
    asNonNegativeInteger(data.metadata?.trending_topics_count);

  if (trendingCount === null && topicCount === null) return null;
  return {
    trendingCount: trendingCount ?? 0,
    topicCount: topicCount ?? 0,
  };
}

function getDailyCollection() {
  return adminFirestore
    ?.collection('v3_user_feeds')
    .doc('_global')
    .collection('daily');
}

export async function getDailyArchiveEntries(
  limitCount = 365,
  includeHeadline = false,
): Promise<DailyArchiveEntry[]> {
  const collection = getDailyCollection();
  if (!collection) return [];

  const today = getTodayIstDate();
  const snapshot = await collection
    .orderBy('__name__', 'desc')
    .limit(limitCount)
    .select(
      'date',
      'assembled_at',
      'trending_count',
      'trending_topics_count',
      'metadata',
      ...(includeHeadline ? ['trending'] : []),
    )
    .get();

  const out: DailyArchiveEntry[] = [];
  for (const doc of snapshot.docs) {
    const data = (doc.data() || {}) as GlobalDailyDoc;
    const date = toIsoDate(data.date) || toIsoDate(doc.id);
    if (!date) continue;
    // Exclude today/future explicitly; archive is only past snapshots.
    if (date >= today) continue;

    const counts = getArchiveCounts(data);
    if (!counts || (counts.trendingCount === 0 && counts.topicCount === 0)) continue;

    out.push({
      date,
      assembledAt: typeof data.assembled_at === 'string' ? data.assembled_at : undefined,
      trendingCount: counts.trendingCount,
      topicCount: counts.topicCount,
      topHeadline: includeHeadline
        ? asFeedItems(data.trending)[0]?.title
        : undefined,
    });
  }

  return out;
}

/**
 * Neighbouring archive days in the already-fetched index order (newest first).
 * Used for prev/next internal links on individual day pages.
 */
export async function getAdjacentDailyArchiveNeighbours(
  isoDate: string,
): Promise<{ older: string | null; newer: string | null }> {
  const collection = getDailyCollection();
  const normalized = toIsoDate(isoDate);
  if (!collection || !normalized) return { older: null, newer: null };
  const today = getTodayIstDate();
  const fields = ['date', 'trending_count', 'trending_topics_count', 'metadata'];

  const findOlder = async (): Promise<string | null> => {
    let query = collection
      .where(FieldPath.documentId(), '<', normalized)
      .orderBy(FieldPath.documentId(), 'desc')
      .limit(20)
      .select(...fields);

    while (true) {
      const snapshot = await query.get();
      const match = snapshot.docs.find((doc) => {
        const date = toIsoDate(doc.id);
        const counts = getArchiveCounts(doc.data() as GlobalDailyDoc);
        return Boolean(date && date < today && counts && (counts.trendingCount > 0 || counts.topicCount > 0));
      });
      if (match) return toIsoDate(match.id);
      if (snapshot.size < 20) return null;
      query = query.startAfter(snapshot.docs[snapshot.docs.length - 1]);
    }
  };

  const findNewer = async (): Promise<string | null> => {
    let query = collection
      .where(FieldPath.documentId(), '>', normalized)
      .where(FieldPath.documentId(), '<', today)
      .orderBy(FieldPath.documentId(), 'asc')
      .limit(20)
      .select(...fields);

    while (true) {
      const snapshot = await query.get();
      const match = snapshot.docs.find((doc) => {
        const date = toIsoDate(doc.id);
        const counts = getArchiveCounts(doc.data() as GlobalDailyDoc);
        return Boolean(date && counts && (counts.trendingCount > 0 || counts.topicCount > 0));
      });
      if (match) return toIsoDate(match.id);
      if (snapshot.size < 20) return null;
      query = query.startAfter(snapshot.docs[snapshot.docs.length - 1]);
    }
  };

  const [older, newer] = await Promise.all([findOlder(), findNewer()]);
  return {
    older,
    newer,
  };
}

/**
 * Fetch today's (or the most recent) global feed snapshot.
 * Unlike getDailyArchiveFeed, this does NOT exclude today's date.
 * Returns the latest non-empty global daily feed.
 */
export async function getTodaysFeed(): Promise<DailyArchiveFeed | null> {
  if (!adminFirestore) return null;

  const snapshot = await adminFirestore
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily')
    .orderBy('__name__', 'desc')
    .limit(5)
    .get();

  for (const doc of snapshot.docs) {
    const data = (doc.data() || {}) as GlobalDailyDoc;
    const date = toIsoDate(data.date) || toIsoDate(doc.id);
    if (!date) continue;
    const trending = asFeedItems(data.trending);
    const trendingTopics = asTrendingTopics(data.trending_topics);
    if (trending.length === 0 && trendingTopics.length === 0) continue;
    return {
      date,
      assembledAt: typeof data.assembled_at === 'string' ? data.assembled_at : undefined,
      trending,
      trendingTopics,
    };
  }

  return null;
}

async function getDailyArchiveFeedUncached(date: string): Promise<DailyArchiveFeed | null> {
  if (!adminFirestore) return null;
  const normalized = toIsoDate(date);
  if (!normalized) return null;
  if (normalized >= getTodayIstDate()) return null;

  const doc = await adminFirestore
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily')
    .doc(normalized)
    .get();

  if (!doc.exists) return null;
  const data = (doc.data() || {}) as GlobalDailyDoc;
  const trending = asFeedItems(data.trending);
  const trendingTopics = asTrendingTopics(data.trending_topics);
  if (trending.length === 0 && trendingTopics.length === 0) return null;

  return {
    date: normalized,
    assembledAt: typeof data.assembled_at === 'string' ? data.assembled_at : undefined,
    trending,
    trendingTopics,
  };
}

/**
 * React cache deduplicates the metadata and page-body read within one render.
 * ISR still controls how long the completed archive response is retained.
 */
export const getDailyArchiveFeed = cache(getDailyArchiveFeedUncached);
