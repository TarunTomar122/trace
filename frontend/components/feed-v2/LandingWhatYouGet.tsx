import Link from 'next/link';
import { Bookmark, Share2 } from 'lucide-react';
import { LANDING_DEMO_STORIES, type LandingDemoStory } from '@/lib/landing-demo-stories';

const CHROME_URL = 'https://chromewebstore.google.com/detail/trace-ai-tech-news-in-eve/cblkklekbejbbpcaihfogdmaoofmikbk';

const FEATURES = [
  {
    id: 'feed',
    kicker: 'Feed',
    title: 'A feed that updates hourly',
    body: 'New coverage lands through the day. Related stories are grouped, ranked, and waiting when you open Trace, not after you refresh ten tabs.',
    href: '/feed',
    link: 'Open the live feed',
  },
  {
    id: 'email',
    kicker: 'Email',
    title: '10 big things in tech and AI, every morning',
    body: 'Pro reads the 10 biggest things from the last 24 hours, picked for the topics you actually follow — with why they matter, not the whole internet.',
    href: '/feed?tab=profile',
    link: 'Turn it on in your profile',
  },
  {
    id: 'extension',
    kicker: 'Chrome extension',
    title: 'The feed in every new tab',
    body: 'Open a new tab and the ranked feed is already there. Top stories, your topics, zero effort.',
    href: CHROME_URL,
    link: 'Add it to Chrome',
  },
  {
    id: 'agents',
    kicker: 'Agents',
    title: 'MCP access for OpenClaw and Hermes',
    body: 'Drop Trace into OpenClaw on Discord, or Hermes, Claude, Codex, Cursor. Read-only. Your agent can ask what moved today and quote the same ranked feed you read.',
    href: '/agents',
    link: 'Agent setup guide',
  },
] as const;

function FavStack({ sources }: { sources: string[] }) {
  const shown = sources.slice(0, 4);
  if (!shown.length) return null;
  return (
    <span className="yg-faves" aria-hidden="true">
      {shown.map((domain) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={domain} src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" />
      ))}
    </span>
  );
}

function FeedDemo({ stories }: { stories: LandingDemoStory[] }) {
  const featured = stories[0];
  const rest = [stories[1], stories[3]];
  if (!featured) return null;
  return (
    <div className="yg-frame yg-feed-frame" aria-hidden="true">
      <div className="yg-frame-bar">
        <span className="yg-feed-title">
          AI <span className="yg-feed-count">15</span>
          <span className="yg-streak">🔥 3-day streak</span>
        </span>
        <span className="yg-feed-tabs">
          <span className="yg-feed-tab on">✦ For you</span>
          <span className="yg-feed-tab">Recent</span>
        </span>
      </div>
      <article className="yg-hero">
        <p className="yg-hero-kicker">★ Latest in AI</p>
        <div className="yg-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={featured.image} alt="" />
          <span>{featured.mark}</span>
        </div>
        <h4 className="yg-hero-title">{featured.title}</h4>
        <p className="yg-why">{featured.why}</p>
        <p className="yg-meta">
          <FavStack sources={featured.sources} />
          <span>{featured.sourceName}</span>
          <span>· 8 min ago</span>
          <span>· {featured.sources.length} sources</span>
          <span className="yg-follow">Follow</span>
        </p>
      </article>
      {rest.filter(Boolean).map((story, i) => (
        <article key={story.id} className="yg-feed-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="yg-feed-thumb" src={story.image} alt="" />
          <div className="yg-feed-main">
            <h4 className="yg-feed-row-title">{story.title}</h4>
            <p className="yg-why">{story.why}</p>
            <p className="yg-meta">
              <FavStack sources={story.sources} />
              <span className="yg-feed-src">{story.sourceName}</span>
              <span>· 2h ago</span>
              <span>· {story.sources.length} sources</span>
              {i === 1 && (
                <>
                  <span>· Ongoing story</span>
                  <span className="yg-follow">Follow</span>
                </>
              )}
            </p>
          </div>
          <span className="yg-feed-side">
            <span className="yg-feed-rank">#{i + 2}</span>
            <span className="yg-feed-actions">
              <Bookmark size={13} />
              <Share2 size={13} />
            </span>
          </span>
        </article>
      ))}
    </div>
  );
}

