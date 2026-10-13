import Link from 'next/link';
import { AppWindow, Bot, Newspaper } from 'lucide-react';
import { LANDING_DEMO_STORIES, type LandingDemoStory } from '@/lib/landing-demo-stories';
import type { DailyStory } from '@/lib/daily-editions';
import { topicLabel } from '@/lib/newsletter-prefs';
import {
  DiscordDemo,
  FeedDemo,
  NewTabDemo,
} from '@/components/feed-v2/landing-demos';

const CHROME_URL = 'https://chromewebstore.google.com/detail/trace-ai-tech-news-in-eve/cblkklekbejbbpcaihfogdmaoofmikbk';

const FEATURES = [
  {
    id: 'feed',
    Icon: Newspaper,
    title: 'The feed',
    body: 'One card per story, every source attached. Plus Pulse, the archive, and bookmarks.',
    href: '/feed',
    link: 'Open the feed',
  },
  {
    id: 'extension',
    Icon: AppWindow,
    title: 'Every new tab',
    body: 'The latest stories in every new Chrome tab.',
    href: CHROME_URL,
    link: 'Add it to Chrome',
  },
  {
    id: 'agents',
    Icon: Bot,
    title: 'Your AI assistant',
    body: 'Claude, Cursor and other MCP clients can read the feed and answer questions about today’s news.',
    href: '/agents',
    link: 'Agent setup guide',
  },
] as const;

function DemoFor({ id, stories }: { id: string; stories: LandingDemoStory[] }) {
  if (id === 'extension') return <NewTabDemo stories={stories} />;
  if (id === 'agents') return <DiscordDemo stories={stories} />;
  return <FeedDemo stories={stories} />;
}

/** Today's real stories for the mockups; the samples only if there are too few with images. */
function demoStories(stories: DailyStory[]): LandingDemoStory[] {
  const real = stories
    .filter((story) => story.image)
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

export default function LandingWhatYouGet({ stories = [] }: { stories?: DailyStory[] }) {
  const demo = demoStories(stories);
  return (
    <section className="section yg" id="what-you-get">
      <div className="sec-head">
        <h2 className="h2">Read it anywhere</h2>
      </div>

      {FEATURES.map((feature, i) => (
        <article
          key={feature.id}
          className={`yg-row${i % 2 ? ' flip' : ''}`}
          id={feature.id === 'agents' ? 'agents' : undefined}
        >
          <div className="yg-copy">
            <span className="yg-icon" aria-hidden="true"><feature.Icon size={22} strokeWidth={2.2} /></span>
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
