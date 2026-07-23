import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import { PublicFeedCard, PublicTopicCard } from '@/components/PublicFeedCard';
import {
  getDailyArchiveFeed,
  getAdjacentDailyArchiveNeighbours,
} from '@/lib/daily-archive';
import { ISO_DATE_RE } from '@/lib/daily-date-utils';
import { SITE_BASE_URL, SITE_NAME } from '@/lib/seo';

export const revalidate = 3600;

function formatDateHeading(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function formatDateTitle(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

type PageProps = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  if (!ISO_DATE_RE.test(date)) return {};
  const feed = await getDailyArchiveFeed(date);
  if (!feed) return {};

  const heading = formatDateHeading(date);
  const shortDate = formatDateTitle(date);
  const title = `Tech News — ${shortDate} | ${SITE_NAME}`;
  const description = `Daily tech news for ${shortDate}: ${feed.trending.length} stories and ${feed.trendingTopics.length} topic briefings across AI, startups, engineering, and markets.`;

  return {
    title,
    description,
    keywords: [
      'tech news digest',
      'daily tech news',
      'trending tech stories',
      heading,
      'AI news summary',
      'tech roundup',
      'developer news',
    ],
    alternates: {
      canonical: `${SITE_BASE_URL}/daily/${date}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_BASE_URL}/daily/${date}`,
      type: 'article',
      siteName: SITE_NAME,
      locale: 'en_US',
      publishedTime: `${date}T00:00:00Z`,
      modifiedTime: `${date}T00:00:00Z`,
      images: [{ url: `${SITE_BASE_URL}/opengraph-image`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_BASE_URL}/twitter-image`],
    },
  };
}

export default async function DailyArchivePage({ params }: PageProps) {
  const { date } = await params;
  if (!ISO_DATE_RE.test(date)) notFound();

  const feed = await getDailyArchiveFeed(date);
  if (!feed) notFound();

  const { older, newer } = await getAdjacentDailyArchiveNeighbours(date);
  const heading = formatDateHeading(date);
  const pageUrl = `${SITE_BASE_URL}/daily/${date}`;

  const itemListElements = [
    ...feed.trending.slice(0, 20).map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.title,
      url: item.url || pageUrl,
    })),
    ...feed.trendingTopics.slice(0, 10).map((item, i) => ({
      '@type': 'ListItem',
      position: feed.trending.length + i + 1,
      name: item.title,
      url: `${SITE_BASE_URL}/topics/${item.id}`,
    })),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Tech News Digest — ${heading}`,
    description: `${feed.trending.length} trending stories and ${feed.trendingTopics.length} topic overviews from ${heading}.`,
    url: pageUrl,
    datePublished: `${date}T00:00:00Z`,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_BASE_URL,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: itemListElements,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Daily Archive', item: `${SITE_BASE_URL}/daily` },
        { '@type': 'ListItem', position: 3, name: heading, item: pageUrl },
      ],
    },
  };

  return (
    <div className="landing-page landing-grid-bg min-h-screen">
      <PublicHeader variant="landing" ctaLabel="Sign in" ctaHref="/profile?tab=subscription" />

      <Script
        id={`daily-archive-jsonld-${date}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Header */}
        <header className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af] mb-2">
            Daily Tech Digest
          </p>
          <h1 className="text-[28px] sm:text-[34px] font-bold tracking-[-0.02em] text-[#111827] leading-tight">
            {heading}
          </h1>
          <p className="mt-2 text-[14px] text-[#6b7280]">
            {feed.trending.length} trending stories · {feed.trendingTopics.length} topic overviews
          </p>
        </header>

        {/* Prev / Next nav */}
        <nav className="flex items-center justify-between mb-8 text-[13px]">
          {newer ? (
            <Link href={`/daily/${newer}`} className="text-[#2563eb] hover:underline">
              ← {formatDateHeading(newer)}
            </Link>
          ) : <span />}
          {older ? (
            <Link href={`/daily/${older}`} className="text-[#2563eb] hover:underline">
              {formatDateHeading(older)} →
            </Link>
          ) : <span />}
        </nav>

        {/* Topics */}
        {feed.trendingTopics.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af] mb-4">
              Topic Overviews
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {feed.trendingTopics.map((topic) => (
                <PublicTopicCard
                  key={topic.id}
                  topic={{
                    id: topic.id,
                    title: topic.title || '',
                    summary: topic.summary || '',
                    sourceCount: topic.source_count || 0,
                    articleCount: topic.article_count || topic.articles?.length || 0,
                    keyPoints: (topic.key_points || []).filter(
                      (k): k is string => typeof k === 'string' && k.trim().length > 0,
                    ),
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Trending stories */}
        {feed.trending.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af] mb-4">
              Trending Stories
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {feed.trending.map((item) => (
                <PublicFeedCard
                  key={item.id || item.url}
                  item={{
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
                      item.metadata?.source_count || item.sources?.length || 0,
                    timestamp: item.published_date || '',
                    keyPoints: (item.summary?.short_article?.key_takeaways || []).filter(
                      (k): k is string => typeof k === 'string' && k.trim().length > 0,
                    ),
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-[14px] text-[#6b7280] mb-4">
            Want today&apos;s live feed with AI-powered summaries?
          </p>
          <Link
            href="/"
            className="inline-flex items-center rounded-full bg-[#111827] px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-[#1f2937] transition-colors"
          >
            Get Trace Free
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
