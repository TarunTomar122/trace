import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import DailySignup from '../DailySignup';
import ShareBar from '../ShareBar';
import BriefStory from '../BriefStory';
import { laneKicker } from '@/lib/newsletter-prefs';
import {
  formatEditionDate,
  getDailyEdition,
  isEditionDate,
  listEditionDates,
  neighbours,
  type DailyStory,
} from '@/lib/daily-editions';
import { metadataTitle, SITE_BASE_URL } from '@/lib/seo';

// Ten minutes: today's brief can come from the live feed until the morning
// edition is published, and a not-yet-published date must not 404 for long.
export const revalidate = 600;

type Props = { params: Promise<{ date: string }> };


/** "Story of the day" first, then one kicker each time the label changes. */
function kickerFor(stories: DailyStory[], index: number): string {
  if (index === 0) return 'Story of the day';
  const label = laneKicker(stories[index].lane);
  return index > 1 && laneKicker(stories[index - 1].lane) === label ? '' : label;
}

function editionUrl(date: string) {
  return `${SITE_BASE_URL}/brief/${date}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const edition = isEditionDate(date) ? await getDailyEdition(date) : null;
  if (!edition) return { title: metadataTitle('Daily brief'), robots: { index: false } };

  const title = `${edition.stories.length} big things in tech · ${formatEditionDate(date)}`;
  const description = edition.stories
    .slice(0, 3)
    .map((story) => story.title)
    .join(' · ');
  const url = editionUrl(date);
  return {
    title: metadataTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article', siteName: 'Trace' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function DailyEditionPage({ params }: Props) {
  const { date } = await params;
  if (!isEditionDate(date)) notFound();
  const [edition, recent] = await Promise.all([getDailyEdition(date), listEditionDates(400)]);
  if (!edition) notFound();

  const { newer, older } = neighbours(recent.map((item) => item.date), date);
  const url = editionUrl(date);
  const shareText = `${edition.stories.length} big things in tech today (${formatEditionDate(date, 'short')}) via Trace`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${edition.stories.length} big things in tech · ${formatEditionDate(date)}`,
    url,
    datePublished: edition.published_at || `${date}T08:00:00+05:30`,
    isAccessibleForFree: true,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: edition.stories.map((story, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: story.title,
        url: story.url,
      })),
    },
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
      <PublicHeader variant="landing" hideCta />

      <main className="px-5 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-[720px] pt-10 pb-16 sm:pt-14">
          <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[2.5rem]">
            {edition.stories.length} big things in tech
          </h1>
          <p className="mt-2 text-[15px] text-secondary">
            <time dateTime={date}>{formatEditionDate(date)}</time>
            {' · '}
            <Link href="/brief" className="hover:underline">All editions</Link>
          </p>
          <div className="mt-5">
            <ShareBar url={url} text={shareText} />
          </div>

          {/* The feed's home column: edge to edge on phones, one kicker per topic run. */}
          <ol className="-mx-5 mt-8 border-y border-border sm:mx-0 sm:overflow-hidden sm:rounded-2xl sm:border">
            {edition.stories.map((story, index) => (
              <li key={story.url} className="border-b border-border last:border-b-0">
                <BriefStory story={story} kicker={kickerFor(edition.stories, index)} eager={index < 2} />
              </li>
            ))}
          </ol>

          <div className="mt-12">
            <DailySignup />
            <p className="mt-4 text-sm text-secondary">
              Want only AI and markets, or five stories instead of ten?{' '}
              <Link href="/brief/customize" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                Build your own brief
              </Link>
              .
            </p>
          </div>

          <nav className="mt-8 flex items-center justify-between gap-4 text-[15px] font-semibold" aria-label="Other editions">
            {older ? (
              <Link href={`/brief/${older}`} className="text-secondary hover:text-foreground">
                ← {formatEditionDate(older, 'short')}
              </Link>
            ) : <span />}
            <Link href="/brief" className="text-secondary hover:text-foreground">All editions</Link>
            {newer ? (
              <Link href={`/brief/${newer}`} className="text-secondary hover:text-foreground">
                {formatEditionDate(newer, 'short')} →
              </Link>
            ) : <span />}
          </nav>
        </article>
      </main>

      <Footer />
    </div>
  );
}
