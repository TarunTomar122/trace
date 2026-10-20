import Link from 'next/link';
import LandingCtaLink from '@/app/LandingCtaLink';
import LandingDiscoveryLink from '@/app/LandingDiscoveryLink';
import Footer from '@/components/Footer';
import { BUY_ME_A_COFFEE_URL, GITHUB_REPO_URL } from '@/lib/site-links';
import LandingWhatYouGet from '@/components/feed-v2/LandingWhatYouGet';
import LandingHeroSignup from '@/components/feed-v2/LandingHeroSignup';
import { LANDING_CSS } from '@/lib/landing-css';
import { LANDING_DEMO_STORIES } from '@/lib/landing-demo-stories';
import { formatEditionDate, isFreshEdition, type DailyEdition } from '@/lib/daily-editions';
import { laneKicker } from '@/lib/newsletter-prefs';
import LandingBuilderDemo from '@/components/feed-v2/LandingBuilderDemo';
import { Code2, Coffee, Layers, Mail, Radar, Sparkles, Star, Unlock } from 'lucide-react';
import { faviconUrl } from '@/lib/topic-icons';

const ANDROID_URL = 'https://play.google.com/store/apps/details?id=online.yourtrace.app';
const CHROME_URL = 'https://chromewebstore.google.com/detail/trace-ai-tech-news-in-eve/cblkklekbejbbpcaihfogdmaoofmikbk';

// Outlets the pipeline actually reads (backend/v3/config/*_sources.json, Pulse).
const SOURCES = [
  { name: 'TechCrunch', domain: 'techcrunch.com' },
  { name: 'The Verge', domain: 'theverge.com' },
  { name: 'Bloomberg', domain: 'bloomberg.com' },
  { name: 'Ars Technica', domain: 'arstechnica.com' },
  { name: 'Wired', domain: 'wired.com' },
  { name: 'MIT Tech Review', domain: 'technologyreview.com' },
  { name: 'Hacker News', domain: 'news.ycombinator.com' },
  { name: 'Product Hunt', domain: 'producthunt.com' },
  { name: 'Hugging Face', domain: 'huggingface.co' },
  { name: 'GitHub', domain: 'github.com' },
];

const HOW_IT_WORKS = [
  { title: 'Scan', body: 'Over a hundred sources, every morning.', Icon: Radar },
  { title: 'Group and rank', body: 'Same story, one card, every source attached.', Icon: Layers },
  { title: 'Read', body: 'Five minutes, by email or in the feed.', Icon: Mail },
];

// The "group" step, drawn: five outlets' coverage folding into one story.
const GROUP_DEMO = ['techcrunch.com', 'theverge.com', 'bloomberg.com', 'wired.com', 'arstechnica.com'];

const SAMPLE_COUNT = 3;

export const LANDING_FAQ = [
  {
    q: 'Is Trace really free?',
    a: 'Yes. Trace is free for everyone and open source. Every story, Pulse, the full archive, bookmarks, and agent access are included. There are no tiers and nothing to upgrade to.',
  },
  {
    q: 'What do I get in the morning email?',
    a: 'Ten stories by default, each with a short summary and links to the original reporting. You can change that: pick your topics, choose 5, 10, or 15 stories, and read them as summaries, headlines only, or with images. A live preview shows what your email will look like.',
  },
  {
    q: 'Where does Trace get its news?',
    a: 'Trace scans over a hundred sources each morning: established tech publications, company announcements, research teams, Hacker News, Reddit, Product Hunt, GitHub, and X. When several outlets cover the same event, the story shows every source, so you can verify anything in one tap.',
  },
  {
    q: 'How is this different from a news aggregator?',
    a: 'Aggregators hand you a firehose and make ranking your job. Trace groups the coverage of each event into one story, ranks the stories, and summarises them. You open it, read it, and are caught up in about five minutes.',
  },
  {
    q: 'Can I read past editions?',
    a: 'Yes. Every daily edition is saved in a public archive at /brief, and each edition has its own link at /brief/YYYY-MM-DD that you can share.',
  },
  {
    q: 'What is Pulse?',
    a: 'Pulse is the builders’ radar next to your feed: markets, trending GitHub repos with star counts, and Top articles: the best links from Hacker News, Lobsters and design. It is included for everyone.',
  },
  {
    q: 'Is there an app?',
    a: 'Trace is web-first, with a Chrome extension that puts the ranked feed in every new tab and an Android app on Google Play. The daily email is the easiest way to start.',
  },
  {
    q: 'Does Trace work with Claude, Cursor, OpenClaw or Hermes?',
    a: 'Yes. Agent Access is read-only MCP access included for everyone, so Claude, Codex, Cursor, OpenClaw, or Hermes can pull the same ranked feed you read. The agent can never post, delete, or change anything.',
  },
];

