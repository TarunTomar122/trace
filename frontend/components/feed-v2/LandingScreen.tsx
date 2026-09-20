import Link from 'next/link';
import LandingCtaLink from '@/app/LandingCtaLink';
import LandingDiscoveryLink from '@/app/LandingDiscoveryLink';
import Footer from '@/components/Footer';
import { SUBSCRIPTION_PRICE_DEFAULT, priceAmountDisplay, shortPriceDisplay } from '@/lib/subscription-pricing';
import LandingWhatYouGet from '@/components/feed-v2/LandingWhatYouGet';
import LandingHeroSignup from '@/components/feed-v2/LandingHeroSignup';
import { LANDING_CSS } from '@/lib/landing-css';

const ANDROID_URL = 'https://play.google.com/store/apps/details?id=online.yourtrace.app';
const CHROME_URL = 'https://chromewebstore.google.com/detail/trace-ai-tech-news-in-eve/cblkklekbejbbpcaihfogdmaoofmikbk';

const SOURCES = [
  { name: 'TechCrunch', src: 'https://cdn.simpleicons.org/techcrunch/00B289' },
  { name: 'Hacker News', src: 'https://cdn.simpleicons.org/ycombinator/FF6600' },
  { name: 'Reddit', src: 'https://cdn.simpleicons.org/reddit/FF4500' },
  { name: 'Product Hunt', src: 'https://cdn.simpleicons.org/producthunt/DA552F' },
  { name: 'X', src: 'https://cdn.simpleicons.org/x/181815' },
  { name: 'YouTube', src: 'https://cdn.simpleicons.org/youtube/FF0000' },
  { name: 'Bluesky', src: 'https://cdn.simpleicons.org/bluesky/1185FE' },
  { name: 'Substack', src: 'https://cdn.simpleicons.org/substack/FF6719' },
  { name: 'DEV Community', src: 'https://cdn.simpleicons.org/devdotto/181815' },
];

const HERO_TILES = [
  { name: 'Hacker News', style: { top: '10%', left: '4%' }, size: 56 },
  { name: 'X', style: { top: '40%', left: '8%' }, size: 44 },
  { name: 'YouTube', style: { top: '64%', left: '5%' }, size: 56 },
  { name: 'Product Hunt', style: { top: '86%', left: '13%' }, size: 44 },
  { name: 'TechCrunch', style: { top: '12%', right: '5%' }, size: 48 },
  { name: 'DEV Community', style: { top: '42%', right: '9%' }, size: 44 },
  { name: 'Bluesky', style: { top: '66%', right: '5%' }, size: 56 },
  { name: 'Substack', style: { top: '88%', right: '12%' }, size: 48 },
];

const HOW_IT_WORKS = [
  {
    title: 'Find the signal',
    body: 'We collect reporting about model releases, company changes, layoffs, security, policy, and the trends shaping technology.',
  },
  {
    title: 'Group the noise',
    body: 'When several publications report the same event, Trace puts that coverage into one story and keeps the original links attached.',
  },
  {
    title: 'Make it yours',
    body: 'Pick the topics you care about and your For You feed re-orders around them. Every morning, ranked for you.',
  },
];

const FREE_FEATURES = [
  'A personalized AI and tech news feed',
  'Unlimited original source links',
  'Topic filters and For you ranking',
  'Bookmarks with a free Trace account',
  'Daily email brief (opt-in)',
];

const PRO_FEATURES = [
  'Unlimited AI summaries in the web feed',
  '10 big things in tech and AI, in your inbox every morning',
  'Search your complete saved archive',
  'The complete daily news archive',
  'Full personalized Pulse',
  'Read-only Agent Access',
];

