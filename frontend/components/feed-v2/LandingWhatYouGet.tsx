import Link from 'next/link';
import { LANDING_DEMO_STORIES, type LandingDemoStory } from '@/lib/landing-demo-stories';
import {
  DiscordDemo,
  EmailDemo,
  FeedDemo,
  NewTabDemo,
} from '@/components/feed-v2/landing-demos';

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
    body: 'Pro reads the 10 biggest things from the last 24 hours, picked for the topics you actually follow, with why they matter. Not the whole internet.',
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
          <div className="yg-demo trace-demo">
            <DemoFor id={feature.id} stories={demo} />
          </div>
        </article>
      ))}
    </section>
  );
}
