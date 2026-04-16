import type { User } from 'firebase/auth';
import type { V3UserFeed } from '@/lib/firestore';

type FeedPrefetchEntry = {
  token: string;
  createdAt: number;
  promise: Promise<V3UserFeed | null>;
};

const FEED_PREFETCH_TTL_MS = 5 * 60 * 1000; // 5 minutes
const feedPrefetchByUid = new Map<string, FeedPrefetchEntry>();

function isExpired(entry: FeedPrefetchEntry): boolean {
  return Date.now() - entry.createdAt > FEED_PREFETCH_TTL_MS;
}

export function clearFeedPrefetch(uid?: string): void {
  if (uid) {
    feedPrefetchByUid.delete(uid);
    return;
  }
  feedPrefetchByUid.clear();
}

export function consumePrefetchedFeed(uid: string, token: string): Promise<V3UserFeed | null> | null {
  const entry = feedPrefetchByUid.get(uid);
  if (!entry) return null;
  if (isExpired(entry)) {
    feedPrefetchByUid.delete(uid);
    return null;
  }
  if (entry.token !== token) {
    // Auth/token epoch changed; discard speculative response.
    feedPrefetchByUid.delete(uid);
    return null;
  }
  feedPrefetchByUid.delete(uid);
  return entry.promise;
}

export async function prefetchFeedForUser(user: User): Promise<void> {
  const uid = user.uid;
  const token = await user.getIdToken();
  const existing = feedPrefetchByUid.get(uid);
  if (existing && !isExpired(existing) && existing.token === token) {
    return;
  }

  const promise: Promise<V3UserFeed | null> = fetch('/api/feed', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

  feedPrefetchByUid.set(uid, {
    token,
    createdAt: Date.now(),
    promise,
  });
}
