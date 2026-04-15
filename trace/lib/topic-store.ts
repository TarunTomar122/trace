import type { TrendingTopic } from '@/lib/firestore';

let _currentTopic: TrendingTopic | null = null;
let _isFreePreview = false;

export function setCurrentTopic(topic: TrendingTopic, freePreview = false) {
  _currentTopic = topic;
  _isFreePreview = freePreview;
}

export function getCurrentTopic(): TrendingTopic | null {
  return _currentTopic;
}

export function isFreePreview(): boolean {
  return _isFreePreview;
}