type SampleStory = { id: string; url: string; domains: string[]; title: string; why: string; tag: string; sourceCount: number; source: string; image: string };

/** Today's real brief when it is published; the demo stories otherwise. */
export default function LandingScreen({ edition = null }: { edition?: DailyEdition | null }) {
  const sample: SampleStory[] = edition
    ? edition.stories.slice(0, SAMPLE_COUNT).map((story) => ({
      id: story.url,
      url: story.url,
      domains: story.sources,
      title: story.title,
      why: story.summary,
      tag: laneKicker(story.lane),
      sourceCount: story.source_count,
      source: story.source_name,
      image: story.image,
    }))
    : LANDING_DEMO_STORIES.slice(0, SAMPLE_COUNT).map((story) => ({
      id: story.id,
      url: '',
      domains: story.sources,
      title: story.title,
      why: story.why,
      tag: `Top in ${story.tag}`,
      sourceCount: story.sources.length,
      source: story.sourceName,
      image: story.image,
    }));
  const moreCount = (edition ? edition.stories.length : 10) - sample.length;
  const fresh = edition ? isFreshEdition(edition.date) : false;
  const sampleHeading = !edition ? 'A morning brief, for example' : fresh ? 'Today’s brief' : 'The latest brief';
  return (
    <main className="lp">
      <style>{LANDING_CSS}</style>

      <header className="nav">
        <div className="nav-in">
          <Link href="/" className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/trace.webp" alt="Trace" className="brand-logo" />
            <span className="wordmark">Trace</span>
          </Link>
          <nav className="nav-links" aria-label="Main">
            <Link href="/brief" className="nav-hide-sm">Daily brief</Link>
            <Link href="/how-it-works" className="nav-hide-sm">How it works</Link>
            <Link href="/blog" className="nav-hide-sm">Blog</Link>
            <LandingCtaLink href="/feed?utm_source=site&utm_medium=nav" location="nav">Feed</LandingCtaLink>
            {GITHUB_REPO_URL && (
              <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="nav-gh" aria-label="Trace on GitHub">
                <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
            )}
          </nav>
        </div>
      </header>

      <section className="hero">
        <h1 className="hero-title">Fastest way to catch&nbsp;up with Tech &amp;&nbsp;AI</h1>
        <p className="hero-sub">Trace reads 100+ sources, groups the stories everyone is covering and sums each one up. In your inbox every morning.</p>
        <LandingHeroSignup />
        <p className="hero-links">
          <Link href="/brief" className="text-link">Read today&rsquo;s brief</Link>
          <LandingCtaLink href="/feed?utm_source=site&utm_medium=hero" location="hero" className="text-link">Open the feed</LandingCtaLink>
        </p>

        <div className="proof">
          <p className="proof-label">Reading over a hundred sources, including</p>
          <ul className="logos">
            {SOURCES.map((source) => (
              <li key={source.domain}>
                {/* eslint-disable-next-line @next/next/no-img-element -- publisher favicons */}
                <img src={faviconUrl(source.domain)} alt="" width={20} height={20} loading="lazy" />
                {source.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" id="sample" style={{ paddingTop: 'var(--s5)' }} aria-labelledby="sample-title">
        <div className="sec-head">
          <h2 className="h2" id="sample-title">{sampleHeading}</h2>
          {edition && <p className="sec-date"><time dateTime={edition.date}>{formatEditionDate(edition.date)}</time></p>}
        </div>
        {/* The feed's own card: kicker, full-bleed image, heavy headline. */}
        <div className="fcol">
          {sample.map((story, i) => (
            <article key={story.id} className="fcard">
              {/* One kicker per topic run, never the same label twice in a row. */}
              {(i < 2 || story.tag !== sample[i - 1].tag) && (
                <p className="fkicker"><Star size={12} fill="currentColor" aria-hidden="true" /> {i === 0 ? 'Story of the day' : story.tag}</p>
              )}
              {story.image && (
                <a href={story.url || undefined} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- publisher thumbnails */}
                  <img src={story.image} alt="" className="fimg" referrerPolicy="no-referrer" loading={i === 0 ? 'eager' : 'lazy'} />
                </a>
              )}
              <div className="fbody">
                <h3 className="ftitle">
                  {story.url ? <a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}</a> : story.title}
                </h3>
                <p className="fmeta">
                  <span className="fav-stack" aria-hidden="true">
                    {story.domains.slice(0, 4).map((domain) => (
                      // eslint-disable-next-line @next/next/no-img-element -- publisher favicons
                      <img key={domain} src={faviconUrl(domain)} alt="" width={16} height={16} loading="lazy" />
                    ))}
                  </span>
                  <span>{story.source}</span>
                  {story.sourceCount > 1 && <span>· {story.sourceCount} sources</span>}
                </p>
              </div>
            </article>
          ))}
          <div className="ffoot">
            <span>{moreCount > 0 ? `+ ${moreCount} more in today’s edition` : 'Every morning'}</span>
            <Link href={edition ? `/brief/${edition.date}` : '/brief'} className="fbtn">Read the full edition</Link>
          </div>
        </div>
      </section>

      <div className="band">
        <section className="section" id="how" aria-labelledby="how-title">
          <div className="sec-head">
            <h2 className="h2" id="how-title">How it works</h2>
          </div>
          <ol className="steps">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="step">
                <span className="step-icon" aria-hidden="true"><step.Icon size={22} strokeWidth={2.2} /></span>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-body">{step.body}</p>
                {i === 0 && (
                  <div className="step-viz" aria-hidden="true">
                    <span className="viz-stack">
                      {SOURCES.slice(5, 10).map((source) => (
                        // eslint-disable-next-line @next/next/no-img-element -- publisher favicons
                        <img key={source.domain} src={faviconUrl(source.domain)} alt="" width={28} height={28} loading="lazy" />
                      ))}
                    </span>
                    <span className="viz-more">+100 more</span>
                  </div>
                )}
                {i === 2 && (
                  <div className="step-viz" aria-hidden="true">
                    <span className="viz-mail">
                      <Mail size={15} strokeWidth={2.4} />
                      <span><b>Trace</b> · 10 big things today</span>
                      <em>8:00</em>
                    </span>
                  </div>
                )}
                {i === 1 && (
                  <div className="step-viz" aria-hidden="true">
                    <span className="viz-stack">
                      {GROUP_DEMO.map((domain) => (
                        // eslint-disable-next-line @next/next/no-img-element -- publisher favicons
                        <img key={domain} src={faviconUrl(domain)} alt="" width={28} height={28} loading="lazy" />
                      ))}
                    </span>
                    <span className="viz-arrow">→</span>
                    <span className="viz-card">1 story · 5 sources</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="section" id="make-it-yours" aria-labelledby="mine-title">
        <div className="sec-head">
          <h2 className="h2" id="mine-title">Make it yours</h2>
          <p className="lede">Try it. The preview is today&rsquo;s email, built from your picks.</p>
        </div>
        <LandingBuilderDemo fallback={sample} />
      </section>

      <LandingWhatYouGet stories={edition?.stories ?? []} />

      <div className="band">
        <section className="section trust" id="open-source" aria-labelledby="trust-title">
          <span className="trust-icon" aria-hidden="true"><Unlock size={26} strokeWidth={2.2} /></span>
          <h2 className="h2" id="trust-title">Free for everyone. Open source.</h2>
          <p className="lede">No paywall, no tiers.{GITHUB_REPO_URL ? ' Read every line of code.' : ''}</p>
          <ul className="trust-points">
            <li><Sparkles size={16} strokeWidth={2.3} aria-hidden="true" /> Every feature unlocked</li>
            <li><Mail size={16} strokeWidth={2.3} aria-hidden="true" /> Your own daily brief</li>
            <li><Code2 size={16} strokeWidth={2.3} aria-hidden="true" /> Open source code</li>
          </ul>
          <div className="btn-row trust-actions">
            {GITHUB_REPO_URL && (
              <LandingDiscoveryLink href={GITHUB_REPO_URL} slug="open-source" className="btn-ghost">View the source on GitHub</LandingDiscoveryLink>
            )}
            <LandingCtaLink href="/feed?utm_source=site&utm_medium=open_source" location="open_source" className="btn-primary">Open the feed</LandingCtaLink>
          </div>
        </section>
      </div>

      <section className="section" aria-labelledby="founder-title">
        <div className="founder">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tarat-avatar.jpg" alt="Tarat" className="founder-avatar" />
          <div>
            <h2 className="founder-title" id="founder-title">Hey, I am Tarat.</h2>
            <p className="founder-p">
              Trace is the first solo indie app I have built and launched. I put it out at the end of January 2026,
              and it got so much traction on Product Hunt that I decided to keep going.
            </p>
            <p className="founder-p">
              Eight months in, the app has changed a lot. I read every bit of feedback I can get and genuinely love
              working on it, making Trace more useful, clearer, and more worth opening for the people who use it.
            </p>
            <p className="founder-p">
              On the personal side, I&rsquo;ve just started my master&rsquo;s in AI at the University of Edinburgh.
              Trace is now free and open source, so sharing it with a friend is the best way to help me keep building
              while I figure out student life.
            </p>
            <p className="founder-p">
              If you&rsquo;re into investing or the US stock market, I also make{' '}
              <a href="https://stocksbrew.online" target="_blank" rel="noreferrer" className="flink">StocksBrew</a>. You can find more
              about me and the other things I&rsquo;m building at{' '}
              <a href="https://www.tarat.space" target="_blank" rel="noreferrer" className="flink">tarat.space</a>.
            </p>
            <p className="founder-sign">Tarat</p>
            <a href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noopener noreferrer" className="bmc-btn">
              <Coffee size={18} strokeWidth={2.3} aria-hidden="true" /> Buy me a coffee
            </a>
            <p className="bmc-note">Trace is free. If it saves you time, a coffee keeps it running.</p>
          </div>
        </div>
      </section>

      <section className="section" id="faq" style={{ paddingTop: 0 }} aria-labelledby="faq-title">
        <div className="sec-head">
          <h2 className="h2" id="faq-title">FAQ</h2>
        </div>
        <div className="faq">
          {LANDING_FAQ.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="final-wrap">
        <section className="final-cta on-dark" aria-labelledby="final-title">
          <h2 className="h2" id="final-title">Be the one who already knows.</h2>
          <LandingHeroSignup />
          <p className="final-apps">
            <span>Also on</span>
            <a href={CHROME_URL} target="_blank" rel="noreferrer">Chrome</a>
            <a href={ANDROID_URL} target="_blank" rel="noreferrer">Android</a>
            <Link href="/feed?utm_source=site&utm_medium=final">the web feed</Link>
          </p>
        </section>
      </div>

      <Footer variant="landing" />
    </main>
  );
}
