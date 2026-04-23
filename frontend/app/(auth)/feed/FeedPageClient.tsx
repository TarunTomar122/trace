"use client";

import type { V3UserFeed } from '@/lib/firestore';
import FeedPageRuntime from './FeedPageRuntime';

export default function FeedPageClient({ initialFeed }: { initialFeed: V3UserFeed | null }) {
  return <FeedPageRuntime initialFeed={initialFeed} />;
}
