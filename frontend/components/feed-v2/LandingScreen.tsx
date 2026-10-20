import Link from 'next/link';
import LandingCtaLink from '@/app/LandingCtaLink';
import Footer from '@/components/Footer';
import PublicHeader from '@/components/PublicHeader';
import { BUY_ME_A_COFFEE_URL } from '@/lib/site-links';
import LandingHeroSignup from '@/components/feed-v2/LandingHeroSignup';
import SubscribeNowLink from '@/components/feed-v2/SubscribeNowLink';
import HpJoinBox, { SourceFaces } from '@/components/HpJoinBox';
import { HOME_FONT_VARS } from '@/lib/home-fonts';
import { FeedDemo, NewTabDemo, DiscordDemo } from '@/components/feed-v2/landing-demos';
import { AgentArt, BriefArt, FeedArt, HandArrow, TabArt } from '@/components/feed-v2/home-art';
import { LANDING_CSS } from '@/lib/landing-css';
import { HOME_CSS } from '@/lib/home-css';
import { LANDING_DEMO_STORIES, type LandingDemoStory } from '@/lib/landing-demo-stories';
import { isFreshEdition, type DailyEdition, type DailyStory } from '@/lib/daily-editions';
import { topicLabel } from '@/lib/newsletter-prefs';
import {
  AppWindow, ArrowRight, Bot, Compass, Cpu, ExternalLink, Mail, MessagesSquare, PenTool, Rocket, Sparkles, TrendingUp,
} from 'lucide-react';

const CHROME_URL = 'https://chromewebstore.google.com/detail/trace-ai-tech-news-in-eve/cblkklekbejbbpcaihfogdmaoofmikbk?utm_source=yourtrace&utm_medium=homepage';


const CARDS = [
  { id: 'brief', title: 'Daily Brief', text: '5-minute brief, grouped from 100+ sources', href: '/brief', Art: BriefArt },
  { id: 'feed', title: 'The Feed', text: 'Every story ranked, every source attached', href: '/feed?utm_source=site&utm_medium=card', Art: FeedArt },
  { id: 'tab', title: 'New Tab', text: 'Today’s stories in every Chrome tab', href: CHROME_URL, Art: TabArt },
  { id: 'agents', title: 'AI Agents', text: 'Ask Claude or Cursor about today’s news', href: '/agents', Art: AgentArt },
] as const;

const HOW = [
  { title: 'Scan', body: 'We read over a hundred tech sources every morning.' },
  { title: 'Group', body: 'We fold every outlet’s take on a story into one.' },
  { title: 'Summarise', body: 'We sum each one up in a few lines, sources attached.' },
];

const TOPICS = [
  { tab: 'ai', label: 'AI', Icon: Sparkles },
  { tab: 'startups', label: 'Startups', Icon: Rocket },
  { tab: 'markets', label: 'Markets', Icon: TrendingUp },
  { tab: 'tech', label: 'Tech', Icon: Cpu },
  { tab: 'ux-design', label: 'Design', Icon: PenTool },
  { tab: 'conversations', label: 'Top articles', Icon: MessagesSquare },
];

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

/**
 * Today's real stories for the product mockups, multi-source ones first (the
 * mockups show "N sources"); the samples if too few have images.
 */
function demoStories(stories: DailyStory[]): LandingDemoStory[] {
  const withImages = stories.filter((story) => story.image);
  const real = [...withImages.filter((story) => story.source_count > 1), ...withImages.filter((story) => story.source_count <= 1)]
    .map((story) => ({
      id: story.url,
      title: story.title,
      tag: topicLabel(story.lane),
      why: story.summary,
      sources: story.sources.length ? story.sources : [story.source_name],
      sourceName: story.source_name,
      image: story.image,
      mark: '',
      coverage: [],
    }));
  return real.length >= 4 ? real.slice(0, 6) : LANDING_DEMO_STORIES;
}

