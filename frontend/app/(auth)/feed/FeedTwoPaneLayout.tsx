"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ExternalLink, Flame } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MD_COMPONENTS: Components = {
  p: ({ children }) => <>{children}</>,
  strong: ({ children }) => <strong className="font-semibold text-[#111827]">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#2563eb] hover:underline">
      {children}
    </a>
  ),
};
import { WireFeedLoadingSkeleton } from './FeedBootShell';
import { organizeEditionFeed } from './FeedEditionOrganizer';
import { FeedListItem, INTEREST_LABEL, getTimeLabel } from './FeedUi';
import {
  FEED_LIST_SCROLL_KEY,
  FEED_RESTORE_SCROLL_KEY,
  FEED_SELECTED_STORY_KEY,
} from './FeedPulse';
import type { FeedItem, TrendingTopic, TopicTimelineEvent } from '@/lib/firestore';
import type { HotTweet } from './FeedOneScreen';
import { ArticleImage } from '@/components/ArticleImage';

// ── helpers ───────────────────────────────────────────────────────────────────

function getTodayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
}

function getKeyPoints(item: FeedListItem): string[] {
  if (item.type === 'topic') return (item.data as TrendingTopic).key_points ?? [];
  return (item.data as FeedItem).summary?.short_article?.key_takeaways ?? [];
}

function getBody(item: FeedListItem): string {
  if (item.type === 'topic') return (item.data as TrendingTopic).summary ?? '';
  const sa = (item.data as FeedItem).summary?.short_article;
  return sa?.body ?? sa?.subtitle ?? item.preview ?? '';
}

function getTimeline(item: FeedListItem): TopicTimelineEvent[] {
  if (item.type === 'topic') return (item.data as TrendingTopic).timeline ?? [];
  return [];
}

function getItemUrl(item: FeedListItem): string | undefined {
  if (item.url) return item.url;
  if (item.type === 'article') return (item.data as FeedItem).url;
  return (item.data as TrendingTopic).articles?.[0]?.url;
}

function getCategory(item: FeedListItem): string {
  const id = item.interestId ?? item.tags?.[0];
  if (!id) return '';
  return (INTEREST_LABEL[id] ?? id.replace(/-/g, ' ')).toUpperCase();
}

function stocksBrewUrl(storyId?: string): string {
  const url = new URL('https://stocksbrew.online/');
  url.searchParams.set('utm_source', 'trace');
  url.searchParams.set('utm_medium', 'feed');
  url.searchParams.set('utm_campaign', 'market_story');
  if (storyId) url.searchParams.set('utm_content', storyId);
  return url.toString();
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  } catch { return ts; }
}

// ── toggle ────────────────────────────────────────────────────────────────────

function Toggle({ tab, onChange }: { tab: 'news' | 'pulse'; onChange: (t: 'news' | 'pulse') => void }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-6">
      {(['news', 'pulse'] as const).map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`relative pb-1.5 text-[13px] font-semibold transition-colors ${
            tab === t ? 'text-[#111827]' : 'text-[#9ca3af] hover:text-[#374151]'
          }`}
        >
          {t === 'news' ? 'News' : 'Pulse'}
          {tab === t && (
            <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-[#111827]" />
          )}
        </button>
      ))}
    </div>
  );
}

// ── left pane ─────────────────────────────────────────────────────────────────

