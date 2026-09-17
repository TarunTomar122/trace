import { Suspense } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import FeedApp from './FeedApp';
import FeedSkeleton from './FeedSkeleton';
import { loadFeedViewData } from '@/lib/feed-view';

export default async function FeedScreen() {
  const { stories, headlines, pulse, promoted, monthlyReach, generated, serverPro, feedDate, priceDisplay, feedError } = await loadFeedViewData();

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedApp
        stories={stories}
        headlines={headlines}
        pulse={pulse}
        promoted={promoted}
        monthlyReach={monthlyReach}
        serverPro={serverPro}
        generated={generated}
        feedDate={feedDate}
        priceDisplay={priceDisplay}
        feedError={feedError}
      />
    </Suspense>
  );
}