/** The Daily Brief panel: the email's header card over today's top stories. */
function BriefPreview({ stories }: { stories: { title: string; summary: string }[] }) {
  return (
    <div className="hp-mail" aria-hidden="true">
      <div className="hp-mail-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trace.webp" alt="" className="hp-mail-logo" />
        <div>
          <p className="hp-mail-name">Trace Daily Brief</p>
          <p className="hp-mail-promise">100% free <i>·</i> Every morning <i>·</i> Unsubscribe anytime</p>
        </div>
      </div>
      <div className="hp-mail-paper">
        <p className="hp-mail-mark"><span>Story of the day</span></p>
        {stories.map((story) => (
          <div key={story.title} className="hp-mail-story">
            <p className="hp-mail-title">{story.title}</p>
            <p className="hp-mail-sum">{story.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Today's real brief when it is published; the demo stories otherwise. */
export default function LandingScreen({ edition = null }: { edition?: DailyEdition | null }) {
  const demo = demoStories(edition?.stories ?? []);
  const briefStories = edition?.stories.length
    ? edition.stories.slice(0, 2).map((story) => ({ title: story.title, summary: story.summary }))
    : LANDING_DEMO_STORIES.slice(0, 2).map((story) => ({ title: story.title, summary: story.why }));
  const briefHref = edition ? `/brief/${edition.date}` : '/brief';
  const briefLabel = edition && !isFreshEdition(edition.date) ? 'Read the latest brief' : 'Read today’s brief';

  return (
    <div className={`lp hp ${HOME_FONT_VARS}`}>
      <style>{LANDING_CSS}</style>
      <style>{HOME_CSS}</style>

      <PublicHeader subscribeHref="#subscribe" />

      <main>

      <section className="hp-strip" id="subscribe" aria-label="Subscribe">
        <div className="hp-strip-in">
          <div>
            <p className="hp-strip-title">Subscribe to the Trace Daily Brief</p>
            <p className="hp-strip-sub">
              The most important tech and AI stories of the day, summed up. <em>100% free, unsubscribe anytime.</em>{' '}
              <a href="/terms">Terms</a> &amp; <a href="/privacy-policy">Privacy</a>.
            </p>
          </div>
          <LandingHeroSignup placement="strip" inputId="subscribe-email" />
        </div>
      </section>

      <div className="hp-top">
        <section className="hp-hero">
          <h1 className="hp-h1">Fastest way to catch&nbsp;up on tech &amp;&nbsp;AI news</h1>
          <p className="hp-hero-p">
            From a 5-minute morning email to every new tab, Trace is designed to give you{' '}
            <strong>the tech and AI stories that matter, grouped and summed up</strong>, without the noise.
          </p>
        </section>

        <ul className="hp-cards">
          {CARDS.map(({ id, title, text, href, Art }) => {
            const body = (
              <>
                <span className="hp-card-title">{title}</span>
                <Art />
                <span className="hp-card-text">{text}</span>
              </>
            );
            return (
              <li key={id} className={`hp-card hp-card-${id}`}>
                {id === 'feed' ? (
                  <LandingCtaLink href={href} location="card" className="hp-card-link">{body}</LandingCtaLink>
                ) : href.startsWith('http') ? (
                  <a href={href} target="_blank" rel="noreferrer" className="hp-card-link">
                    {body}<span className="sr-only"> (Chrome Web Store, opens in a new tab)</span>
                  </a>
                ) : (
                  <Link href={href} className="hp-card-link">{body}</Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <section className="hp-how-wrap" aria-labelledby="how-title">
        <div className="hp-how">
          <h2 className="hp-hand" id="how-title">How we <br />do it</h2>
          <HandArrow variant="in" />
          <ol className="hp-how-steps">
            {HOW.map((step) => (
              <li key={step.title}>
                <h3 className="hp-how-title">{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <HandArrow variant="down" />
        </div>
      </section>

      <section className="hp-explore" aria-labelledby="explore-title">
        <div className="hp-explore-head">
          <h2 className="hp-h2" id="explore-title">Read what you want, how you want</h2>
          <p>Read it in your inbox, scroll it in the feed, catch it in every new tab, or ask your AI about it.</p>
        </div>

        <article className="hp-row">
          <div className="hp-row-copy">
            <p className="hp-kicker"><Mail size={17} strokeWidth={2} aria-hidden="true" /> Daily Brief</p>
            <h3 className="hp-h3">Stay informed with the Daily Brief</h3>
            <p>The most important tech and AI stories of the day in a 5-minute brief, grouped, summed up and sent every morning.</p>
            <p className="hp-stat"><SourceFaces /><span><b>100+</b> sources read every morning</span></p>
            <div className="hp-btns">
              <SubscribeNowLink className="hp-btn hp-btn-dark">Subscribe now</SubscribeNowLink>
              <Link href={briefHref} className="hp-btn hp-btn-line">{briefLabel}</Link>
            </div>
          </div>
          <div className="hp-panel hp-panel-yellow">
            <BriefPreview stories={briefStories} />
          </div>
        </article>

        <article className="hp-row hp-row-flip">
          <div className="hp-row-copy">
            <p className="hp-kicker"><Compass size={17} strokeWidth={2} aria-hidden="true" /> Topics</p>
            <h3 className="hp-h3">Follow the topics you care about</h3>
            <p>Open the feed on just what you follow: AI, startups, markets, tech, design, or the day’s best articles.</p>
            <ul className="hp-topics">
              {TOPICS.map(({ tab, label, Icon }) => (
                <li key={tab}>
                  <Link href={`/feed?tab=${tab}&utm_source=site&utm_medium=landing_topics`}>
                    <span><Icon size={19} strokeWidth={1.9} aria-hidden="true" /> {label}</span>
                    <ArrowRight size={20} strokeWidth={2} aria-hidden="true" className="hp-topic-arrow" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/brief/customize" className="hp-more">Pick topics for your email too</Link>
          </div>
          <div className="hp-panel hp-panel-cyan">
            <FeedDemo stories={demo} />
          </div>
        </article>

        <article className="hp-row">
          <div className="hp-row-copy">
            <p className="hp-kicker"><AppWindow size={17} strokeWidth={2} aria-hidden="true" /> New Tab</p>
            <h3 className="hp-h3">Catch up every time you open a tab</h3>
            <p>The Chrome extension puts today’s ranked stories in every new tab, so you are caught up before you start typing.</p>
            <p className="hp-stat"><span><b>Free</b> on the Chrome Web Store</span></p>
            <div className="hp-btns">
              <a href={CHROME_URL} target="_blank" rel="noreferrer" className="hp-btn hp-btn-dark">
                Add to Chrome <ExternalLink size={16} strokeWidth={2.2} aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>
          <div className="hp-panel hp-panel-magenta">
            <NewTabDemo stories={demo} />
          </div>
        </article>

        <article className="hp-row hp-row-flip" id="agents">
          <div className="hp-row-copy">
            <p className="hp-kicker"><Bot size={17} strokeWidth={2} aria-hidden="true" /> AI Agents</p>
            <h3 className="hp-h3">Ask your AI what happened today</h3>
            <p>Claude, Cursor and other MCP clients can read the same ranked feed and answer questions about today’s news. Read-only, and free for everyone.</p>
            <div className="hp-btns">
              <Link href="/agents" className="hp-btn hp-btn-dark">Set up your agent</Link>
              <LandingCtaLink href="/feed?utm_source=site&utm_medium=agents" location="agents" className="hp-btn hp-btn-line">Open the feed</LandingCtaLink>
            </div>
          </div>
          <div className="hp-panel hp-panel-green">
            <DiscordDemo stories={demo} />
          </div>
        </article>
      </section>

      <section className="hp-faq" id="faq" aria-labelledby="faq-title">
        <h2 className="hp-h2" id="faq-title">Questions, answered</h2>
        <div className="hp-faq-list">
          {LANDING_FAQ.map((item) => (
            <details key={item.q} className="hp-faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <HpJoinBox heading={<>Join the curious people who catch&nbsp;up with Trace every morning</>} source="landing">
          <figure className="hp-quote">
            <blockquote>
              Trace is the first solo indie app I have built and launched. I read every bit of feedback I can get and
              genuinely love working on it, making Trace <mark>more useful, clearer, and more worth opening</mark> for
              the people who use it.
            </blockquote>
            <figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/tarat-avatar.jpg" alt="" className="hp-quote-avatar" />
              <span><cite>Tarat</cite>, who builds Trace</span>
            </figcaption>
            <a href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noopener noreferrer" className="hp-coffee">
              Trace is free. If it saves you time, buy me a coffee
            </a>
          </figure>
      </HpJoinBox>
      </main>

      <Footer variant="landing" />
    </div>
  );
}
