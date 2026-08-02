import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Check, Clock3, Newspaper } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import {
  getDailyArchiveFeed,
  getAdjacentDailyArchiveNeighbours,
  getTodaysFeed,
  type DailyArchiveFeed,
} from '@/lib/daily-archive';
import { getTodayIstDate, ISO_DATE_RE } from '@/lib/daily-date-utils';
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

function cleanText(value: string | undefined): string {
  return (value || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function storySummary(item: DailyArchiveFeed['trending'][number]): string {
  return cleanText(
    item.summary?.short_article?.subtitle
      || item.summary?.short_article?.body
      || item.description,
  );
}

function storySource(item: DailyArchiveFeed['trending'][number]): string {
  return cleanText(item.source_name || item.source || item.sources?.[0]?.name) || 'Trace';
}

function storySourceCount(item: DailyArchiveFeed['trending'][number]): number {
  return item.metadata?.source_count || item.sources?.length || 0;
}

function LiveBriefPanel({ currentFeed }: { currentFeed: DailyArchiveFeed | null }) {
  const isToday = currentFeed?.date === getTodayIstDate();
  const label = isToday ? 'Today at Trace' : 'Latest Trace brief';
  const lead = currentFeed?.trending[0] ? cleanText(currentFeed.trending[0].title) : '';
  const count = currentFeed?.trending.length || 0;
  const topicCount = currentFeed?.trendingTopics.length || 0;

  return (
    <section className="bg-[#2557d6] p-6 text-white sm:p-8">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/65">{label}</p>
      <h2 className="mt-4 text-[27px] font-semibold leading-[1.04] tracking-[-0.035em]">
        The tech day has moved on.
      </h2>
      <p className="mt-3 max-w-md text-[14px] leading-[1.7] text-white/76">
        Read the brief that is current now: the news, builds, and conversations worth your time.
      </p>
      {currentFeed && (
        <div className="mt-5 border-y border-white/15 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/55">
            {count} stories · {topicCount} connected topics
          </p>
          {lead && <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-[1.45] text-white/90">{lead}</p>}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/feed?view=pulse"
          className="inline-flex items-center gap-2 bg-white px-4 py-2.5 text-[13px] font-semibold text-[#2557d6] transition-colors hover:bg-[#f5f3ed]"
        >
          Read today&apos;s brief <ArrowRight size={14} />
        </Link>
        <Link
          href="/subscribe"
          className="inline-flex items-center gap-2 border border-white/35 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
        >
          Try Pro free for 3 days
        </Link>
      </div>
      <p className="mt-4 text-[11px] text-white/62">No charge for 3 days · Cancel anytime.</p>
    </section>
  );
}

function ArchiveStory({ item, index }: { item: DailyArchiveFeed['trending'][number]; index: number }) {
  const summary = storySummary(item);
  const source = storySource(item);
  const sourceCount = storySourceCount(item);

  return (
    <article className="grid gap-4 py-6 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-6">
      <span className="font-mono text-[12px] font-semibold tracking-[0.08em] text-[#2557d6]">{String(index + 1).padStart(2, '0')}</span>
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a867c]">
          <span>{source}</span>
          {sourceCount > 1 && <span className="text-[#b7b2a7]">· {sourceCount} sources</span>}
        </div>
        <h3 className="mt-2 text-[20px] font-semibold leading-[1.2] tracking-[-0.025em] text-[#1b1a17] sm:text-[22px]">
          {cleanText(item.title)}
        </h3>
        {summary && <p className="mt-2 max-w-2xl text-[15px] leading-[1.65] text-[#68645b]">{summary}</p>}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2557d6] hover:underline"
          >
            Read source <ArrowUpRight size={13} />
          </a>
        )}
      </div>
    </article>
  );
}

function ArchiveTrialCallout() {
  return (
    <section className="my-5 border border-[#cbd5f5] bg-[#f3f5ff] p-6 sm:p-8">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2557d6]">Trace Pro</p>
      <h2 className="mt-3 text-[25px] font-semibold tracking-[-0.03em] text-[#1b1a17]">You&apos;ve seen the record. See the live version.</h2>
      <p className="mt-2 max-w-xl text-[14px] leading-[1.7] text-[#676c7a]">Get today&apos;s stories, useful builds, and conversations organized before you start scrolling.</p>
      <Link href="/subscribe" className="mt-5 inline-flex items-center gap-2 bg-[#2557d6] px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d48b4]">
        Start your 3-day free trial <ArrowRight size={14} />
      </Link>
      <p className="mt-3 text-[11px] text-[#6e7485]">No charge for 3 days · Cancel anytime.</p>
    </section>
  );
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

  const [{ older, newer }, currentFeed] = await Promise.all([
    getAdjacentDailyArchiveNeighbours(date),
    getTodaysFeed(),
  ]);
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
      <PublicHeader variant="landing" ctaLabel="Read today&apos;s brief" ctaHref="/feed?view=pulse" />

      <Script
        id={`daily-archive-jsonld-${date}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#918c81]">
          <Link href="/" className="hover:text-[#2557d6]">Trace</Link>
          <span aria-hidden>·</span>
          <Link href="/daily" className="hover:text-[#2557d6]">Daily archive</Link>
          <span aria-hidden>·</span>
          <span>{formatDateTitle(date)}</span>
        </nav>

        <section className="border-y border-[#e4e1d8] py-8 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)] lg:items-stretch">
            <header className="flex flex-col justify-between py-1">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2557d6]">Archived Trace edition</p>
                <h1 className="mt-4 max-w-3xl tracking-[-0.045em] text-[#1b1a17]" style={{ fontFamily: 'var(--font-edition-serif), Georgia, serif', fontSize: 'clamp(2.5rem, 5vw, 4.6rem)', lineHeight: 0.98 }}>
                  Tech news digest for {heading}
                </h1>
                <p className="mt-5 max-w-2xl text-[16px] leading-[1.7] text-[#6d695e]">
                  {feed.trending.length} stories, distilled into {feed.trendingTopics.length} connected developments. This is the record of that day. The live Trace brief is ready now.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-4 text-[12px] font-semibold text-[#6e6a60]">
                <span className="inline-flex items-center gap-2"><Newspaper size={14} className="text-[#2557d6]" />Grouped across sources</span>
                <span className="inline-flex items-center gap-2"><Clock3 size={14} className="text-[#2557d6]" />A five-minute catch-up</span>
              </div>
            </header>
            <LiveBriefPanel currentFeed={currentFeed} />
          </div>
        </section>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16">
          <div>
            {feed.trendingTopics.length > 0 && (
              <section aria-labelledby="archive-topics">
                <div className="flex items-end justify-between gap-5">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2557d6]">The day in brief</p>
                    <h2 id="archive-topics" className="mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[#1b1a17]">What connected the day</h2>
                  </div>
                  <span className="shrink-0 text-[12px] text-[#898478]">{feed.trendingTopics.length} topics</span>
                </div>
                <ol className="mt-6 border-y border-[#e4e1d8]">
                  {feed.trendingTopics.map((topic, index) => {
                    const keyPoints = (topic.key_points || []).filter((point): point is string => typeof point === 'string' && point.trim().length > 0).slice(0, 2);
                    return (
                      <li key={topic.id || topic.title} className="grid gap-4 border-b border-[#eae7df] py-5 last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-6">
                        <span className="font-mono text-[12px] font-semibold tracking-[0.08em] text-[#2557d6]">{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#918c81]">{topic.source_count || 0} sources · {topic.article_count || topic.articles?.length || 0} updates</div>
                          <h3 className="mt-2 text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-[#1b1a17]">{cleanText(topic.title)}</h3>
                          {topic.summary && <p className="mt-2 max-w-2xl text-[14px] leading-[1.65] text-[#68645b]">{cleanText(topic.summary)}</p>}
                          {keyPoints.length > 0 && <ul className="mt-3 space-y-1 text-[13px] leading-[1.5] text-[#6e6a60]">{keyPoints.map((point) => <li key={point} className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-[#2557d6]" />{cleanText(point)}</li>)}</ul>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {feed.trending.length > 0 && (
              <section className="mt-14" aria-labelledby="archive-stories">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2557d6]">The archive</p>
                <h2 id="archive-stories" className="mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[#1b1a17]">What moved</h2>
                <div className="mt-6 border-y border-[#e4e1d8]">
                  {feed.trending.map((item, index) => (
                    <div key={item.id || item.url || item.title} className="border-b border-[#eae7df] last:border-b-0">
                      <ArchiveStory item={item} index={index} />
                      {index === 2 && <ArchiveTrialCallout />}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <nav aria-label="Archive navigation" className="mt-10 flex items-center justify-between gap-4 border-t border-[#e4e1d8] pt-6 text-[13px] font-semibold">
              {newer ? <Link href={`/daily/${newer}`} className="text-[#2557d6] hover:underline">← Newer brief</Link> : <span />}
              {older ? <Link href={`/daily/${older}`} className="text-[#2557d6] hover:underline">Older brief →</Link> : <span />}
            </nav>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 border-t border-[#1b1a17] pt-5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2557d6]">Make this your daily read</p>
              <h2 className="mt-3 text-[22px] font-semibold leading-[1.12] tracking-[-0.03em] text-[#1b1a17]">Don&apos;t start tomorrow already behind.</h2>
              <ul className="mt-5 space-y-3 text-[13px] leading-[1.5] text-[#676359]">
                <li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[#2557d6]" />Today&apos;s live edition</li>
                <li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[#2557d6]" />Key takeaways and source links</li>
                <li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[#2557d6]" />A feed tuned to what you follow</li>
              </ul>
              <Link href="/subscribe" className="mt-6 inline-flex w-full items-center justify-center gap-2 bg-[#2557d6] px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d48b4]">Try Pro free for 3 days <ArrowRight size={14} /></Link>
              <p className="mt-3 text-center text-[11px] text-[#8a867c]">No charge for 3 days · Cancel anytime.</p>
              <Link href="/feed?view=pulse" className="mt-4 block text-center text-[12px] font-semibold text-[#2557d6] hover:underline">Read today&apos;s brief first</Link>
            </div>
          </aside>
        </div>

        <div className="mt-14 lg:hidden"><ArchiveTrialCallout /></div>
      </main>

      <Footer />
    </div>
  );
}
