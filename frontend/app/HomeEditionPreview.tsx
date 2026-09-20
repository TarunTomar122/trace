"use client";

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { ArticleImage } from '@/components/ArticleImage';
import type { FeedItem, V3UserFeed } from '@/lib/firestore';
import { decodeHtmlEntities } from '@/lib/feed-article-text';
import { trackLandingCTAClicked } from '@/lib/posthog';
import { filterSendWorthyTopics } from '@/lib/feed-value';

type DemoStory = {
  id: string;
  title: string;
  tag: string;
  thumbnail?: string | null;
};

function storyTag(item: FeedItem): string {
  const value = item.tags?.find(Boolean) || item.interest_id || 'Tech';
  return value.replace(/[-_]+/g, ' ');
}

function collectStories(feed: V3UserFeed | null): DemoStory[] {
  if (!feed) return [];
  const items = [
    ...(feed.for_you || []),
    ...(feed.trending || []),
    ...filterSendWorthyTopics(feed.trending_topics || []).flatMap((topic) => topic.articles || []),
  ];
  const seen = new Set<string>();

  return items.flatMap((item) => {
    if (item.type === 'brief' || !item.id || !item.title || seen.has(item.id)) return [];
    seen.add(item.id);
    return [{
      id: item.id,
      title: decodeHtmlEntities(item.title),
      tag: storyTag(item),
      thumbnail: item.thumbnail,
    }];
  }).slice(0, 12);
}

function StoryCard({ story, compact = false, x = false }: { story: DemoStory; compact?: boolean; x?: boolean }) {
  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden text-foreground ${compact ? `gap-3 rounded-[10px] p-3 ${x ? 'bg-white ring-1 ring-[#eff3f4]' : 'ring-1 ring-foreground/7'}` : `rounded-[18px] p-3 ${x ? 'bg-white' : 'bg-surface'} shadow-[0_1px_0_rgba(0,0,0,0.05)]`}`}
    >
      <ArticleImage
        thumbnail={story.thumbnail}
        title={story.title}
        alt=""
        className={compact ? `aspect-[16/9] w-full rounded-[7px] ${x ? 'bg-[#f7f9f9]' : 'bg-surface-secondary'} object-cover sm:h-[135px] sm:aspect-auto` : `aspect-[16/10] w-full rounded-[12px] ${x ? 'bg-[#f7f9f9]' : 'bg-surface-secondary'} object-cover`}
      />
      {!x && (
      <button
        type="button"
        aria-label={`Bookmark ${story.title}`}
        className="absolute right-6 top-6 z-10 inline-flex size-[34px] items-center justify-center rounded-full bg-[#0e0e0f]/80 text-white opacity-0 shadow-sm ring-1 ring-white/25 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Bookmark size={14} aria-hidden="true" />
      </button>
      )}
      <div className={compact ? 'px-1 pb-2' : 'min-h-[132px] px-3 pb-3 pt-5'}>
        <p className={`font-mono font-semibold uppercase ${x ? 'text-[#1d9bf0]' : 'text-accent'} ${compact ? 'text-[9px] tracking-[0.12em]' : 'text-[10px] tracking-[0.17em]'}`}>{story.tag}</p>
        <h3 className={compact ? 'mt-2 line-clamp-3 text-[16px] font-[550] leading-[1.35] text-foreground' : 'mt-3 text-[20px] font-semibold leading-[1.28] tracking-[-0.025em] text-foreground'}>
          {story.title}
        </h3>
      </div>
    </article>
  );
}

function ChromeDemo({ stories, x = false }: { stories: DemoStory[]; x?: boolean }) {
  const filters = ['All', 'AI', 'Engineering', 'Markets', 'Startups', 'Tech', 'UX design', 'Saved'];
  return (
    <div className={`rounded-[24px] p-2 sm:p-3 ${x ? "bg-[#eff3f4] ring-1 ring-[#eff3f4]" : "bg-surface-secondary shadow-2xl ring-1 ring-foreground/10"}`}>
      {/* x-variant: white chrome */}
      <div className={`rounded-t-[10px] px-3 pb-2 pt-2.5 ${x ? "bg-white border-b border-[#eff3f4]" : "bg-surface-tertiary"}`}>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className={`ml-4 rounded-t-md px-5 py-2 text-[9px] text-foreground ${x ? "bg-[#eff3f4]" : "bg-surface-secondary"}`}>Trace New Tab</span>
          <span className="text-[13px] text-secondary">+</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-secondary">
          <span aria-hidden="true">‹</span><span aria-hidden="true">›</span><span aria-hidden="true">↻</span>
          <span className={`flex-1 rounded-full px-4 py-2 text-left text-foreground ${x ? "bg-white ring-1 ring-[#eff3f4]" : "bg-surface"}`}>chrome://newtab</span>
          <span aria-hidden="true">⋮</span>
        </div>
      </div>
      <div className={`rounded-b-[10px] px-3 pb-4 pt-5 sm:px-5 sm:pb-5 sm:pt-6 ${x ? "bg-white" : "bg-background"}`}>
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8">
          {x ? (
            <span className="flex items-center gap-2 text-foreground"><Image src="/trace.webp" width={64} height={28} alt="Trace" style={{ width: 64, height: 'auto' }} /><span className="text-[17px] font-extrabold tracking-[-0.02em]">Trace</span></span>
          ) : (
            <span className="flex items-center gap-2 font-mono text-[9px] font-bold tracking-[0.24em] text-foreground"><Image src="/trace-app-icon-v1-180.png" width={24} height={24} alt="" style={{ width: 24, height: 24, borderRadius: 7 }} /> TRACE</span>
          )}
          <div className="flex min-w-0 gap-1 overflow-x-auto pb-1 sm:justify-center sm:overflow-hidden sm:pb-0">
            {filters.map((filter, index) => <span key={filter} className={`shrink-0 rounded-full px-2.5 py-1.5 text-[9px] ${index === 0 ? (x ? 'bg-[#0f1419] font-semibold text-white' : 'bg-foreground font-semibold text-background') : 'text-secondary'}`}>{filter}</span>)}
          </div>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stories.slice(0, 12).map((story, index) => (
            <div key={story.id} className={`h-full ${index >= 8 ? 'hidden lg:block' : index >= 4 ? 'hidden sm:block' : ''}`}>
              {x ? (
                <Link
                  href={`/story/${story.id}`}
                  prefetch={false}
                  className="block h-full"
                  onClick={() => trackLandingCTAClicked('read', 'demo_card', { destination: 'story', story_id: story.id })}
                >
                  <StoryCard story={story} compact x={x} />
                </Link>
              ) : (
                <StoryCard story={story} compact x={x} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomeEditionPreview({ feed, variant = 'paper' }: { feed: V3UserFeed | null; variant?: 'paper' | 'x' }) {
  const x = variant === 'x';
  const stories = useMemo(() => collectStories(feed), [feed]);

  if (!stories.length) return null;

  return (
    <section aria-label="See Trace in Chrome">
      <ChromeDemo stories={stories} x={x} />
    </section>
  );
}
