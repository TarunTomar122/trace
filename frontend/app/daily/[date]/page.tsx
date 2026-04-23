import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import {
  getAdjacentDailyArchiveNeighbours,
  getDailyArchiveEntries,
  getDailyArchiveFeed,
  getTodayIstDate,
} from '@/lib/daily-archive';
import DailyArchiveNewsletterView from './DailyArchiveNewsletterView';

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ date: string }>;
};

function formatDateLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export async function generateStaticParams() {
  const entries = await getDailyArchiveEntries(180);
  return entries.map((entry) => ({ date: entry.date }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  const today = getTodayIstDate();
  if (date >= today) {
    return {
      title: 'Archive Not Available | Trace',
      robots: { index: false, follow: false },
    };
  }

  const feed = await getDailyArchiveFeed(date);
  if (!feed) {
    return {
      title: 'Archive Not Found | Trace',
      robots: { index: false, follow: false },
    };
  }

  const description = `Archived Trace snapshot for ${feed.date}: ${feed.trending.length} stories and ${feed.trendingTopics.length} topic overviews.`;
  const canonical = `https://www.yourtrace.online/daily/${feed.date}`;

  return {
    title: `Daily Archive ${feed.date} | Trace`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Daily Archive ${feed.date} | Trace`,
      description,
      type: 'article',
      url: canonical,
    },
    twitter: {
      card: 'summary',
      title: `Daily Archive ${feed.date} | Trace`,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function DailyArchiveDatePage({ params }: PageProps) {
  const { date } = await params;
  if (date >= getTodayIstDate()) notFound();

  const [feed, neighbours] = await Promise.all([
    getDailyArchiveFeed(date),
    getAdjacentDailyArchiveNeighbours(date),
  ]);
  if (!feed) notFound();

  const canonical = `https://www.yourtrace.online/daily/${feed.date}`;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.yourtrace.online/' },
      { '@type': 'ListItem', position: 2, name: 'Daily archive', item: 'https://www.yourtrace.online/daily' },
      {
        '@type': 'ListItem',
        position: 3,
        name: `Snapshot ${feed.date}`,
        item: canonical,
      },
    ],
  };
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Trace Daily Archive ${feed.date}`,
    url: canonical,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: feed.trending.slice(0, 25).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        url: item.url,
      })),
    },
  };
  const assembledAtLabel = feed.assembledAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(new Date(feed.assembledAt))
    : null;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Script
        id="daily-archive-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Script
        id="daily-archive-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <PublicHeader />
      <main>
        <DailyArchiveNewsletterView
          longDateLabel={formatDateLabel(feed.date)}
          isoDate={feed.date}
          assembledAtLabel={assembledAtLabel}
          trending={feed.trending}
          trendingTopics={feed.trendingTopics}
          neighbours={neighbours}
        />
      </main>
      <Footer />
    </div>
  );
}