export const LANDING_FAQ = [
  {
    q: 'Is Trace free?',
    a: `Yes. Guests get 3 stories a day; a free account gets 5, plus the daily email brief if you want it. Pro (${shortPriceDisplay(SUBSCRIPTION_PRICE_DEFAULT)}) unlocks the whole day: every brief, full Pulse, and the archive.`,
  },
  {
    q: 'What counts as one AI summary?',
    a: 'Opening a new story brief counts once. You can reopen the same brief as often as you like without using another read, and original publisher links are always unlimited. The counter resets every morning with the new edition.',
  },
  {
    q: 'Where does Trace get its news?',
    a: 'Trace reads 400+ sources overnight: established tech publications, company announcements, research teams, Hacker News, Reddit, Product Hunt, GitHub, and X. When several outlets cover the same event, the card shows every source, so you can verify anything in one tap.',
  },
  {
    q: 'How is this different from a news aggregator?',
    a: 'Aggregators hand you a firehose and make ranking your job. Trace hands you the stories that mattered, grouped across outlets, summarized with key points, and ranked around your topics. You open it, you read it, you are caught up in under 10 minutes.',
  },
  {
    q: 'How does personalization work?',
    a: 'Pick your interests in your profile and your For You feed re-orders around them right away — they only change ordering, nothing else. Same transparent ranking, weighted to your topics. No engagement bait, no outrage optimization.',
  },
  {
    q: 'What is Pulse?',
    a: 'Pulse is the builders’ radar next to your feed: trending GitHub repos with star counts, and Hacker News discussions with points. Full Pulse is part of Pro.',
  },
  {
    q: 'Can I cancel Pro anytime?',
    a: 'Yes. Cancel anytime from your profile, no retention call, no exit survey. You keep Pro until the end of the billing period, and your bookmarks and profile stay exactly as they are on the free plan.',
  },
  {
    q: 'Is there an app or email version?',
    a: 'Trace is web-first today, with a Chrome extension that puts the ranked feed in every new tab and an Android app on Google Play. A daily email brief lands every morning at 10:30 Europe/Berlin — turn it on from your profile.',
  },
  {
    q: 'Does Trace work with OpenClaw or Hermes?',
    a: 'Yes. Pro includes read-only MCP access, so OpenClaw, Hermes, Claude, Codex, or Cursor can pull the same ranked feed you read. The agent can never post, delete, or change anything.',
  },
];

