import Link from 'next/link';
import HomeEditionPreview from '@/app/HomeEditionPreview';
import LandingCtaLink from '@/app/LandingCtaLink';
import Footer from '@/components/Footer';
import { adminFirestore } from '@/lib/firebase-admin';

const CHROME_EXTENSION_URL = 'https://chromewebstore.google.com/detail/trace-ai-tech-news-in-eve/cblkklekbejbbpcaihfogdmaoofmikbk';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=online.yourtrace.app';

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
    body: 'Your role and interests decide what appears first, in what order, and what gets skipped. Every morning, ranked for you.',
  },
];

const FREE_FEATURES = [
  'A personalized AI and tech news feed',
  '30 headlines in every new Chrome tab',
  'Five unique AI summaries every day',
  'Unlimited original source links',
  'Topic filters for the stories you follow',
  'Bookmarks with a free Trace account',
];

const PRO_FEATURES = [
  'Unlimited AI summaries in the web feed',
  'The complete ranked daily edition',
  'Search your complete saved archive',
  'The complete daily news archive',
  'Full personalized Pulse',
  'Read-only Agent Access',
];

const AGENT_STEPS = [
  {
    title: 'Connect in one command',
    body: 'Add Trace as an MCP server in Claude, Codex, or Cursor with your Pro agent key. Read-only by design: it can never post, delete, or change anything.',
  },
  {
    title: 'Read the same ranked feed',
    body: 'Your agent queries the ranked daily edition, Pulse tools and discussions, and your saved archive. Same signal you read, zero tab-switching.',
  },
  {
    title: 'Build it into the workflow',
    body: 'Morning briefings in Slack, pre-meeting company dossiers, code-review context on new releases. One HTTPS call returns structured JSON your agent can quote.',
  },
];

const FAQ = [
  {
    q: 'Is Trace free?',
    a: 'Yes. The free plan includes your ranked AI and technology feed, five full story briefs every day, unlimited original source links, and bookmarks with a free account. Pro ($3/mo) unlocks the whole day: every brief, full Pulse, and your archive.',
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
    a: 'Aggregators hand you a firehose and make ranking your job. Trace hands you the 25 stories that mattered, grouped across outlets, summarized with key points, and ranked for your role. You open it, you read it, you are caught up in under 10 minutes.',
  },
  {
    q: 'How does personalization work?',
    a: 'Set your role and interests in your profile and tomorrow’s edition is ranked around them: an engineer sees releases and tooling first, a founder sees markets and launches. Same transparent ranking, weighted to your topics. No engagement bait, no outrage optimization.',
  },
  {
    q: 'What is Pulse?',
    a: 'Pulse is the builders’ radar next to your feed: trending GitHub repos with star counts, Hacker News discussions with points, and worth-reading blog posts. Pro members get the full personalized Pulse; free readers see the top of each list.',
  },
  {
    q: 'Can I cancel Pro anytime?',
    a: 'Yes. Cancel in one click from your profile, no retention call, no exit survey. You keep Pro until the end of the billing period, and your bookmarks and profile stay exactly as they are on the free plan.',
  },
  {
    q: 'Is there an app or email version?',
    a: 'Trace is web-first today, with a Chrome extension that puts the ranked feed in every new tab and an Android app on Google Play. A daily email brief is on the roadmap: Pro members will get first access.',
  },
];

async function loadEditionFeed(): Promise<Record<string, unknown> | null> {
  if (!adminFirestore) return null;
  try {
    const snap = await adminFirestore.collection('v3_user_feeds').doc('_global').collection('daily').orderBy('__name__', 'desc').limit(1).get();
    const d = snap.docs[0]?.data();
    if (!d) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { trending: d.trending || [], trending_topics: d.trending_topics || [], for_you: [], pulse: [] };
  } catch {
    return null;
  }
}

