import { Suspense } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import FeedApp from './FeedApp';
import FeedSkeleton from './FeedSkeleton';
import { loadFeedViewData } from '@/lib/feed-view';

export default async function FeedScreen() {
  const { stories, pulse, promoted, monthlyReach, generated, serverPro, feedDate } = await loadFeedViewData();

  return (
    <AuthProvider>
      <Suspense fallback={<FeedSkeleton />}>
        <FeedApp
          stories={stories}
          pulse={pulse}
          promoted={promoted}
          monthlyReach={monthlyReach}
          serverPro={serverPro}
          generated={generated}
          feedDate={feedDate}
        />
      </Suspense>
    </AuthProvider>
  );
}
