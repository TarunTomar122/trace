import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import { getDailyArchiveEntries, getDailyArchiveFeed, getTodayIstDate } from '@/lib/daily-archive';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ date: string }>;
};

function trimText(value: unknown, maxChars = 220): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}...`;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function topicHref(topic: TrendingTopic, returnTo?: string): string | null {
  const slug = (topic.topic_key || topic.id || '').trim();
  if (!slug) return null;
  const base = `/topics/${slug}`;
  if (!returnTo) return base;
  return `${base}?from=${encodeURIComponent(returnTo)}`;
}

function storySubtitle(item: FeedItem): string {
  return trimText(stripMarkdown(
    item.summary?.short_article?.subtitle ||
      item.summary?.short_article?.why_it_matters ||
      item.summary?.short_article?.body ||
      '',
  ), 220);
}

function getPublicArticleHref(item: FeedItem, returnTo?: string): string | null {
  if (typeof item.id !== 'string') return null;
  if (!/^(fy|dd|tr)_[\w-]+$/.test(item.id)) return null;
  const base = `/articles/${item.id}`;
  if (!returnTo) return base;
  return `${base}?from=${encodeURIComponent(returnTo)}`;
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

  const feed = await getDailyArchiveFeed(date);
  if (!feed) notFound();

  const canonical = `https://www.yourtrace.online/daily/${feed.date}`;
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
  const returnTo = `/daily/${feed.date}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Script
        id="daily-archive-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <PublicHeader />
      <main className="px-4 sm:px-6">
        <article className="mx-auto max-w-6xl pt-24 pb-20 sm:pt-32">
          <Link href="/daily" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary/55 hover:text-foreground">
            Trace archive
          </Link>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {formatDateLabel(feed.date)}
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-secondary">
            A full-day snapshot of what moved in tech. Browse topic overviews first, then scan the story feed.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <Link href="/trending" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">Trending</Link>
            <Link href="/research" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">Research</Link>
            <Link href="/compare" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">Compare</Link>
            <Link href="/tools" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">Tools</Link>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/20 bg-white px-4 py-3 shadow-sm dark:bg-gray-950">
              <p className="text-[11px] uppercase tracking-[0.2em] text-secondary/45">Stories</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{feed.trending.length}</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-white px-4 py-3 shadow-sm dark:bg-gray-950">
              <p className="text-[11px] uppercase tracking-[0.2em] text-secondary/45">Topics</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{feed.trendingTopics.length}</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-white px-4 py-3 shadow-sm dark:bg-gray-950">
              <p className="text-[11px] uppercase tracking-[0.2em] text-secondary/45">Snapshot</p>
              <p className="mt-1 text-sm font-medium text-secondary/80">{assembledAtLabel || 'Archive copy'}</p>
            </div>
          </div>

          {feed.trendingTopics.length > 0 && (
            <section className="mt-10">
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight">Topic overviews</h2>
                <p className="text-xs text-secondary/55">Grouped clusters from the day</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {feed.trendingTopics.slice(0, 20).map((topic) => {
                  const href = topicHref(topic, returnTo);
                  const cleanedSummary = trimText(stripMarkdown(topic.summary || ''), 240);
                  const keyPoints = (topic.key_points || [])
                    .map((point) => trimText(stripMarkdown(point), 120))
                    .filter(Boolean)
                    .slice(0, 2);
                  const body = (
                    <div className="h-full rounded-2xl border border-border/20 bg-white p-4 shadow-sm transition-colors hover:border-border/40 dark:bg-gray-950">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-foreground/7 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary/65">
                          Topic
                        </span>
                        <p className="text-[11px] text-secondary/60">
                          {(topic.article_count || topic.articles?.length || 0)} stories · {topic.source_count || 0} sources
                        </p>
                      </div>
                      <p className="mt-3 text-base font-semibold leading-snug">{topic.title}</p>
                      <p className="mt-2 text-sm leading-6 text-secondary/75 line-clamp-3">{cleanedSummary}</p>
                      {keyPoints.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {keyPoints.map((point, idx) => (
                            <li key={`${topic.id}-kp-${idx}`} className="text-[12px] leading-5 text-secondary/70">
                              {point}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-3 text-[11px] font-medium text-secondary/50">
                        Open topic overview
                      </p>
                    </div>
                  );
                  return href ? (
                    <Link key={topic.id} href={href} className="block h-full">
                      {body}
                    </Link>
                  ) : (
                    <div key={topic.id}>{body}</div>
                  );
                })}
              </div>
            </section>
          )}

          {feed.trending.length > 0 && (
            <section className="mt-12">
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight">Story feed</h2>
                <p className="text-xs text-secondary/55">Direct links to original sources</p>
              </div>
              <ul className="space-y-3">
                {feed.trending.slice(0, 40).map((item) => {
                  const articleHref = getPublicArticleHref(item, returnTo);
                  return (
                    <li key={item.id} className="rounded-2xl border border-border/20 bg-white p-4 shadow-sm transition-colors hover:border-border/40 dark:bg-gray-950">
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                          {articleHref ? (
                            <Link href={articleHref} className="block">
                              <p className="text-base font-semibold leading-snug">{item.title}</p>
                            </Link>
                          ) : (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                              <p className="text-base font-semibold leading-snug">{item.title}</p>
                            </a>
                          )}
                          <p className="mt-1 text-xs text-secondary/60">
                            {[item.source_name || item.source, item.published_date].filter(Boolean).join(' · ')}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-secondary/75 line-clamp-3">{storySubtitle(item)}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {articleHref && (
                              <Link
                                href={articleHref}
                                className="rounded-full border border-border/25 px-2.5 py-1 text-secondary hover:text-foreground"
                              >
                                Read Trace summary
                              </Link>
                            )}
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-border/25 px-2.5 py-1 text-secondary hover:text-foreground"
                            >
                              Original source
                            </a>
                          </div>
                        </div>
                        {item.thumbnail && (
                          <img
                            src={item.thumbnail}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="hidden h-20 w-28 shrink-0 rounded-xl object-cover sm:block"
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="mt-10">
            <Link href="/daily" className="text-sm font-medium text-foreground underline underline-offset-4">
              View all archived days
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
