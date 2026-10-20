import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Star } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import DailySignup from '../../../brief/DailySignup';
import ShareBar from '../../../brief/ShareBar';
import { formatEditionDate, getDailyEdition, sourceHost } from '@/lib/daily-editions';
import { FEATURED_LABELS, featuredUrl, getFeaturedItem } from '@/lib/featured-items';
import { metadataTitle } from '@/lib/seo';
import { faviconUrl } from '@/lib/topic-icons';
import { displaySerif } from '@/lib/home-fonts';

// Ten minutes, like /brief: a just-featured item must not 404 for long.
export const revalidate = 600;

type Props = { params: Promise<{ date: string; id: string }> };

const TEXT_LINK = 'font-medium text-[#0a0a0a] underline decoration-[#c7c7c7] underline-offset-4 hover:decoration-[#0a0a0a]';

// Not indexed: each page is a title, one line and a link to someone else's
// work, so in search it would be a thin copy of the original. These pages are
// for sharing (the card on X, LinkedIn, Slack), and they still pass links on.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date, id } = await params;
  const item = await getFeaturedItem(date, id);
  if (!item) return { title: metadataTitle('Featured on Trace') };

  const title = `Featured on Trace: ${item.title}`;
  // Share cards and search snippets cut long text anyway; keep it to a sentence or two.
  const summary = item.summary.length > 200 ? `${item.summary.slice(0, 197).trimEnd()}…` : item.summary;
  const description = summary || `Picked for Trace's ${FEATURED_LABELS[item.section]} on ${formatEditionDate(date)}.`;
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
  const [item, edition] = await Promise.all([getFeaturedItem(date, id), getDailyEdition(date).catch(() => null)]);
  if (!item) notFound();

  const label = FEATURED_LABELS[item.section];
  const host = sourceHost(item.url);
  // "simonwillison.net via Hacker News": the source is where Trace found it
  // (not repeated when it is the site itself, as with Product Hunt).
  const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const via = item.source && !compact(host).startsWith(compact(item.source)) ? item.source : '';
  const url = featuredUrl(date, item.id);
  const cta = item.section === 'tools' ? `Open on ${host}` : `Read it on ${host}`;
  // Where the pick lives: Top articles is a feed tab; Tools sit beside the feed.
  const listHref = item.section === 'tools' ? '/feed' : '/feed?tab=top-articles';
  // Links out are rel="noopener" without noreferrer, so makers see Trace in
  // their referrers (origin only, per the site's Referrer-Policy).

  return (
    <div className={`${displaySerif.variable} min-h-screen bg-white text-[#0a0a0a]`}>
      <PublicHeader subscribeHref="#subscribe" />

      <main className="px-5 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-[640px] pt-10 pb-16 sm:pt-14">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold">
            <Star size={15} fill="currentColor" aria-hidden="true" />
            <span className="bg-[#ffef5f] px-1.5">Featured on Trace</span>
          </p>
          <p className="mt-2 text-[15px] text-[#767676]">
            In Trace&apos;s {label} for <time dateTime={date}>{formatEditionDate(date)}</time>
          </p>

          <div className="mt-6 overflow-hidden rounded-[12px] border border-[#e5e5e5]">
            {item.image && (
              <a href={item.url} target="_blank" rel="noopener" tabIndex={-1} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails */}
                <img
                  src={item.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="block h-[220px] w-full bg-[#f7f7f8] object-cover object-[center_28%] sm:h-[320px]"
                />
              </a>
            )}
            <div className="p-5 sm:p-6">
              <h1 className="font-[family-name:var(--font-hp-serif)] text-[30px] font-medium leading-[1.06] tracking-[-0.005em] text-balance sm:text-[40px]">
                <a href={item.url} target="_blank" rel="noopener" className="hover:underline">{item.title}</a>
              </h1>
              {item.summary && (
                <p className="mt-3 text-[16px] leading-[1.55] text-[#323232] sm:text-[17px]">{item.summary}</p>
              )}
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14px] font-medium text-[#767676]">
                {host && (
                  // eslint-disable-next-line @next/next/no-img-element -- publisher favicon
                  <img
                    src={faviconUrl(host)}
                    alt=""
                    width={16}
                    height={16}
                    className="h-4 w-4 rounded-full bg-white shadow-[0_0_0_1px_#e5e5e5]"
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
                rel="noopener"
                className="mt-5 inline-flex h-[46px] items-center gap-1.5 rounded-[3px] bg-[#0a0a0a] px-[18px] text-[17px] text-white transition-colors hover:bg-[#323232]"
              >
                {cta}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mt-5">
            <ShareBar url={url} text={`Featured on Trace: ${item.title}`} event="featured_page_shared" />
          </div>

          <p className="mt-10 text-[16px] leading-relaxed text-[#323232]">
            Trace reads 100+ tech sources every day and keeps what is worth your time.{' '}
            <Link href={listHref} className={TEXT_LINK}>
              See the latest {label}
            </Link>
            , or the day&apos;s top stories in{' '}
            {/* A day's edition can be missing (a send that didn't run); then link the latest one. */}
            <Link href={edition ? `/brief/${date}` : '/brief'} className={TEXT_LINK}>
              {edition ? `the brief for ${formatEditionDate(date, 'short')}` : 'the latest brief'}
            </Link>
            .
          </p>

          {/* The header's Subscribe lands here (scroll-mt clears the sticky header). */}
          <div className="mt-6 scroll-mt-20" id="subscribe">
            <DailySignup
              source="featured_page"
              heading="Get Trace's daily brief"
              blurb="The stories that mattered in tech and AI, in your inbox every morning. Free, no account needed."
            />
          </div>
        </article>
      </main>

      <Footer variant="landing" />
    </div>
  );
}
