import { adminFirestore } from '@/lib/firebase-admin';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';

type GlobalDailyDoc = {
  date?: unknown;
  assembled_at?: unknown;
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getTodayIstDate(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

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

export async function getDailyArchiveEntries(limitCount = 365): Promise<DailyArchiveEntry[]> {
  if (!adminFirestore) return [];

  const today = getTodayIstDate();
  const snapshot = await adminFirestore
    .collection('v3_user_feeds')
    .doc('_global')
    .collection('daily')
    .orderBy('__name__', 'desc')
    .limit(limitCount)
    .get();

  const out: DailyArchiveEntry[] = [];
  for (const doc of snapshot.docs) {
    const data = (doc.data() || {}) as GlobalDailyDoc;
    const date = toIsoDate(data.date) || toIsoDate(doc.id);
    if (!date) continue;
    // Exclude today/future explicitly; archive is only past snapshots.
    if (date >= today) continue;

    const trending = asFeedItems(data.trending);
    const topics = asTrendingTopics(data.trending_topics);
    if (trending.length === 0 && topics.length === 0) continue;

    out.push({
      date,
      assembledAt: typeof data.assembled_at === 'string' ? data.assembled_at : undefined,
      trendingCount: trending.length,
      topicCount: topics.length,
      topHeadline: typeof trending[0]?.title === 'string' ? trending[0].title : undefined,
    });
  }

  return out;
}

export async function getDailyArchiveFeed(date: string): Promise<DailyArchiveFeed | null> {
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
