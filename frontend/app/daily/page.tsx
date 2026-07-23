import type { Metadata } from 'next';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import {
  getDailyArchiveEntries,
  getDailyArchiveFeed,
  type DailyArchiveEntry,
} from '@/lib/daily-archive';
import DailyFeedView from './DailyFeedView';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '@/lib/seo';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Daily Tech Feed Archive | Trace',
  description:
    "Browse past daily tech feeds — stories grouped by topic with key takeaways. Or unlock today's live feed with Trace Pro.",
  alternates: {
    canonical: 'https://www.yourtrace.online/daily',
  },
  openGraph: {
    title: 'Daily Tech Feed Archive | Trace',
    description:
      "Past daily tech feeds with grouped stories and topic overviews. Unlock today's live feed with Trace Pro.",
    url: 'https://www.yourtrace.online/daily',
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Daily Tech Feed Archive | Trace',
    description: 'Browse past daily tech feeds with grouped stories and topic overviews.',
    images: ['https://www.yourtrace.online/twitter-image'],
  },
};

function toFeedItems(items: DailyArchiveEntry[]) {
  return items.map((e) => ({
    date: e.date,
    trendingCount: e.trendingCount,
    topicCount: e.topicCount,
    topHeadline: e.topHeadline,
  }));
}

export default async function DailyPage() {
  const entries = await getDailyArchiveEntries(365);

  // Pre-fetch the most recent archive's full feed for initial display
  const latestDate = entries[0]?.date || null;
  const initialFeed = latestDate ? await getDailyArchiveFeed(latestDate) : null;

  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <DailyFeedView
          archiveDates={toFeedItems(entries)}
          initialDate={latestDate}
          initialFeed={
            initialFeed
              ? {
                  date: initialFeed.date,
                  trending: initialFeed.trending.map((item) => ({
                    id: item.id || item.url || '',
                    title: item.title || '',
                    url: item.url || '',
                    thumbnail: item.thumbnail || null,
                    source: item.source_name || item.source || '',
                    summary:
                      item.summary?.short_article?.body ||
                      item.summary?.short_article?.subtitle ||
                      item.description ||
                      '',
                    sourceCount:
                      item.metadata?.source_count ||
                      item.sources?.length ||
                      0,
                    timestamp: item.published_date || '',
                    keyPoints: (
                      item.summary?.short_article?.key_takeaways || []
                    ).filter(
                      (k): k is string =>
                        typeof k === 'string' && k.trim().length > 0,
                    ),
                  })),
                  topics: initialFeed.trendingTopics.map((t) => ({
                    id: t.id,
                    title: t.title || '',
                    summary: t.summary || '',
                    sourceCount: t.source_count || 0,
                    articleCount:
                      t.article_count || t.articles?.length || 0,
                    keyPoints: (t.key_points || []).filter(
                      (k): k is string =>
                        typeof k === 'string' && k.trim().length > 0,
                    ),
                  })),
                }
              : null
          }
        />
      </main>
      <Footer />
    </div>
  );
}