export default function LandingScreen() {
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
          <nav className="nav-links">
            <a href="/how-it-works">How it works</a>
            <Link href="/subscribe">Pricing</Link>
            <Link href="/blog">Blog</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-float" aria-hidden="true">
          {HERO_TILES.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.name}
              src={SOURCES.find((s) => s.name === t.name)?.src}
              alt=""
              loading="lazy"
              className="hero-tile"
              style={{ ...t.style, width: t.size, height: t.size }}
            />
          ))}
        </div>
        <h1 className="hero-title">10 big things in tech and AI</h1>
        <p className="hero-sub">
          Trace reads 400+ sources, groups the coverage, and gives you the fastest way to stay
          updated.
        </p>
        <LandingHeroSignup />

        <div className="proof">
          <p className="proof-label">Companies shaping the AI and tech news Trace follows</p>
          <div className="logos">
            {SOURCES.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.name} src={s.src} alt={s.name} title={s.name} loading="lazy" />
            ))}
          </div>
        </div>
      </section>

      <LandingWhatYouGet />

      <div className="band">
        <section className="section" id="how">
          <h2 className="section-title">How Trace works</h2>
          <p className="section-sub">Three steps between you and a fully caught-up morning.</p>
          <div className="steps">
            {HOW_IT_WORKS.map((s, i) => (
              <article key={s.title} className="card">
                <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="card-title">{s.title}</h3>
                <p className="card-body">{s.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="section" id="pricing">
        <h2 className="section-title">Save 45+ minutes every morning.</h2>
        <p className="section-sub">Trace reads 400+ sources overnight and hands you the stories that matter.</p>
        <div className="plans">
          <article className="plan">
            <p className="plan-tag">Free</p>
            <p className="plan-price">$0<span>/month</span></p>
            <ul className="plan-list">
              {FREE_FEATURES.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <LandingCtaLink href="/feed?utm_source=site&utm_medium=pricing_free" location="pricing_free" className="btn-ghost plan-btn">Start reading free</LandingCtaLink>
          </article>
          <article className="plan plan-pro">
            <p className="plan-badge">Most popular</p>
            <p className="plan-tag">Trace Pro</p>
            <p className="plan-price">{priceAmountDisplay(SUBSCRIPTION_PRICE_DEFAULT)}<span>/month</span></p>
            <ul className="plan-list">
              {PRO_FEATURES.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <LandingCtaLink href="/subscribe" location="pricing_pro" variant="subscribe" className="btn-primary plan-btn">
              Go Pro
            </LandingCtaLink>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="founder">
          <p className="kicker">A note from the person behind Trace</p>
          <div className="founder-head">
            <h2 className="section-title founder-title">Hey, I am Tarat.</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tarat-avatar.jpg" alt="Tarat" className="founder-avatar" />
          </div>
          <p className="founder-p">
            Trace is the first solo indie app I have built and launched. I put it out at the end of January 2026,
            and it got so much traction on Product Hunt that I decided to keep going.
          </p>
          <p className="founder-p">
            Six months in, the app has changed a lot. I read every bit of feedback I can get and genuinely love
            working on it, making Trace more useful, clearer, and more worth opening for the people who use it.
          </p>
          <p className="founder-p">
            On the personal side, I am starting my master&rsquo;s in AI at the University of Edinburgh this September.
            So anything you spend on Trace helps me keep building while I figure out student life.
          </p>
          <p className="founder-p">
            If you&rsquo;re into investing or the US stock market, I also make{' '}
            <a href="https://stocksbrew.online" target="_blank" rel="noreferrer" className="flink">StocksBrew</a>. You can find more
            about me and the other things I&rsquo;m building at{' '}
            <a href="https://www.tarat.space" target="_blank" rel="noreferrer" className="flink">tarat.space</a>.
          </p>
          <p className="founder-sign">Tarat</p>
        </div>
      </section>

      <section className="section" id="faq">
        <h2 className="section-title">Questions, answered</h2>
        <div className="faq">
          {LANDING_FAQ.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section discovery-links" aria-labelledby="explore-trace-title">
        <p className="kicker">Explore Trace</p>
        <h2 className="section-title" id="explore-trace-title">How it works, pricing, and the blog.</h2>
        <p className="section-sub">The only three places you need after the feed: how Trace works, what it costs, and the writing behind it.</p>
        <div className="discovery-grid">
          <LandingDiscoveryLink href="/how-it-works" slug="how-it-works" className="discovery-card">
            <strong>How it works</strong>
            <span>See how Trace finds the signal, groups coverage, and ranks a daily edition.</span>
          </LandingDiscoveryLink>
          <LandingDiscoveryLink href="/subscribe" slug="pricing" className="discovery-card">
            <strong>Pricing</strong>
            <span>Free to start reading. Pro unlocks the full day, Pulse, and the archive.</span>
          </LandingDiscoveryLink>
          <LandingDiscoveryLink href="/blog" slug="blog" className="discovery-card">
            <strong>Blog</strong>
            <span>Guides on tech reading, AI tools, and staying current with less noise.</span>
          </LandingDiscoveryLink>
        </div>
      </section>

      <section className="final-cta">
        <h2 className="hero-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
          Tomorrow morning, be the person who already knows.
        </h2>
        <div className="hero-ctas">
          <a href={ANDROID_URL} target="_blank" rel="noreferrer" className="btn-primary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://cdn.simpleicons.org/android/ffffff" alt="" className="btn-logo" />
            Get the Android app
          </a>
          <a href={CHROME_URL} target="_blank" rel="noreferrer" className="btn-ghost">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://cdn.simpleicons.org/googlechrome/4285F4" alt="" className="btn-logo" />
            Add the Chrome extension
          </a>
        </div>
      </section>

      <Footer variant="landing" />
    </main>
  );
}


