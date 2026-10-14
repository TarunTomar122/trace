import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Star } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import DailySignup from '../../../brief/DailySignup';
import ShareBar from '../../../brief/ShareBar';
import { formatEditionDate, sourceHost } from '@/lib/daily-editions';
import { FEATURED_LABELS, featuredUrl, getFeaturedItem } from '@/lib/featured-items';
import { metadataTitle } from '@/lib/seo';
import { faviconUrl } from '@/lib/topic-icons';

// Ten minutes, like /brief: a just-featured item must not 404 for long.
export const revalidate = 600;

type Props = { params: Promise<{ date: string; id: string }> };

// Not indexed: each page is a title, one line and a link to someone else's
// work, so in search it would be a thin copy of the original. These pages are
// for sharing (the card on X, LinkedIn, Slack), and they still pass links on.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date, id } = await params;
  const item = await getFeaturedItem(date, id);
  if (!item) return { title: metadataTitle('Featured on Trace'), robots: { index: false } };

  const title = `Featured on Trace: ${item.title}`;
  const description = item.summary || `Picked for Trace's ${FEATURED_LABELS[item.section]} on ${formatEditionDate(date)}.`;
  const url = featuredUrl(date, item.id);
  return {
    title: metadataTitle(`Featured: ${item.title}`),
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: true },
    openGraph: { title, description, url, type: 'article', siteName: 'Trace' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function FeaturedItemPage({ params }: Props) {
  const { date, id } = await params;
  const item = await getFeaturedItem(date, id);
  if (!item) notFound();

  const label = FEATURED_LABELS[item.section];
  const host = sourceHost(item.url);
  // "simonwillison.net via Hacker News": the source is where Trace found it
  // (not repeated when it is the site itself, as with Product Hunt).
  const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const via = item.source && !compact(host).startsWith(compact(item.source)) ? item.source : '';
  const url = featuredUrl(date, item.id);
  const cta = item.section === 'tools' ? `Open on ${host}` : `Read it on ${host}`;

  return (
    <div className="min-h-screen">
      <PublicHeader variant="landing" hideCta />

      <main className="px-5 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-[640px] pt-10 pb-16 sm:pt-14">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#f91880]">
            <Star size={12} fill="currentColor" aria-hidden="true" />
            Featured on Trace
          </p>
          <p className="mt-2 text-[15px] text-secondary">
            In Trace&apos;s {label} for <time dateTime={date}>{formatEditionDate(date)}</time>
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-border">
            {item.image && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails */}
                <img
                  src={item.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="block h-[220px] w-full bg-[#f7f9f9] object-cover object-[center_28%] sm:h-[320px]"
                />
              </a>
            )}
            <div className="p-5 sm:p-6">
              <h1 className="text-[24px] font-extrabold leading-[1.16] tracking-[-0.035em] text-[#0f1419] sm:text-[30px]">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{item.title}</a>
              </h1>
              {item.summary && (
                <p className="mt-2.5 text-[15px] leading-[1.5] text-[#536471] sm:text-[16px]">{item.summary}</p>
              )}
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] font-semibold text-[#536471]">
                {host && (
                  // eslint-disable-next-line @next/next/no-img-element -- publisher favicon
                  <img
                    src={faviconUrl(host)}
                    alt=""
                    width={16}
                    height={16}
                    className="h-4 w-4 rounded-full bg-white shadow-[0_0_0_1px_#eff3f4]"
                  />
                )}
                <span>{host}</span>
                {via && <span>via {via}</span>}
                {item.signal && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{item.signal}</span>
                  </>
                )}
              </p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0f1419] px-5 text-[15px] font-bold text-white transition hover:bg-[#272c30]"
              >
                {cta}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mt-5">
            <ShareBar url={url} text={`Featured on Trace: ${item.title}`} event="featured_page_shared" />
          </div>

          <p className="mt-10 text-[15px] leading-relaxed text-secondary">
            Trace reads hundreds of tech sources every day and keeps what is worth your time: the day&apos;s top
            stories, plus Tools and Top articles like this one.{' '}
            <Link
              href={`/brief/${date}`}
              className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            >
              Read the brief for {formatEditionDate(date, 'short')}
            </Link>
            .
          </p>

          <div className="mt-6">
            <DailySignup
              source="featured_page"
              heading="Get Trace's daily brief"
              blurb="The stories that mattered in tech and AI, in your inbox every morning. Free, no account needed."
            />
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