function LeftPane({
  edition,
  allStories,
  activeInterest,
  setActiveInterest,
  selectedId,
  onSelect,
  isItemLocked,
  listScrollRef,
}: {
  edition: ReturnType<typeof organizeEditionFeed>;
  allStories: FeedListItem[];
  activeInterest: string | null;
  setActiveInterest: (id: string | null) => void;
  selectedId: string | null;
  onSelect: (item: FeedListItem) => void;
  isItemLocked: (id: string) => boolean;
  listScrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const interestPills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allStories) {
      const id = s.interestId ?? s.tags?.[0];
      if (id && INTEREST_LABEL[id]) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count }));
  }, [allStories]);

  const visibleStories = useMemo(() => {
    if (!activeInterest) return allStories;
    return allStories.filter(s => s.interestId === activeInterest || s.tags?.includes(activeInterest));
  }, [allStories, activeInterest]);

  const effectiveSelected = selectedId ?? allStories[0]?.id;

  return (
    <div className="flex min-h-0 w-full flex-col sm:w-[360px] sm:shrink-0 sm:flex-none sm:border-r sm:border-[#e5e7eb]">
      {/* left header */}
      <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-6 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#111827]">Today&rsquo;s news</h2>
          <span className="text-[12px] text-[#9ca3af]">{allStories.length} stories</span>
        </div>
        {interestPills.length > 0 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
            <button
              type="button"
              onClick={() => setActiveInterest(null)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                !activeInterest ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
              }`}
            >
              All
            </button>
            {interestPills.map(({ id, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveInterest(activeInterest === id ? null : id)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  activeInterest === id ? 'bg-[#2563eb] text-white' : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
                }`}
              >
                {INTEREST_LABEL[id]}
                <span className={`ml-1 text-[10px] ${activeInterest === id ? 'text-white/70' : 'text-[#9ca3af]'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* story list */}
      <div ref={listScrollRef} className="flex-1 min-h-0 overflow-y-auto bg-white">
        {visibleStories.map((item) => {
          const selected = item.id === effectiveSelected;
          const meta = [
            item.sourceCount > 1 ? `${item.sourceCount} sources` : item.source,
            item.timestamp ? getTimeLabel(item.timestamp) : null,
          ].filter(Boolean).join(' · ');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`group flex w-full gap-4 border-b border-[#e5e7eb]/40 px-6 py-4 text-left transition-colors ${
                selected ? 'bg-[#eff6ff]/50' : 'bg-white hover:bg-[#fafafa]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug text-[#111827] line-clamp-3">
                  {item.title}
                </p>
                {meta && (
                  <p className="mt-2 text-[11px] font-medium text-[#9ca3af]">{meta}</p>
                )}
              </div>
              <div className="shrink-0 h-[68px] w-[68px] overflow-hidden rounded-md bg-[#f3f4f6]">
                <ArticleImage
                  thumbnail={item.thumbnail}
                  title={item.title}
                  fallbackWidth={144}
                  fallbackHeight={144}
                  className="h-full w-full object-cover"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── right pane ────────────────────────────────────────────────────────────────

function RightPane({ item, isItemLocked }: { item: FeedListItem; isItemLocked: (id: string) => boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const keyPoints = getKeyPoints(item);
  const body = getBody(item);
  const timeline = getTimeline(item);
  const url = getItemUrl(item);
  const category = getCategory(item);
  const meta = [
    category,
    item.timestamp ? getTimeLabel(item.timestamp) : null,
    item.sourceCount > 1 ? `${item.sourceCount} sources` : null,
  ].filter(Boolean).join('  ·  ');
  const showStocksBrewCta = (item.interestId ?? item.tags?.[0] ?? '').toLowerCase() === 'markets';

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [item.id]);

  return (
    <div ref={scrollRef} className="hidden min-h-0 flex-1 overflow-y-auto bg-white sm:block">
      <article className="mx-auto w-full max-w-[720px] px-10 py-10">
        {/* meta */}
        {meta && (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#9ca3af]">
            {meta}
          </p>
        )}

        {/* headline */}
        <h1 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-[#111827] leading-[1.18]">
          {item.title}
        </h1>

        {/* hero image */}
        {item.thumbnail && (
          <div className="mt-6 overflow-hidden rounded-md bg-[#f3f4f6]">
            <ArticleImage
              thumbnail={item.thumbnail}
              title={item.title}
              fallbackWidth={1200}
              fallbackHeight={675}
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        )}

        {/* body */}
        {body && (
          <p className="mt-7 text-[15.5px] leading-[1.7] text-[#374151]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{body}</ReactMarkdown>
          </p>
        )}

        {/* key points */}
        {keyPoints.length > 0 && (
          <section className="mt-10 border-t border-[#e5e7eb] pt-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Key points</p>
            <ul className="mt-4 space-y-3">
              {keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3 text-[14.5px] leading-[1.6] text-[#374151]">
                  <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#9ca3af]" />
                  <span>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{point}</ReactMarkdown>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* timeline */}
        {timeline.length > 0 && (
          <section className="mt-10 border-t border-[#e5e7eb] pt-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">Timeline</p>
            <div className="relative mt-5">
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[#e5e7eb]" />
              <div className="space-y-6">
                {timeline.map(event => (
                  <div key={event.id} className="relative pl-7">
                    <span className="absolute left-0 top-[7px] block h-[11px] w-[11px] rounded-full border-2 border-white bg-[#d1d5db] ring-1 ring-[#e5e7eb]" />
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#9ca3af]">
                      <span>{formatTimestamp(event.timestamp)}</span>
                      {event.source_name && (
                        <>
                          <span className="text-[#d1d5db]">·</span>
                          <span className="font-medium uppercase tracking-[0.08em] text-[#6b7280]">{event.source_name}</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-[14px] font-semibold text-[#111827] leading-snug">{event.title}</p>
                    {event.summary && (
                      <p className="mt-1 text-[13px] leading-relaxed text-[#6b7280]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{event.summary}</ReactMarkdown>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* read original */}
        {url && (
          <div className="mt-10 border-t border-[#e5e7eb] pt-6">
            {showStocksBrewCta && (
              <div className="mb-3">
                <a
                  href={stocksBrewUrl(item.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2563eb] hover:underline underline-offset-2"
                >
                  Need deeper stock context? Open in StocksBrew <ExternalLink size={13} />
                </a>
              </div>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2563eb] hover:underline underline-offset-2"
            >
              Read full article <ExternalLink size={13} />
            </a>
          </div>
        )}
      </article>
    </div>
  );
}

// ── pulse tab ─────────────────────────────────────────────────────────────────

// ── X / Twitter icon ─────────────────────────────────────────────────────────
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.731-8.835L1.254 2.25H8.08l4.261 5.635 5.903-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function PulseTab({
  hotTweets,
  discussions,
  tools,
}: {
  hotTweets: HotTweet[];
  discussions: FeedListItem[];
  tools: FeedListItem[];
}) {
  const isEmpty = !hotTweets.length && !discussions.length && !tools.length;

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <p className="text-[13px] text-[#9ca3af]">Pulse is on its way</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-white">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-10 sm:flex-row">

          {/* ── Left: X / Hot Tweets ── */}
          {hotTweets.length > 0 && (
            <div className="min-w-0 flex-1">
              {/* section header */}
              <div className="mb-5 flex items-center gap-2 border-b border-[#e5e7eb] pb-3">
                <Flame size={14} className="text-orange-500" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600/70">
                  Hot on X
                </span>
              </div>

              <div className="space-y-0">
                {hotTweets.slice(0, 8).map(tweet => (
                  <a
                    key={tweet.id}
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3.5 border-b border-[#f3f4f6] py-4 transition-colors last:border-b-0 hover:bg-transparent"
                  >
                    <XIcon className="mt-[3px] h-[14px] w-[14px] shrink-0 text-[#d1d5db] transition-colors group-hover:text-[#1d9bf0]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold leading-snug text-[#111827] line-clamp-2">
                        {tweet.title}
                      </p>
                      {tweet.description && (
                        <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-[#6b7280]">
                          {tweet.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-[#9ca3af]">{getTimeLabel(tweet.pubDate)}</span>
                        <span className="text-[11px] font-medium text-[#1d9bf0] opacity-0 transition-opacity group-hover:opacity-100">
                          View on X →
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Right: Community + Building ── */}
          {(discussions.length > 0 || tools.length > 0) && (
            <div className="w-full sm:w-[300px] sm:shrink-0 space-y-8">

              {/* Discussions */}
              {discussions.length > 0 && (
                <div>
                  <div className="mb-4 border-b border-[#e5e7eb] pb-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
                      Community
                    </span>
                  </div>
                  <div className="space-y-4">
                    {discussions.slice(0, 5).map(item => {
                      const url = getItemUrl(item);
                      const isHN = item.source?.toLowerCase().includes('hacker');
                      return (
                        <a
                          key={item.id}
                          href={url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            {item.source && (
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                isHN ? 'bg-orange-50 text-orange-600' : 'bg-[#f3f4f6] text-[#6b7280]'
                              }`}>
                                {item.source}
                              </span>
                            )}
                            {item.signalCount != null && item.signalCount > 0 && (
                              <span className="text-[11px] font-medium text-[#9ca3af]">
                                {item.signalCount.toLocaleString()} pts
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] font-semibold leading-snug text-[#111827] group-hover:underline underline-offset-2 decoration-[#111827]/20">
                            {item.title}
                          </p>
                          {item.preview && (
                            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#6b7280]">
                              {item.preview}
                            </p>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Building / Tools */}
              {tools.length > 0 && (
                <div>
                  <div className="mb-4 border-b border-[#e5e7eb] pb-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]">
                      What&rsquo;s being built
                    </span>
                  </div>
                  <div className="space-y-4">
                    {tools.slice(0, 5).map(item => {
                      const url = getItemUrl(item);
                      const signalLabel = item.source === 'GitHub Trending'
                        ? 'stars'
                        : item.source === 'Product Hunt'
                          ? 'upvotes'
                          : 'points';
                      return (
                        <a
                          key={item.id}
                          href={url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex gap-3"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f7f3eb] text-[13px]">
                            🚀
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold leading-snug text-[#111827] group-hover:underline underline-offset-2 decoration-[#111827]/20">
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#9ca3af]">
                              {item.source || 'Source'}
                              {item.signalCount != null && item.signalCount > 0
                                ? ` · ${item.signalCount.toLocaleString()} ${signalLabel}`
                                : ''}
                            </p>
                            {item.preview && (
                              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#6b7280]">
                                {item.preview}
                              </p>
                            )}
                          </div>
                          <ExternalLink size={11} className="mt-0.5 shrink-0 text-[#d1d5db] transition-colors group-hover:text-[#9ca3af]" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── main export ───────────────────────────────────────────────────────────────

export default function FeedTwoPaneLayout({
  isLoading,
  storyList,
  hotTweets = [],
  discussions = [],
  tools = [],
  interestOrder,
  onSelectStory,
  isItemLocked,
}: {
  isLoading: boolean;
  storyList: FeedListItem[];
  hotTweets?: HotTweet[];
  discussions?: FeedListItem[];
  tools?: FeedListItem[];
  interestOrder: string[];
  onSelectStory: (item: FeedListItem) => void;
  isItemLocked: (id: string) => boolean;
}) {
  const [tab, setTab] = useState<'news' | 'pulse'>('news');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeInterest, setActiveInterest] = useState<string | null>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  const edition = useMemo(
    () => organizeEditionFeed(storyList, interestOrder),
    [storyList, interestOrder],
  );

  const allStories = useMemo(() => [
    ...(edition.hero ? [edition.hero.lead, ...edition.hero.sidebar] : []),
    ...edition.sections.flatMap(s => s.stories),
    ...edition.latest,
  ], [edition]);

  useEffect(() => {
    if (restoredScrollRef.current || typeof window === 'undefined') return;
    if (sessionStorage.getItem(FEED_RESTORE_SCROLL_KEY) !== '1') return;
    if (allStories.length === 0) return;

    restoredScrollRef.current = true;
    sessionStorage.removeItem(FEED_RESTORE_SCROLL_KEY);

    const savedId = sessionStorage.getItem(FEED_SELECTED_STORY_KEY);
    if (savedId && allStories.some((story) => story.id === savedId)) {
      setSelectedId(savedId);
    }

    const savedScroll = sessionStorage.getItem(FEED_LIST_SCROLL_KEY);
    if (!savedScroll) return;

    const top = Number.parseInt(savedScroll, 10);
    if (!Number.isFinite(top) || top <= 0) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        listScrollRef.current?.scrollTo({ top, behavior: 'auto' });
      });
    });
  }, [allStories]);

  const effectiveSelectedId = selectedId ?? allStories[0]?.id ?? null;
  const selectedItem = useMemo(
    () => allStories.find(s => s.id === effectiveSelectedId) ?? null,
    [allStories, effectiveSelectedId],
  );

  const handleSelect = (item: FeedListItem) => {
    setSelectedId(item.id);
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      sessionStorage.setItem(FEED_LIST_SCROLL_KEY, String(listScrollRef.current?.scrollTop ?? 0));
      sessionStorage.setItem(FEED_SELECTED_STORY_KEY, item.id);
      sessionStorage.setItem(FEED_RESTORE_SCROLL_KEY, '1');
      onSelectStory(item);
    }
  };

  if (isLoading && storyList.length === 0) {
    return <WireFeedLoadingSkeleton />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* tab bar */}
      <div className="shrink-0 border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-3">
          <Toggle tab={tab} onChange={setTab} />
          <p className="pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9ca3af]">
            {getTodayLabel()}
          </p>
        </div>
      </div>

      {/* content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 overflow-hidden">
          {tab === 'news' ? (
            <>
              <LeftPane
                edition={edition}
                allStories={allStories}
                activeInterest={activeInterest}
                setActiveInterest={setActiveInterest}
                selectedId={effectiveSelectedId}
                onSelect={handleSelect}
                isItemLocked={isItemLocked}
                listScrollRef={listScrollRef}
              />
              {selectedItem && (
                <RightPane item={selectedItem} isItemLocked={isItemLocked} />
              )}
            </>
          ) : (
            <PulseTab hotTweets={hotTweets} discussions={discussions} tools={tools} />
          )}
        </div>
      </div>
    </div>
  );
}
