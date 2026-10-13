import type { Metadata } from 'next';
import Link from 'next/link';
import { Star } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import DailySignup from './DailySignup';
import { formatEditionDate, listDailyEditions } from '@/lib/daily-editions';
import { DEFAULT_OPEN_GRAPH, DEFAULT_TWITTER_IMAGE, metadataTitle, SITE_BASE_URL } from '@/lib/seo';

export const revalidate = 600;

const TITLE = 'The daily brief: the biggest stories in tech, every day';
const DESCRIPTION =
  'Every edition of the Trace daily brief: the ten stories that mattered in tech and AI each day, summarised. Free to read, free in your inbox.';

export const metadata: Metadata = {
  title: metadataTitle(TITLE),
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_BASE_URL}/brief` },
  openGraph: { ...DEFAULT_OPEN_GRAPH, title: TITLE, description: DESCRIPTION, url: `${SITE_BASE_URL}/brief`, type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [DEFAULT_TWITTER_IMAGE] },
};

export default async function DailyArchivePage() {
  const editions = await listDailyEditions(90);
  const [latest, ...past] = editions;
  const lead = latest?.stories[0];

  return (
    <div className="min-h-screen">
      <PublicHeader variant="landing" hideCta />

      <main className="px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[720px] pt-10 pb-16 sm:pt-14">
          <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[2.5rem]">
            The daily brief
          </h1>
          <p className="mt-2 text-[17px] leading-relaxed text-secondary">
            The stories that mattered in tech, every morning.{' '}
            <Link href="/brief/customize" className="font-semibold text-[#1d9bf0] hover:underline">Make it yours</Link>
          </p>
          <div className="mt-6">
            <DailySignup compact />
          </div>

          {!latest || !lead ? (
            <p className="mt-12 text-secondary">The first edition is on its way. Check back tomorrow morning.</p>
          ) : (
            <>
              {/* Today, as the feed's story-of-the-day card. */}
              <Link href={`/brief/${latest.date}`} className="group -mx-5 mt-10 block border-y border-border pt-[18px] pb-[22px] transition hover:bg-[#f7f9f9] sm:mx-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:pt-[22px] sm:pb-[26px]">
                <p className="mb-3.5 flex items-center gap-1.5 px-5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#f91880] sm:mb-4 sm:px-[18px]">
                  <Star size={12} fill="currentColor" aria-hidden="true" /> {formatEditionDate(latest.date)}
                </p>
                {lead.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails
                  <img src={lead.image} alt="" referrerPolicy="no-referrer" className="mb-[18px] block h-[240px] w-full bg-[#f7f9f9] object-cover object-[center_28%] sm:mb-[22px] sm:h-[340px]" />
                )}
                <div className="px-5 sm:px-[18px]">
                  <h2 className="text-[22px] font-extrabold leading-[1.16] tracking-[-0.035em] group-hover:underline sm:text-[28px]">{lead.title}</h2>
                  <ul className="mt-3 space-y-2 text-[14.5px] leading-[1.45] text-[#536471] sm:text-[16px]">
                    {latest.stories.slice(1, 4).map((story) => (
                      <li key={story.url}>· {story.title}</li>
                    ))}
                  </ul>
                  <span className="mt-4 inline-flex h-9 items-center rounded-full bg-[#1d9bf0] px-4 text-[14px] font-bold text-white">
                    Read all {latest.stories.length}
                  </span>
                </div>
              </Link>

              {past.length > 0 && (
                <ul className="-mx-5 mt-8 border-y border-border sm:mx-0 sm:overflow-hidden sm:rounded-2xl sm:border">
                  {past.map((edition) => {
                    const top = edition.stories[0];
                    return (
                      <li key={edition.date} className="border-b border-border last:border-b-0">
                        <Link href={`/brief/${edition.date}`} className="flex gap-4 px-5 py-[18px] transition hover:bg-[#f7f9f9] sm:px-[18px]">
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] text-secondary">
                              <time dateTime={edition.date}>{formatEditionDate(edition.date)}</time>
                            </p>
                            <p className="mt-0.5 text-[16px] font-bold leading-snug">{top?.title}</p>
                            {edition.stories.length > 1 && <p className="mt-1 text-[14px] text-secondary">+ {edition.stories.length - 1} more</p>}
                          </div>
                          {top?.image && (
                            // eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails
                            <img src={top.image} alt="" loading="lazy" className="h-[76px] w-[112px] shrink-0 rounded-xl bg-[#f7f9f9] object-cover" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