export default async function LandingScreen() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editionFeed = (await loadEditionFeed()) as any;

  return (
    <main className="lp">
      <style>{css}</style>

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
            <a href="/blog">Blog</a>
            <LandingCtaLink href="/feed" location="nav" className="nav-cta">Open the feed</LandingCtaLink>
          </nav>
        </div>
      </header>

      <section className="hero">
        <h1 className="hero-title">The fastest way to catch up on tech and AI news.</h1>
        <p className="hero-sub">
          Tech news from multiple sources, grouped, summarized, and ranked in one feed.
        </p>
        <div className="hero-ctas">
          <LandingCtaLink href="/feed" location="hero" className="btn-primary">Open the feed</LandingCtaLink>
          <a href={CHROME_EXTENSION_URL} target="_blank" rel="noreferrer" className="btn-ghost">Add Chrome Extension</a>
        </div>

        <div className="logos">
          {SOURCES.map((s) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={s.name} src={s.src} alt={s.name} title={s.name} loading="lazy" />
          ))}
        </div>
        <p className="logos-note">Companies shaping the AI and tech news Trace follows</p>
      </section>

      <section className="section" id="demo">
        <h2 className="section-title">Your next Chrome tab</h2>
        <p className="section-sub">This is the actual feed, live. Tap any story to start reading.</p>
        <div className="demo-wrap">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <HomeEditionPreview feed={editionFeed} variant="x" />
        </div>
        <div className="demo-cta">
          <LandingCtaLink href="/feed" location="demo" className="btn-primary">Open the live feed</LandingCtaLink>
        </div>
      </section>

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
            <LandingCtaLink href="/feed" location="pricing_free" className="btn-ghost plan-btn">Start reading</LandingCtaLink>
          </article>
          <article className="plan plan-pro">
            <p className="plan-tag">Trace Pro</p>
            <p className="plan-price">$3<span>/month</span></p>
            <ul className="plan-list">
              {PRO_FEATURES.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <LandingCtaLink href="/subscribe" location="pricing_pro" variant="subscribe" className="btn-primary plan-btn">
              Try Pro free for 3 days
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
          <p className="founder-sign">Tarat · building Trace from Edinburgh</p>
        </div>
      </section>

      <section className="section" id="faq">
        <h2 className="section-title">Questions, answered</h2>
        <div className="faq">
          {FAQ.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section" id="agents">
        <h2 className="section-title">Plug Trace into your agent</h2>
        <p className="section-sub">Give Claude, Codex, Cursor, or your own stack a live read on tech: the ranked feed, Pulse, and archive search over one read-only connection.</p>
        <div className="steps">
          {AGENT_STEPS.map((s, i) => (
            <article key={s.title} className="card">
              <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="card-title">{s.title}</h3>
              <p className="card-body">{s.body}</p>
            </article>
          ))}
        </div>
        <div className="agent-snippet">
          <code>codex mcp add trace --url https://www.yourtrace.online/api/mcp</code>
        </div>
        <div className="demo-cta" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/agents" className="btn-ghost">Agent setup guide</Link>
          <LandingCtaLink href="/subscribe" location="agents" variant="subscribe" className="btn-primary">Get Pro + agent access</LandingCtaLink>
        </div>
      </section>

      <section className="final-cta">
        <h2 className="hero-title" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
          Tomorrow morning, be the person who already knows.
        </h2>
        <div className="hero-ctas">
          <LandingCtaLink href="/feed" location="final" className="btn-primary">Open the feed</LandingCtaLink>
          <a href={ANDROID_URL} target="_blank" rel="noreferrer" className="btn-ghost">Get the Android app</a>
        </div>
      </section>

      <Footer variant="landing" />
    </main>
  );
}

