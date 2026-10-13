import type { Metadata } from 'next';
import { Suspense } from 'react';
import FeedApp from '@/components/feed-v2/FeedApp';
import FeedSkeleton from '@/components/feed-v2/FeedSkeleton';
import { loadFeedViewData, findSharedStory, findStoryInArchive } from '@/lib/feed-view';

export const dynamic = 'force-dynamic';

async function sharedStory(id: string) {
  const { stories } = await loadFeedViewData();
  return findSharedStory(stories, id) || await findStoryInArchive(id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const story = await sharedStory(id).catch(() => null);
  if (!story) {
    return { title: 'Story not available | Trace' };
  }
  const description = story.body ? `${story.body.slice(0, 160)}…` : `Shared from Trace — ${story.source}`;
  return {
    title: `${story.title} | Trace`,
    description,
    openGraph: {
      title: story.title,
      description,
      ...(story.img ? { images: [{ url: story.img }] } : {}),
    },
    twitter: {
      card: story.img ? 'summary_large_image' : 'summary',
      title: story.title,
      description,
    },
  };
}

function MissingStory() {
  return (
    <main style={{
      background: '#fff', color: '#0f1419', minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 16px' }}>
        <p style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>Trace</p>
        <p style={{ fontSize: 16, color: '#536471' }}>
          This story isn&rsquo;t available anymore. Shared stories live for a day.
        </p>
        <a href="/feed" style={{
          display: 'inline-block', marginTop: 20, height: 44, lineHeight: '44px', padding: '0 24px',
          borderRadius: 9999, background: '#1d9bf0', color: '#fff',
          fontSize: 15, fontWeight: 700, textDecoration: 'none',
        }}>
          Get your daily feed — free
        </a>
      </div>
    </main>
  );
}

export default async function SharedStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { stories, headlines, pulse, promoted, monthlyReach, generated, feedDate, feedError } = await loadFeedViewData();
  const story = findSharedStory(stories, id) || await findStoryInArchive(id);

  if (!story) {
    return <MissingStory />;
  }

  // The shared article renders inside the real feed chrome (same sidebar,
  // tools rail, auth state as /feed) with the story pre-opened.
  return (
    <Suspense fallback={<FeedSkeleton />}>
        <FeedApp
          stories={stories}
          headlines={headlines}
          pulse={pulse}
          promoted={promoted}
          monthlyReach={monthlyReach}
          generated={generated}
          feedDate={feedDate}
          feedError={feedError}
          initialStory={story}
          initialStoryId={story.id}
        />
    </Suspense>
  );
}
