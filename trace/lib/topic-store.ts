import type { TrendingTopic } from '@/lib/firestore';

let _currentTopic: TrendingTopic | null = null;

export function setCurrentTopic(topic: TrendingTopic) {
  _currentTopic = topic;
}

export function getCurrentTopic(): TrendingTopic | null {
  return _currentTopic;
}
