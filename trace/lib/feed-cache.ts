/**
 * Simple in-memory cache for prefetched feed data.
 * Used to speed up initial feed load by fetching during splash.
 */

import type { V3UserFeed } from '@/lib/firestore';

let _prefetchedFeed: V3UserFeed | null = null;
let _prefetchPromise: Promise<V3UserFeed | null> | null = null;
let _prefetchedForUid: string | null = null;

export function setPrefetchedFeed(uid: string, feed: V3UserFeed | null): void {
  _prefetchedFeed = feed;
  _prefetchedForUid = uid;
}

export function getPrefetchedFeed(uid: string): V3UserFeed | null {
  if (_prefetchedForUid === uid && _prefetchedFeed) {
    return _prefetchedFeed;
  }
  return null;
}

export function consumePrefetchedFeed(uid: string): V3UserFeed | null {
  if (_prefetchedForUid === uid && _prefetchedFeed) {
    const feed = _prefetchedFeed;
    _prefetchedFeed = null;
    _prefetchedForUid = null;
    _prefetchPromise = null;
    return feed;
  }
  return null;
}

export function setPrefetchPromise(promise: Promise<V3UserFeed | null>): void {
  _prefetchPromise = promise;
}

export function getPrefetchPromise(): Promise<V3UserFeed | null> | null {
  return _prefetchPromise;
}

export function clearFeedCache(): void {
  _prefetchedFeed = null;
  _prefetchedForUid = null;
  _prefetchPromise = null;
}