function EmailDemo({ stories }: { stories: LandingDemoStory[] }) {
  const items = [stories[0], stories[1], stories[3]].filter(Boolean);
  return (
    <div className="yg-frame yg-mail" aria-hidden="true">
      <div className="yg-mail-chrome">
        <span className="yg-dots" />
        <p>Trace · 10 big things in tech and AI</p>
      </div>
      <div className="yg-letter">
        <div className="yg-letter-head">
          <span>TRACE</span>
          <span>this morning</span>
        </div>
        <p className="yg-letter-hi">Hey Tarat 👋</p>
        <p className="yg-letter-lead">Here are <strong>10 big things</strong> that happened today.</p>
        <ol className="yg-letter-list">
          {items.map((story, i) => (
            <li key={story.id}>
              <span className="yg-letter-num">{i + 1}</span>
              <div>
                <p className="yg-stitle">{story.title}</p>
                <p className="yg-why">{story.why}</p>
                <p className="yg-meta">
                  <FavStack sources={story.sources} />
                  <span>{story.sources.length} sources</span>
                  <span className="yg-letter-tag">{story.tag}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
        <span className="yg-letter-more">+ 7 more, every morning</span>
        <span className="yg-letter-cta">View your full feed →</span>
      </div>
    </div>
  );
}

function NewTabDemo({ stories }: { stories: LandingDemoStory[] }) {
  const cards = stories.slice(0, 6);
  return (
    <div className="yg-frame yg-nt" aria-hidden="true">
      <div className="yg-chrome-strip">
        <span className="yg-dots" />
        <span className="yg-chrome-tab">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trace.webp" alt="" />
          New Tab
          <i>×</i>
        </span>
        <span className="yg-chrome-plus">+</span>
      </div>
      <div className="yg-chrome-bar">
        <span className="yg-chrome-nav">
          <i className="dim">←</i>
          <i className="dim">→</i>
          <i>⟳</i>
        </span>
        <span className="yg-chrome-url">⌕ newtab.trace.app</span>
        <span className="yg-chrome-kebab">⋮</span>
      </div>
      <div className="yg-nt-bar">
        <span className="yg-nt-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trace.webp" alt="" />
          TRACE
        </span>
        <span className="yg-nt-pills">
          <span className="yg-nt-pill on">All</span>
          <span className="yg-nt-pill">AI</span>
          <span className="yg-nt-pill">Markets</span>
          <span className="yg-nt-pill">Startups</span>
        </span>
        <span className="yg-nt-signin">Sign in</span>
      </div>
      <div className="yg-nt-grid">
        {cards.map((story, i) => (
          <article key={`${story.id}-${i}`} className="yg-nt-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="yg-nt-shot" src={story.image} alt="" />
            <div className="yg-nt-body">
              <p className="yg-nt-title">{story.title}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function DiscordDemo({ stories }: { stories: LandingDemoStory[] }) {
  const lead = stories[0];
  const lines = stories.slice(0, 3);
  return (
    <div className="yg-frame yg-discord" aria-hidden="true">
      <aside className="yg-dc-rail">
        <span className="on">T</span>
        <span>OC</span>
        <span>+</span>
      </aside>
      <div className="yg-dc-main">
        <header className="yg-dc-head">
          <strong># ai-brief</strong>
          <span>OpenClaw · MCP</span>
        </header>
        <div className="yg-dc-log">
          <div className="yg-dc-msg">
            <span className="yg-dc-av you">Y</span>
            <div>
              <p className="yg-dc-name">you <time>Today at 10:31</time></p>
              <p><span className="yg-dc-ping">@OpenClaw</span> what’s moving in my AI topics this hour?</p>
            </div>
          </div>
          <div className="yg-dc-msg">
            <span className="yg-dc-av bot">🦞</span>
            <div>
              <p className="yg-dc-name">
                OpenClaw <em>APP</em> <time>Today at 10:31</time>
              </p>
              <p className="yg-dc-tool">used <code>trace.get_brief</code> · interests=ai · limit=3</p>
              {lead ? (
                <div className="yg-dc-embed">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lead.image} alt="" />
                  <div>
                    <p className="yg-dc-embed-k">{lead.sourceName} · {lead.sources.length} sources</p>
                    <p className="yg-dc-embed-t">{lead.title}</p>
                  </div>
                </div>
              ) : null}
              <ol>
                {lines.map((story) => (
                  <li key={story.id}>
                    {story.title}
                    <span> · {story.sources.length} sources</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        <div className="yg-dc-compose">Message #ai-brief</div>
      </div>
    </div>
  );
}

function DemoFor({ id, stories }: { id: string; stories: LandingDemoStory[] }) {
  if (id === 'email') return <EmailDemo stories={stories} />;
  if (id === 'extension') return <NewTabDemo stories={stories} />;
  if (id === 'agents') return <DiscordDemo stories={stories} />;
  return <FeedDemo stories={stories} />;
}

export default function LandingWhatYouGet() {
  const demo = LANDING_DEMO_STORIES;
  return (
    <section className="section yg" id="what-you-get">
      <h2 className="section-title">What you get</h2>
      <p className="section-sub">The feed, the morning email, and a live read for your agents. Same ranked stories in all three.</p>

      {FEATURES.map((feature, i) => (
        <article
          key={feature.id}
          className={`yg-row${i % 2 ? ' flip' : ''}`}
          id={feature.id === 'agents' ? 'agents' : undefined}
        >
          <div className="yg-copy">
            <p className="yg-kicker">{feature.kicker}</p>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
            {feature.href.startsWith('http') ? (
              <a href={feature.href} target="_blank" rel="noreferrer" className="yg-link">
                {feature.link}
              </a>
            ) : (
              <Link href={feature.href} className="yg-link">
                {feature.link}
              </Link>
            )}
          </div>
          <div className="yg-demo">
            <DemoFor id={feature.id} stories={demo} />
          </div>
        </article>
      ))}
    </section>
  );
}
