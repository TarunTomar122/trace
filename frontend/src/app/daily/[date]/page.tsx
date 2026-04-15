import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
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
      <main className="px-4 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-7xl pt-20 pb-20 sm:pt-28">
          {/* Breadcrumb */}
          <Link href="/daily" className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-secondary/40 transition-colors hover:text-foreground">
            <ArrowLeft size={12} />
            Trace archive
          </Link>

          {/* Date headline */}
          <h1 className="mt-4 text-[2.5rem] font-bold tracking-[-0.04em] leading-[0.95] sm:text-[3.5rem]">
            {formatDateLabel(feed.date)}
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-[1.8] text-secondary">
            A full-day snapshot of what moved in tech. Browse topic overviews first, then scan the story feed.
          </p>

          {/* Stats row */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Stories', value: String(feed.trending.length) },
              { label: 'Topics', value: String(feed.trendingTopics.length) },
              { label: 'Snapshot', value: assembledAtLabel || 'Archive copy' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[14px] border border-border/[0.06] bg-surface/30 px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-secondary/30">{stat.label}</p>
                <p className="mt-1.5 text-[1.25rem] font-bold tracking-[-0.02em]">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Topic overviews */}
          {feed.trendingTopics.length > 0 && (
            <section className="mt-14">
              <div className="mb-6 flex items-end justify-between gap-4">
                <h2 className="text-[1.5rem] font-bold tracking-[-0.03em]">Topic overviews</h2>
                <p className="text-[12px] text-secondary/40">Grouped clusters from the day</p>
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
                    <div className="group h-full rounded-[16px] border border-border/[0.06] bg-surface/30 p-5 transition-all hover:bg-surface/60 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-border/15">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/40">
                          Topic
                        </span>
                        <p className="text-[11px] text-secondary/40">
                          {(topic.article_count || topic.articles?.length || 0)} stories · {topic.source_count || 0} sources
                        </p>
                      </div>
                      <p className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.01em]">{topic.title}</p>
                      <p className="mt-2 text-[13px] leading-[1.6] text-secondary/65 line-clamp-3">{cleanedSummary}</p>
                      {keyPoints.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {keyPoints.map((point, idx) => (
                            <li key={`${topic.id}-kp-${idx}`} className="flex gap-2">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-secondary/20" />
                              <span className="text-[12px] leading-[1.5] text-secondary/60">{point}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-foreground/50 transition-colors group-hover:text-foreground">
                        Open topic overview
                        <ArrowRight size={11} />
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

          {/* Story feed */}
          {feed.trending.length > 0 && (
            <section className="mt-14">
              <div className="mb-6 flex items-end justify-between gap-4">
                <h2 className="text-[1.5rem] font-bold tracking-[-0.03em]">Story feed</h2>
                <p className="text-[12px] text-secondary/40">Direct links to original sources</p>
              </div>
              <div className="space-y-3">
                {feed.trending.slice(0, 40).map((item) => {
                  const articleHref = getPublicArticleHref(item, returnTo);
                  return (
                    <div key={item.id} className="group rounded-[16px] border border-border/[0.06] bg-surface/30 p-5 transition-all hover:bg-surface/60 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-border/15">
                      <div className="flex items-start gap-4">
                        <div className="min-w-0 flex-1">
                          {articleHref ? (
                            <Link href={articleHref} className="block">
                              <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] transition-colors group-hover:text-foreground/80">{item.title}</p>
                            </Link>
                          ) : (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                              <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] transition-colors group-hover:text-foreground/80">{item.title}</p>
                            </a>
                          )}
                          <p className="mt-1.5 text-[11px] text-secondary/40">
                            {[item.source_name || item.source, item.published_date].filter(Boolean).join(' · ')}
                          </p>
                          <p className="mt-2 text-[13px] leading-[1.6] text-secondary/60 line-clamp-3">{storySubtitle(item)}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {articleHref && (
                              <Link
                                href={articleHref}
                                className="rounded-full border border-border/[0.08] px-3 py-1 text-[11px] font-medium text-secondary/60 transition-all hover:text-foreground hover:border-border/20"
                              >
                                Read Trace summary
                              </Link>
                            )}
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-border/[0.08] px-3 py-1 text-[11px] font-medium text-secondary/60 transition-all hover:text-foreground hover:border-border/20"
                            >
                              Original source
                              <ExternalLink size={10} />
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
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="mt-12">
            <Link href="/daily" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground/60 transition-colors hover:text-foreground">
              <ArrowLeft size={13} />
              View all archived days
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
