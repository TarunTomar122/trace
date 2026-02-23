import type { FeedItem } from '@/lib/firestore';

let _current: FeedItem | null = null;

export function setCurrentArticle(item: FeedItem) {
  _current = item;
}

export function getCurrentArticle(): FeedItem | null {
  return _current;
}
