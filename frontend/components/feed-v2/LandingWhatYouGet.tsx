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
    body: 'See what happened in tech and AI today. If five sites cover the same story, Trace puts them together and keeps the links to all five.',
    href: '/feed',
    link: 'Open the live feed',
  },
  {
    id: 'email',
    kicker: 'Email',
    title: '10 big things in tech and AI, every morning',
    body: 'Choose the topics you follow. With Pro, get ten stories from the last 24 hours each morning, with a short note on why each one matters.',
    href: '/feed?tab=profile',
    link: 'Turn it on in your profile',
  },
  {
    id: 'extension',
    kicker: 'Chrome extension',
    title: 'The feed in every new tab',
    body: 'Add Trace to Chrome and your new tabs show the latest stories. Take a look whenever you want to see what’s happening.',
    href: CHROME_URL,
    link: 'Add it to Chrome',
  },
  {
    id: 'agents',
    kicker: 'Agents',
    title: 'Your AI assistant can use Trace',
    body: 'With Pro, connect Claude, Codex, OpenClaw, Hermes or Cursor. Your assistant can read the same feed you see and answer questions about today’s news. Access is read-only.',
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
