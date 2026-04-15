import { auth } from '@/lib/firebase';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';

export type FeedItemDetailResponse =
  | { kind: 'article'; item: FeedItem }
  | { kind: 'topic'; item: TrendingTopic };

export function feedItemDetailSwrKey(id: string): string {
  return `feed-item-detail-${id}`;
}

export async function fetchFeedItemDetail(id: string): Promise<FeedItemDetailResponse | null> {
  const path = `/api/feed/item?id=${encodeURIComponent(id)}`;
  const res = await fetch(path, { credentials: 'same-origin' });
  if (res.status === 401 && auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    const fallbackRes = await fetch(path, {
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fallbackRes.ok) return null;
    return fallbackRes.json();
  }
  if (!res.ok) return null;
  return res.json();
}
