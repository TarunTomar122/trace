import { Suspense } from 'react';
import FeedApp from './FeedApp';
import FeedSkeleton from './FeedSkeleton';
import { keepLastGoodPage, loadFeedViewData } from '@/lib/feed-view';

export default async function FeedScreen() {
  const data = await loadFeedViewData();
  keepLastGoodPage(data);
  const { stories, headlines, pulse, promoted, monthlyReach, feedDate, feedError } = data;

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedApp
        stories={stories}
        headlines={headlines}
        pulse={pulse}
        promoted={promoted}
        monthlyReach={monthlyReach}
        feedDate={feedDate}
        feedError={feedError}
      />
    </Suspense>
  );
}
