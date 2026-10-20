import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mail } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import LandingHeroSignup from '@/components/feed-v2/LandingHeroSignup';
import BriefStrip from '../BriefStrip';
import ShareBar from '../ShareBar';
import BriefStory from '../BriefStory';
import EditionToc, { EditionJump, type TocGroup } from './EditionToc';
import { RailSponsorCard, RailSubscribeCard, type RailSponsor } from './EditionSubscribeRail';
import { getPromotedTools } from '@/lib/feed-view';
import { HOME_CSS } from '@/lib/home-css';
import { BRIEF_CSS } from '@/lib/brief-css';
import { HOME_FONT_VARS } from '@/lib/home-fonts';
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

/** The table of contents: stories under the same kickers the page shows, numbered from 1. */
function tocGroups(stories: DailyStory[]): TocGroup[] {
  const groups: TocGroup[] = [];
  stories.forEach((story, index) => {
    const label = kickerFor(stories, index);
    if (label || !groups.length) groups.push({ label: label || 'Stories', items: [] });
    groups[groups.length - 1].items.push({ n: index + 1, title: story.title });
  });
  return groups;
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
  const [edition, recent, sponsors] = await Promise.all([
    getDailyEdition(date),
    listEditionDates(400),
    getPromotedTools(), // the feed's active sponsors (cached 5 min); the rail shows the first
  ]);
  if (!edition) notFound();
  const sponsor: RailSponsor | null = (sponsors[0] as RailSponsor | undefined) ?? null;

  const { newer, older } = neighbours(recent.map((item) => item.date), date);
  const url = editionUrl(date);
  const toc = tocGroups(edition.stories);
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
    <div className={`hp ${HOME_FONT_VARS} min-h-screen`}>
      <style>{HOME_CSS}</style>
      <style>{BRIEF_CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
      <PublicHeader subscribeHref="#subscribe" />
      <BriefStrip />

      <main>
        <div className="br-layout">
          {/* Desktop only: the sticky contents column, left of the reading column. */}
          <aside className="br-toc-col">
            <EditionToc groups={toc} />
          </aside>
          <article className="br-edition">
            <p className="hp-kicker"><Mail size={17} strokeWidth={2} aria-hidden="true" /> Daily Brief</p>
            <h1 className="hp-h1">{edition.stories.length} big things in tech</h1>
            <p className="br-meta">
              <time dateTime={date}>{formatEditionDate(date)}</time>
              {' · '}
              <Link href="/brief">All editions</Link>
            </p>
            <div className="br-share">
              <ShareBar url={url} text={shareText} />
            </div>
            <EditionJump groups={toc} />

            {/* One reading column; one kicker per topic run. */}
            <ol className="br-stories">
              {edition.stories.map((story, index) => (
                <li key={story.url} id={`story-${index + 1}`} data-story={index + 1}>
                  <BriefStory story={story} kicker={kickerFor(edition.stories, index)} lead={index === 0} eager={index < 2} />
                </li>
              ))}
            </ol>
          </article>
          {/* Wide screens only: the sponsor, then the subscribe card, sticky like the contents column. */}
          <aside className="br-rail-col" aria-label="Sponsor and subscribe">
            <div className="br-rail">
              {sponsor && <RailSponsorCard sponsor={sponsor} editionDate={date} />}
              <RailSubscribeCard />
            </div>
          </aside>
        </div>

        <section className="br-join" aria-labelledby="join-title">
          <div className="hp-join-box">
            <div className="hp-join-top">
              <div>
                <h2 className="hp-join-title" id="join-title">Get this in your inbox every morning</h2>
                <p className="hp-join-sub">The stories that mattered in tech and AI, grouped and summed up. Free, no account needed.</p>
                <p className="br-join-more">
                  Want only AI and robotics, or five stories instead of ten?{' '}
                  <Link href="/brief/customize">Build your own brief</Link>.
                </p>
              </div>
              <LandingHeroSignup placement="box" source="daily_page" />
            </div>
          </div>
        </section>

        <nav className="br-nav" aria-label="Other editions">
          {older ? (
            <Link href={`/brief/${older}`} className="hp-btn hp-btn-line">← {formatEditionDate(older, 'short')}</Link>
          ) : <span />}
          <Link href="/brief" className="hp-btn hp-btn-line">All editions</Link>
          {newer ? (
            <Link href={`/brief/${newer}`} className="hp-btn hp-btn-line">{formatEditionDate(newer, 'short')} →</Link>
          ) : <span />}
        </nav>
      </main>

      <Footer variant="landing" />
    </div>
  );
}
