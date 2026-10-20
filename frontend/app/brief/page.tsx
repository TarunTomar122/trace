import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import BriefStrip from './BriefStrip';
import { HOME_CSS } from '@/lib/home-css';
import { BRIEF_CSS } from '@/lib/brief-css';
import { HOME_FONT_VARS } from '@/lib/home-fonts';
import { bodyParagraphs } from '@/lib/body-text';
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

/** Summaries mark key names with **…**; the preview shows plain text. */
function plain(text: string): string {
  return text.split('**').join('');
}

export default async function DailyArchivePage() {
  const editions = await listDailyEditions(90);
  const [latest, ...past] = editions;
  const lead = latest?.stories[0];
  const leadSummary = lead ? plain(bodyParagraphs(lead.summary)[0] ?? '') : '';

  return (
    <div className={`hp ${HOME_FONT_VARS} min-h-screen`}>
      <style>{HOME_CSS}</style>
      <style>{BRIEF_CSS}</style>
      <PublicHeader subscribeHref="#subscribe" />
      <BriefStrip />

      <main>
        <section className="br-hero">
          <h1 className="hp-h1">The Daily Brief</h1>
          <p>
            The tech and AI stories that mattered, grouped and summed up every morning.{' '}
            <Link href="/brief/customize" className="br-link">Make it yours</Link>
          </p>
        </section>

        {!latest || !lead ? (
          <p className="br-empty">The first edition is on its way. Check back tomorrow morning.</p>
        ) : (
          <>
            <div className="br-wrap">
              <article className="br-latest" aria-labelledby="latest-title">
                <div>
                  <p className="hp-kicker">
                    <Mail size={17} strokeWidth={2} aria-hidden="true" />
                    {/* Not "Today's": the newest edition is yesterday's until each morning's send. */}
                    Latest edition
                  </p>
                  <h2 className="hp-h3" id="latest-title">
                    <Link href={`/brief/${latest.date}`}>{latest.stories.length} big things in tech</Link>
                  </h2>
                  <p className="br-date"><time dateTime={latest.date}>{formatEditionDate(latest.date)}</time></p>
                  <ol className="br-list">
                    {latest.stories.slice(0, 4).map((story) => (
                      <li key={story.url}>
                        <Link href={`/brief/${latest.date}`}>{story.title}</Link>
                      </li>
                    ))}
                  </ol>
                  <div className="hp-btns">
                    <Link href={`/brief/${latest.date}`} className="hp-btn hp-btn-dark">Read all {latest.stories.length}</Link>
                    <Link href="/brief/customize" className="hp-btn hp-btn-line">Make it yours</Link>
                  </div>
                </div>

                {/* The edition as the email shows it: header card over the story of the day. */}
                <Link href={`/brief/${latest.date}`} className="br-panel-link" tabIndex={-1} aria-hidden="true">
                  <div className="hp-panel hp-panel-yellow">
                    <div className="hp-mail-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/trace.webp" alt="" className="hp-mail-logo" />
                      <div>
                        <p className="hp-mail-name">Trace Daily Brief</p>
                        <p className="hp-mail-promise">
                          {formatEditionDate(latest.date)} <i>·</i> {latest.stories.length} stories
                        </p>
                      </div>
                    </div>
                    <div className="hp-mail-paper">
                      <p className="hp-mail-mark"><span>Story of the day</span></p>
                      {lead.image && (
                        // eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails
                        <img src={lead.image} alt="" referrerPolicy="no-referrer" className="br-panel-img" />
                      )}
                      <p className="hp-mail-title">{lead.title}</p>
                      {leadSummary && <p className="hp-mail-sum">{leadSummary}</p>}
                    </div>
                  </div>
                </Link>
              </article>
            </div>

            {past.length > 0 && (
              <section className="br-past" aria-labelledby="past-title">
                <h2 className="hp-h2" id="past-title">Past editions</h2>
                <ul className="br-past-list">
                  {past.map((edition) => {
                    const top = edition.stories[0];
                    return (
                      <li key={edition.date}>
                        <Link href={`/brief/${edition.date}`} className={`br-past-link${top?.image ? '' : ' no-img'}`}>
                          <div className="min-w-0">
                            <p className="br-past-date"><time dateTime={edition.date}>{formatEditionDate(edition.date)}</time></p>
                            <p className="br-past-title br-story-serif">{top?.title}</p>
                            {edition.stories.length > 1 && <p className="br-past-more">+ {edition.stories.length - 1} more</p>}
                          </div>
                          {top?.image && (
                            // eslint-disable-next-line @next/next/no-img-element -- remote publisher thumbnails
                            <img src={top.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="br-past-img" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
        <div className="h-24" aria-hidden="true" />
      </main>

      <Footer variant="landing" />
    </div>
  );
}
