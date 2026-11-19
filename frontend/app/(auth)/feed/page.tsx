import FeedScreen from '@/components/feed-v2/FeedScreen';

// One cached page for every reader, rebuilt at most every 10 minutes. Lanes,
// open stories and sign-in state are all resolved in the browser (FeedApp
// reads ?tab= / ?story= itself), so nothing here may read the request.
export const revalidate = 600;

// The redesigned feed.
export default function FeedPage() {
  return <FeedScreen />;
}
