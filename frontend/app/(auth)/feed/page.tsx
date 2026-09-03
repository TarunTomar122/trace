import FeedScreen from '@/components/feed-v2/FeedScreen';

export const dynamic = 'force-dynamic';

// The redesigned feed. Access is resolved server-side from the Trace
// session cookie inside FeedScreen (same session the runtime feed uses).
export default function FeedPage() {
  return <FeedScreen />;
}