const css = `
.lp {
  --ink: #0f1419;
  --text-2: #536471;
  --line: #eff3f4;
  --blue: #1d9bf0;
  --hover: #f7f9f9;
  background: #fff; color: var(--ink); min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 15px; line-height: 20px;
}
.lp .nav { border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); z-index: 100; }
.lp .nav-in { max-width: 1100px; margin: 0 auto; padding: 0 20px; height: 56px; display: flex; align-items: center; justify-content: space-between; }
.lp .brand { display: flex; align-items: center; gap: 9px; text-decoration: none; color: var(--ink); }
.lp .brand-logo { height: 28px; width: auto; }
.lp .wordmark { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
.lp .nav-links { display: flex; align-items: center; gap: 20px; }
.lp .nav-links a { color: var(--text-2); text-decoration: none; font-size: 14px; font-weight: 550; }
.lp .nav-links a:hover { color: var(--ink); }
.lp .nav-cta {
  background: var(--blue); color: #fff !important; padding: 8px 16px; border-radius: 9999px; font-weight: 700;
}
.lp .nav-cta:hover { background: #1a8cd8; }
@media (max-width: 640px) { .lp .nav-links a:not(.nav-cta) { display: none; } }

.lp .hero { max-width: 860px; margin: 0 auto; padding: 84px 20px 40px; text-align: center; }
.lp .hero-title { margin: 0 0 16px; font-size: clamp(2.2rem, 5.5vw, 3.9rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1.04; }
.lp .hero-sub { margin: 0 auto 28px; max-width: 560px; font-size: 18px; line-height: 1.55; color: var(--text-2); }
.lp .hero-ctas { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.lp .btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  height: 48px; padding: 0 28px; border-radius: 9999px;
  background: var(--blue); color: #fff; font-size: 16px; font-weight: 700; text-decoration: none;
  transition: background-color 0.2s ease;
}
.lp .btn-primary:hover { background: #1a8cd8; }
.lp .btn-ghost {
  display: inline-flex; align-items: center; justify-content: center;
  height: 48px; padding: 0 28px; border-radius: 9999px;
  border: 1px solid var(--text-2); color: var(--ink); font-size: 16px; font-weight: 700; text-decoration: none;
  transition: background-color 0.2s ease;
}
.lp .btn-ghost:hover { background: var(--hover); }

.lp .logos { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 26px; margin-top: 44px; }
.lp .logos img { height: 24px; width: auto; opacity: 0.75; }
.lp .logos-note { margin: 14px 0 0; font-size: 12.5px; color: var(--text-3); }

.lp .section { max-width: 1000px; margin: 0 auto; padding: 56px 20px; }
.lp .section-title { margin: 0 0 10px; text-align: center; font-size: clamp(1.7rem, 3.4vw, 2.5rem); font-weight: 800; letter-spacing: -0.03em; }
.lp .section-sub { margin: 0 auto 36px; text-align: center; font-size: 16.5px; color: var(--text-2); max-width: 520px; line-height: 1.55; }

.lp .section#demo { max-width: 1280px; }
.lp .demo-wrap { max-width: 100%; margin: 0 auto; border: 1px solid var(--line); border-radius: 24px; overflow: hidden; --foreground: #0f1419; --secondary: #536471; --background: #ffffff; --surface: #ffffff; }
.lp .demo-cta { text-align: center; margin-top: 24px; }
.lp .agent-snippet { max-width: 640px; margin: 28px auto 0; background: #0f1419; border-radius: 14px; padding: 16px 18px; overflow-x: auto; }
.lp .agent-snippet code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.6; color: #e7e9ea; white-space: nowrap; }

.lp .steps { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 780px) { .lp .steps { grid-template-columns: 1fr 1fr 1fr; } }
.lp .card { border: 1px solid var(--line); border-radius: 20px; padding: 24px 22px; background: #fff; }
.lp .step-num { font-size: 13px; font-weight: 800; color: var(--blue); font-variant-numeric: tabular-nums; }
.lp .card-title { margin: 10px 0 8px; font-size: 18px; font-weight: 750; letter-spacing: -0.015em; }
.lp .card-body { margin: 0; font-size: 15px; line-height: 1.6; color: var(--text-2); }

.lp .plans { display: grid; grid-template-columns: 1fr; gap: 16px; max-width: 760px; margin: 0 auto; }
@media (min-width: 780px) { .lp .plans { grid-template-columns: 1fr 1fr; } }
.lp .plan { border: 1px solid var(--line); border-radius: 20px; padding: 26px 24px; display: flex; flex-direction: column; }
.lp .plan-pro { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue); }
.lp .plan-tag { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-2); }
.lp .plan-price { margin: 6px 0 18px; font-size: 40px; font-weight: 800; letter-spacing: -0.03em; }
.lp .plan-price span { font-size: 15px; font-weight: 500; color: var(--text-2); }
.lp .plan-list { margin: 0 0 22px; padding: 0; list-style: none; flex: 1; }
.lp .plan-list li { padding: 5px 0 5px 24px; position: relative; font-size: 14.5px; line-height: 1.45; }
.lp .plan-list li::before { content: '✓'; position: absolute; left: 0; color: var(--blue); font-weight: 700; }
.lp .plan-btn { width: 100%; height: 46px; display: flex; }

.lp .founder { max-width: 620px; margin: 0 auto; }
.lp .founder .kicker { margin-bottom: 16px; }
.lp .founder-head { display: flex; align-items: center; justify-content: space-between; gap: 22px; margin-bottom: 22px; }
.lp .founder .section-title { text-align: left; }
.lp .founder-title { margin: 0; }
.lp #faq .section-title { margin-bottom: 30px; }
.lp .founder-title { margin-bottom: 18px; }
.lp .founder-avatar { width: 104px; height: 104px; border-radius: 50%; object-fit: cover; display: block; box-shadow: 0 0 0 4px rgba(29,155,240,0.12); flex-shrink: 0; }
.lp .founder-p { margin: 0 0 14px; font-size: 16.5px; line-height: 1.7; color: var(--ink); }
.lp .founder-sign { margin: 18px 0 0; font-size: 14px; font-weight: 600; color: var(--text-2); }
.lp .flink { color: var(--ink); font-weight: 650; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--line); }
.lp .flink:hover { text-decoration-color: var(--ink); }

.lp .faq { max-width: 680px; margin: 0 auto; border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }
.lp .faq-item { border-bottom: 1px solid var(--line); }
.lp .faq-item:last-child { border-bottom: none; }
.lp .faq-item summary { padding: 18px 20px; font-size: 16px; font-weight: 650; cursor: pointer; list-style: none; transition: background-color 0.2s ease; }
.lp .faq-item summary::-webkit-details-marker { display: none; }
.lp .faq-item summary:hover { background: var(--hover); }
.lp .faq-item p { margin: 0; padding: 0 20px 18px; font-size: 15px; line-height: 1.65; color: var(--text-2); }

.lp .final-cta { max-width: 760px; margin: 0 auto; padding: 40px 20px 72px; text-align: center; }
.lp .final-cta .hero-ctas { margin-top: 26px; }

.lp .footer { border-top: 1px solid var(--line); }
.lp .foot-in { max-width: 1100px; margin: 0 auto; padding: 24px 20px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between; }
.lp .foot-brand { font-weight: 800; font-size: 16px; }
.lp .foot-links { display: flex; flex-wrap: wrap; gap: 18px; }
.lp .foot-links a { color: var(--text-2); text-decoration: none; font-size: 13.5px; }
.lp .foot-links a:hover { color: var(--ink); }
.lp .foot-copy { font-size: 13px; color: var(--text-3); }
`;
