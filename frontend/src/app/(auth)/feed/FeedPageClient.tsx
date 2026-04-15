"use client";

import dynamic from 'next/dynamic';
import type { V3UserFeed } from '@/lib/firestore';
import FeedBootShell from './FeedBootShell';

const FeedPageRuntime = dynamic(() => import('./FeedPageRuntime'), {
  loading: () => <FeedBootShell />,
});

export default function FeedPageClient({ initialFeed }: { initialFeed: V3UserFeed | null }) {
  return <FeedPageRuntime initialFeed={initialFeed} />;
}
