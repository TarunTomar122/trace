import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';
import {
  fetchFeedItemDetail,
  feedItemDetailSwrKey,
  type FeedItemDetailResponse,
} from '@/lib/feed-item-detail-client';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  PanelLeft,
  Rows3,
  Sparkles,
} from 'lucide-react';
import { getArticleImage } from '@/lib/fallback-images';
import { trackCheckoutClicked } from '@/lib/posthog';
import { ScrollFeedLoadingSkeleton } from './FeedBootShell';
import {
  BriefBody,
  ContentData,
  ContentPanel,
  FeedListItem,
  INTEREST_LABEL,
  MarkdownProse,
  StoryItem,
  getContentFromFeedListItem,
  getTimeLabel,
  getTodayLabel,
  isProductHuntWidget,
  looksLikeBriefBody,
  stripMarkdown,
} from './FeedUi';

type InterestTab = { id: string; label: string };

/** Reserved interest key: Pulse stream in briefing (scroll + split), before "For You" */
export const BRIEFING_PULSE_TAB_KEY = '__briefing_pulse__';

/** Compact = scroll feed; Split = classic two-pane (header control) */
export function BriefingLayoutToggle({
  layout,
  onChange,
}: {
  layout: 'panel' | 'scroll';
  onChange: (next: 'panel' | 'scroll') => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full bg-foreground/6 p-0.5"
      role="group"
      aria-label="Briefing layout"
    >
      {([
        { key: 'panel' as const, label: 'Split', Icon: PanelLeft },
        { key: 'scroll' as const, label: 'Compact', Icon: Rows3 },
      ] as const).map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-medium transition-colors ${
            layout === key
              ? 'bg-foreground text-background shadow-sm'
              : 'text-secondary/70 hover:text-foreground'
          }`}
        >
          <Icon size={13} strokeWidth={2} className="shrink-0 opacity-90" aria-hidden />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Deterministic hue from source name so each publication gets a consistent color */
function sourceHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

function SourceAvatar({ source }: { source?: string }) {
  const name = source || '?';
  // strip leading digits so "9to5Mac" → "9" avatar but with a nice color
  const letter = name.replace(/^\d+/, '')[0]?.toUpperCase() ?? name[0]?.toUpperCase() ?? '?';
  const hue = sourceHue(name);
  const bg = `hsl(${hue} 60% 92%)`;
  const fg = `hsl(${hue} 50% 35%)`;
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold select-none"
      style={{ background: bg, color: fg }}
    >
      {letter}
    </div>
  );
}

/** Avoid showing list preview + body twice when both map to the same summary (common for Pulse). */
function shouldShowExpandedPreview(preview: string, body: string | undefined | null): boolean {
  const p0 = preview.trim();
  if (!p0) return false;
  const b0 = (body || '').trim();
  if (!b0) return true;
  const stripTruncation = (s: string) => s.replace(/\u2026/g, '').replace(/\.\.\.\s*$/, '').trim();
  const p = collapseWsForDedupe(stripTruncation(p0));
  const b = collapseWsForDedupe(b0);
  if (!p) return true;
  if (b === p) return false;
  if (b.startsWith(p)) return false;
  if (p.length >= 32 && b.includes(p.slice(0, Math.min(160, p.length)))) return false;
  return true;
}

function collapseWsForDedupe(s: string): string {
  return stripMarkdown(s).replace(/\s+/g, ' ').trim().toLowerCase();
}

function listItemHasInlineFullContent(item: FeedListItem): boolean {
  if (item.type === 'article') {
    return Boolean((item.data as FeedItem).summary?.short_article?.body);
  }
  if (item.type === 'topic') {
    const topic = item.data as TrendingTopic;
    return Boolean(topic.key_points?.length || topic.timeline?.length);
  }
  return false;
}

function hydrateListItemFromDetail(
  item: FeedListItem,
  detail: FeedItemDetailResponse | null | undefined,
  matches: boolean,
): FeedListItem {
  if (!matches || !detail) return item;
  if (item.type === 'article' && detail.kind === 'article') {
    return { ...item, data: detail.item };
  }
  if (item.type === 'topic' && detail.kind === 'topic') {
    return { ...item, data: detail.item };
  }
  return item;
}

/** Nearest scrollable ancestor, or `window` when the document scrolls */
function getScrollableAncestor(el: HTMLElement | null): Window | HTMLElement {
  let cur: HTMLElement | null = el?.parentElement ?? null;
  while (cur) {
    const { overflowY } = getComputedStyle(cur);
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      cur.scrollHeight > cur.clientHeight + 1
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return typeof window !== 'undefined' ? window : (el?.ownerDocument?.defaultView as Window) ?? window;
}

/** Pro expand: visible “we’re fetching the full brief” state */
function ScrollFeedBodyLoading() {
  return (
    <div
      className="rounded-2xl border border-[#cfd9de] bg-[#f7f9f9]/80 p-4 dark:border-white/15 dark:bg-white/5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#536471] dark:text-[#8b98a5]">
        <Loader2 size={16} className="shrink-0 animate-spin text-[#1d9bf0]" aria-hidden />
        Fetching full brief…
      </div>
      <div className="mt-4 space-y-2.5" aria-hidden>
        <div className="h-3 w-full animate-pulse rounded-full bg-[#0f1419]/10 dark:bg-white/15" />
        <div className="h-3 w-[94%] animate-pulse rounded-full bg-[#0f1419]/10 dark:bg-white/15" />
        <div className="h-3 w-[88%] animate-pulse rounded-full bg-[#0f1419]/8 dark:bg-white/10" />
      </div>
    </div>
  );
}

/** Expanded scroll row: blurred “hidden” body + subscribe CTA for free users */
function ScrollFeedUnlockGate() {
  return (
    <div className="relative mt-1 overflow-hidden rounded-2xl border border-[#cfd9de] dark:border-white/15">
      <div
        className="pointer-events-none select-none space-y-2 px-4 pt-4 pb-24 opacity-50 blur-[5px] dark:opacity-40"
        aria-hidden
      >
        <div className="h-3 w-full rounded-full bg-[#0f1419]/20 dark:bg-white/25" />
        <div className="h-3 w-[92%] rounded-full bg-[#0f1419]/20 dark:bg-white/25" />
        <div className="h-3 w-full rounded-full bg-[#0f1419]/20 dark:bg-white/25" />
        <div className="h-3 w-[72%] rounded-full bg-[#0f1419]/20 dark:bg-white/25" />
        <div className="h-3 w-[88%] rounded-full bg-[#0f1419]/15 dark:bg-white/20" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background dark:via-background/60" />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <div className="rounded-2xl border border-[#cfd9de] bg-background/95 p-4 shadow-sm backdrop-blur-sm dark:border-white/15 dark:bg-background/90">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/8">
              <Lock size={16} className="text-foreground/70" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#0f1419] dark:text-[#f7f9f9]">
                Subscribe to unlock the full brief
              </p>
              <p className="mt-1 text-[14px] leading-snug text-[#536471] dark:text-[#8b98a5]">
                Full summaries, key takeaways, why it matters, and source links are included with Trace Pro.
              </p>
              <Link
                href="/profile?tab=subscription"
                prefetch={false}
                onClick={() => trackCheckoutClicked('feed_scroll_expand_unlock', {})}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
              >
                <Sparkles size={14} />
                Subscribe to unlock
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScrollFeedCard({
  item,
  expanded,
  onToggle,
  content,
  contentLoading,
  isFirst = false,
  isLocked = false,
  articleRef,
}: {
  item: FeedListItem;
  expanded: boolean;
  onToggle: () => void;
  content: ContentData | null;
  contentLoading: boolean;
  /** Tighter top padding so the list doesn’t double-gap under the tab bar */
  isFirst?: boolean;
  isLocked?: boolean;
  articleRef?: React.RefCallback<HTMLElement | null>;
}) {
  const imgUrl = item.thumbnail ? getArticleImage(item.thumbnail, item.title) : null;
  const showImg = imgUrl && !isProductHuntWidget(imgUrl);
  const isMultiSource = item.sourceCount > 1;
  const briefFmt = content?.body ? looksLikeBriefBody(content.body) : false;
  const hasRenderableDetail =
    Boolean(content?.body?.trim()) || Boolean(content?.keyPoints && content.keyPoints.length > 0);
  const showBodyLoader = contentLoading && !hasRenderableDetail;
  const rowTop = isFirst ? 'pt-5 sm:pt-7' : 'pt-5 sm:pt-6';
  /** One max height so expand doesn’t reflow the hero image upward */
  const heroMaxClass = 'max-h-[min(420px,55vh)]';

  const showPreviewWhenExpanded =
    !!item.preview &&
    (expanded ? shouldShowExpandedPreview(item.preview, content?.body) : true);

  return (
    <article
      ref={articleRef}
      className="border-b border-[#cfd9de] dark:border-white/[0.14] transition-colors duration-150 ease-out last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
    >
      {/* Headline + preview + hero stay in this column so “Show more” only grows downward */}
      <div
        onClick={onToggle}
        className={`flex gap-3 px-4 ${rowTop} cursor-pointer ${expanded ? 'pb-0' : 'pb-5 sm:pb-6'}`}
      >
        <div className="hidden sm:block shrink-0 pt-1" aria-hidden>
          <SourceAvatar source={item.source} />
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          {/* Source · time — quiet metadata; headline owns the hierarchy */}
          <div className="flex items-baseline gap-1 min-w-0 text-[12px] leading-4 font-normal text-[#536471] dark:text-[#8b98a5]">
            <span className="truncate">
              {item.source || 'Unknown'}
            </span>
            {isMultiSource && (
              <span className="shrink-0 opacity-90">
                · {item.sourceCount} sources
              </span>
            )}
            {item.timestamp && (
              <span className="shrink-0 opacity-90">
                · {getTimeLabel(item.timestamp)}
              </span>
            )}
          </div>

          {/* Headline */}
          <p className="text-[17px] font-bold text-[#0f1419] dark:text-[#f7f9f9] leading-snug tracking-[-0.01em]">
            {item.title}
          </p>

          {/* Preview — same slot; clamp when collapsed, full when expanded (hidden if body duplicates) */}
          {showPreviewWhenExpanded && (
            <p
              className={`text-[15px] text-[#0f1419]/90 dark:text-[#e7e9ea]/90 leading-normal ${
                expanded ? '' : 'line-clamp-3'
              }`}
            >
              {item.preview}
            </p>
          )}

          {/* Show more hint when collapsed */}
          {!expanded && (
            <span className="inline-block text-[15px] text-[#1d9bf0]">Show more</span>
          )}

          {/* Image — same slot collapsed + expanded so layout doesn’t jump up */}
          {showImg && (
            <div className="overflow-hidden rounded-2xl border border-[#cfd9de] dark:border-white/15">
              <img
                src={imgUrl!}
                alt=""
                loading="lazy"
                decoding="async"
                className={`w-full object-cover ${heroMaxClass}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Extra blocks only — appended below the stable header/preview/hero */}
      {expanded && (
        <div className={`flex gap-3 px-4 pb-5 sm:pb-6 ${isFirst ? 'pt-0' : 'pt-0.5'}`}>
          {/* Spacer matching avatar width (desktop only — hidden on mobile with avatar) */}
          <div className="hidden sm:block w-10 shrink-0" aria-hidden />

          <div className="flex min-w-0 flex-1 flex-col gap-4 pt-3 sm:pt-4">
            {!isLocked && (
              <>
                {showBodyLoader && <ScrollFeedBodyLoading />}

                {content?.body && (
                  <div className="text-[15px] text-[#0f1419] leading-[1.6] [&_p]:mb-3 [&_a]:text-[#1d9bf0] [&_a]:underline-offset-2 [&_a]:hover:underline dark:text-[#e7e9ea]">
                    {briefFmt ? (
                      <BriefBody body={content.body} />
                    ) : (
                      <div className="prose prose-sm max-w-none text-[#0f1419] dark:text-[#e7e9ea]">
                        <MarkdownProse body={content.body} />
                      </div>
                    )}
                  </div>
                )}

                {/* Key takeaways */}
                {content?.keyPoints && content.keyPoints.length > 0 && (
                  <div className="p-4 rounded-2xl border border-[#cfd9de] bg-[#f7f9f9] dark:border-white/15 dark:bg-white/5">
                    <p className="text-[13px] font-bold text-[#0f1419] uppercase tracking-wide mb-2.5 dark:text-[#f7f9f9]">Key Takeaways</p>
                    <div className="space-y-2">
                      {content.keyPoints.slice(0, 5).map((point, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-[#536471] font-mono text-[13px] mt-px shrink-0 dark:text-[#8b98a5]">{i + 1}.</span>
                          <p className="text-[14px] text-[#0f1419] leading-[1.5] dark:text-[#e7e9ea]">{stripMarkdown(point)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Original source — subtle, X-style card link */}
                {content?.url && (
                  <a
                    href={content.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-[#cfd9de] hover:bg-[#f7f9f9] transition-colors dark:border-white/15 dark:hover:bg-white/5"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#eff3f4] flex items-center justify-center shrink-0 dark:bg-white/10">
                      <ExternalLink size={16} className="text-[#536471]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#536471] truncate">{(() => { try { return new URL(content.url).hostname.replace('www.',''); } catch { return 'Source'; } })()}</p>
                      <p className="text-[15px] text-[#0f1419] font-normal truncate dark:text-[#e7e9ea]">Read original article</p>
                    </div>
                  </a>
                )}
              </>
            )}

            {isLocked && <ScrollFeedUnlockGate />}

            {/* Show less */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="text-left text-[15px] text-[#1d9bf0] hover:underline"
            >
              Show less
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function ScrollFeedInterestTabs({
  activeFilter,
  interestTabs,
  filterCounts,
  setActiveFilter,
  storyCount,
  showPulseTab,
}: {
  activeFilter: string;
  interestTabs: InterestTab[];
  filterCounts: Record<string, number>;
  setActiveFilter: (v: string) => void;
  storyCount: number;
  showPulseTab: boolean;
}) {
  const tabs = [
    ...(showPulseTab ? [{ key: BRIEFING_PULSE_TAB_KEY, label: 'Pulse', pulseAccent: true as const }] : []),
    { key: 'for_you', label: 'For You' as const, pulseAccent: false as const },
    ...interestTabs.map((t) => ({ key: t.id, label: t.label, pulseAccent: false as const })),
    { key: 'suggested', label: 'Suggested' as const, pulseAccent: false as const },
  ];

  return (
    <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-border/20 bg-background/80 backdrop-blur-xl">
      <div className="px-4 sm:px-6 lg:px-8 pt-0.5 pb-0">
        <p className="text-center text-[12px] text-secondary/55 mb-0.5 leading-tight">
          {getTodayLabel()}
          {storyCount > 0 ? ` · ${storyCount} stories` : ''}
        </p>
      </div>
      <div className="min-w-0 max-w-full overflow-x-auto overflow-y-hidden scrollbar-hide pb-0.5 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        {/* min-w-full + justify-center: centered on desktop when tabs fit; w-max: grow for horizontal scroll on small screens */}
        <div className="flex w-max min-w-full justify-center">
          <div className="inline-flex shrink-0 px-4 sm:px-6 lg:px-8">
            {tabs.map(({ key, label, pulseAccent }) => {
              const selected = activeFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFilter(key)}
                  className={`relative shrink-0 px-3.5 py-2 text-[15px] font-medium whitespace-nowrap transition-colors ${
                    pulseAccent
                      ? selected
                        ? 'font-bold text-foreground'
                        : 'text-amber-800/80 dark:text-amber-400/90 hover:text-foreground'
                      : selected
                        ? 'font-bold text-foreground'
                        : 'text-secondary/65 hover:text-foreground'
                  }`}
                >
                  {label}
                  {key !== BRIEFING_PULSE_TAB_KEY && (filterCounts[key] || 0) > 0 && (
                    <span className={`ml-1 text-[13px] font-normal ${selected ? 'text-secondary/55' : 'text-secondary/45'}`}>
                      {filterCounts[key]}
                    </span>
                  )}
                  {selected && (
                    <span
                      className={`absolute bottom-0 left-1/2 h-[3px] w-12 -translate-x-1/2 rounded-full ${
                        pulseAccent ? 'bg-amber-600 dark:bg-amber-500' : 'bg-foreground'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScrollFeedCardWithDetail({
  item,
  expanded,
  onToggle,
  isFirst,
  isLocked,
  articleRef,
}: {
  item: FeedListItem;
  expanded: boolean;
  onToggle: () => void;
  isFirst: boolean;
  isLocked: boolean;
  articleRef: (node: HTMLElement | null) => void;
}) {
  const inlineFull = listItemHasInlineFullContent(item);
  const shouldFetch = expanded && !isLocked && !inlineFull;
  const { data: detail, isLoading } = useSWR(
    shouldFetch ? feedItemDetailSwrKey(item.id) : null,
    () => fetchFeedItemDetail(item.id),
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 300000 },
  );
  const detailMatchesId = Boolean(detail?.item.id === item.id);

  const hydrated = useMemo(() => {
    if (!expanded || isLocked) return item;
    if (inlineFull) return item;
    return hydrateListItemFromDetail(item, detail, detailMatchesId);
  }, [item, detail, detailMatchesId, inlineFull, expanded, isLocked]);

  const content = useMemo(() => {
    if (!expanded || isLocked) return null;
    return getContentFromFeedListItem(hydrated);
  }, [expanded, isLocked, hydrated]);

  const needsDetail = expanded && !isLocked && !inlineFull;
  const contentLoading = needsDetail && (isLoading || !detailMatchesId);

  return (
    <ScrollFeedCard
      item={item}
      expanded={expanded}
      onToggle={onToggle}
      content={content}
      contentLoading={contentLoading}
      isFirst={isFirst}
      isLocked={isLocked}
      articleRef={articleRef}
    />
  );
}

function ScrollFeedPosts({
  filteredList,
  isLoading,
  onSelect,
  activeFilter,
  isLocked,
}: {
  filteredList: FeedListItem[];
  isLoading: boolean;
  onSelect: (id: string) => void;
  activeFilter: string;
  isLocked: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const cardElByIdRef = useRef<Map<string, HTMLElement>>(new Map());
  const expandScrollPreserveRef = useRef<{
    id: string;
    beforeTop: number;
    root: Window | HTMLElement;
  } | null>(null);

  const handleToggle = (id: string) => {
    if (expandedIds.has(id)) {
      expandScrollPreserveRef.current = null;
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    const el = cardElByIdRef.current.get(id);
    if (el) {
      expandScrollPreserveRef.current = {
        id,
        beforeTop: el.getBoundingClientRect().top,
        root: getScrollableAncestor(el),
      };
    } else {
      expandScrollPreserveRef.current = null;
    }
    onSelect(id);
    setExpandedIds((prev) => new Set(prev).add(id));
  };

  useLayoutEffect(() => {
    const job = expandScrollPreserveRef.current;
    if (!job || !expandedIds.has(job.id)) return;
    expandScrollPreserveRef.current = null;
    const el = cardElByIdRef.current.get(job.id);
    if (!el) return;
    const afterTop = el.getBoundingClientRect().top;
    /** Keep the card’s top edge pinned in the viewport (undo scroll anchoring / layout jumps). */
    const delta = afterTop - job.beforeTop;
    if (Math.abs(delta) < 0.5) return;
    if (job.root === window) {
      window.scrollTo(0, window.scrollY + delta);
    } else {
      (job.root as HTMLElement).scrollTop += delta;
    }
  }, [expandedIds, filteredList]);

  if (isLoading) {
    return <ScrollFeedLoadingSkeleton rows={6} embedded />;
  }

  if (filteredList.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-[15px] text-secondary/55">
          {activeFilter === BRIEFING_PULSE_TAB_KEY ? 'Nothing in your pulse yet' : 'Nothing here yet'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {filteredList.map((item, index) => (
        <ScrollFeedCardWithDetail
          key={item.id}
          item={item}
          expanded={expandedIds.has(item.id)}
          onToggle={() => handleToggle(item.id)}
          isFirst={index === 0}
          isLocked={isLocked}
          articleRef={(node) => {
            if (node) cardElByIdRef.current.set(item.id, node);
            else cardElByIdRef.current.delete(item.id);
          }}
        />
      ))}
    </div>
  );
}

type FeedBriefingViewProps = {
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  storyCount: number;
  interestTabs: InterestTab[];
  filterCounts: Record<string, number>;
  activeFilter: string;
  setActiveFilter: (value: string) => void;
  isLoading: boolean;
  isContentLoading: boolean;
  isContentRefreshing: boolean;
  filteredList: FeedListItem[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  selectedContent: ContentData | null;
  isLocked: boolean;
  lockedStory: FeedListItem | null;
  mobileContentList: FeedListItem[];
  showMobileContent: boolean;
  openMobileArticle: (id: string) => void;
  closeMobileArticle: () => void;
  briefingLayout: 'panel' | 'scroll';
  showPulseTab: boolean;
};

function LockedStoryPanel({ story }: { story: FeedListItem }) {
  const imageUrl = story.thumbnail ? getArticleImage(story.thumbnail, story.title) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border/20 bg-foreground/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-secondary/60">
          <Lock size={12} />
          Subscriber story
        </div>
        <h2 className="text-[2rem] font-bold tracking-[-0.03em] text-foreground">
          {story.title}
        </h2>
        {story.preview && (
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-secondary/65">
            {story.preview}
          </p>
        )}
        <div className="mt-4 text-[12px] text-secondary/45">
          {[story.source, story.timestamp, story.sourceCount > 0 ? `${story.sourceCount} sources` : null]
            .filter(Boolean)
            .join(' · ')}
        </div>

        {imageUrl && (
          <div className="mt-8 overflow-hidden rounded-3xl border border-border/15 bg-surface-secondary/40">
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className={
                isProductHuntWidget(imageUrl)
                  ? 'mx-auto max-w-[320px] rounded-2xl bg-white p-6'
                  : 'h-[260px] w-full object-cover'
              }
            />
          </div>
        )}

        <div className="mt-8 max-w-xl rounded-3xl border border-border/15 bg-surface-secondary/30 p-6">
          <p className="text-base font-semibold text-foreground">
            Subscribe to unlock the full brief
          </p>
          <p className="mt-2 text-sm leading-6 text-secondary/60">
            Get the summary, why it matters, key takeaways, and the source links for every story in your feed.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/profile?tab=subscription"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
            >
              <Sparkles size={14} />
              Subscribe to unlock
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeedBriefingView({
  isExpanded,
  setIsExpanded,
  storyCount,
  interestTabs,
  filterCounts,
  activeFilter,
  setActiveFilter,
  isLoading,
  isContentLoading,
  isContentRefreshing,
  filteredList,
  selectedId,
  setSelectedId,
  selectedContent,
  isLocked,
  lockedStory,
  mobileContentList,
  showMobileContent,
  openMobileArticle,
  closeMobileArticle,
  briefingLayout,
  showPulseTab,
}: FeedBriefingViewProps) {
  if (briefingLayout === 'scroll') {
    return (
      <>
        <ScrollFeedInterestTabs
          activeFilter={activeFilter}
          interestTabs={interestTabs}
          filterCounts={filterCounts}
          setActiveFilter={setActiveFilter}
          storyCount={storyCount}
          showPulseTab={showPulseTab}
        />
        <div
          className="mx-auto w-full max-w-[min(43rem,100%)] min-h-[calc(100vh-11rem)]"
          style={{ overflowAnchor: 'none' }}
        >
          <ScrollFeedPosts
            filteredList={filteredList}
            isLoading={isLoading}
            onSelect={setSelectedId}
            activeFilter={activeFilter}
            isLocked={isLocked}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className={`hidden md:block ${isExpanded ? 'fixed inset-0 z-60 bg-background p-0' : ''}`}>
        <div
          className={`flex bg-white overflow-hidden ${isExpanded ? 'h-full' : 'rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}
          style={isExpanded ? undefined : { height: 'calc(100vh - 120px)', minHeight: '500px' }}
        >
          <div className="w-[340px] shrink-0 border-r border-border/20 flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-border/20">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-foreground tracking-[-0.01em]">News</h2>
                <button
                  onClick={() => setIsExpanded((current) => !current)}
                  className="p-1.5 rounded-lg text-secondary/40 hover:text-foreground hover:bg-surface-secondary transition-colors"
                  title={isExpanded ? 'Exit full screen (Esc)' : 'Full screen'}
                >
                  {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
              <p className="text-[12px] text-secondary/55 mt-0.5 mb-3">
                {getTodayLabel()}
                {storyCount > 0 ? ` · ${storyCount} stories` : ''}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  ...(showPulseTab ? [{ key: BRIEFING_PULSE_TAB_KEY, label: 'Pulse', pulseAccent: true as const }] : []),
                  { key: 'for_you', label: 'For You', pulseAccent: false as const },
                  ...interestTabs.map((item) => ({ key: item.id, label: item.label, pulseAccent: false as const })),
                  { key: 'suggested', label: 'Suggested', pulseAccent: false as const },
                ]).map(({ key, label, pulseAccent }) => (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                      pulseAccent
                        ? activeFilter === key
                          ? 'bg-amber-600 text-white'
                          : 'border border-amber-500/35 bg-amber-500/5 text-amber-900/85 dark:text-amber-200/90 hover:border-amber-500/50 hover:bg-amber-500/10'
                        : activeFilter === key
                          ? 'bg-foreground text-background'
                          : 'bg-foreground/8 text-secondary/70 hover:bg-foreground/12 hover:text-secondary/90'
                    }`}
                  >
                    {label}
                    {key !== BRIEFING_PULSE_TAB_KEY && (filterCounts[key] || 0) > 0 ? ` (${filterCounts[key]})` : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/10">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-secondary/40" />
                </div>
              ) : filteredList.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm text-secondary/55">
                    {activeFilter === BRIEFING_PULSE_TAB_KEY
                      ? 'Nothing in your pulse yet'
                      : activeFilter === 'suggested'
                        ? 'No suggested stories right now'
                        : activeFilter === 'for_you'
                          ? 'No stories matching your interests'
                          : `No stories for ${INTEREST_LABEL[activeFilter] || activeFilter} yet`}
                  </p>
                </div>
              ) : (
                filteredList.map((item) => (
                  <StoryItem
                    key={item.id}
                    title={item.title}
                    preview={item.preview}
                    timestamp={item.timestamp}
                    source={item.source}
                    sourceCount={item.sourceCount}
                    tag={item.interestId}
                    thumbnail={item.thumbnail}
                    selected={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  />
                ))
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-secondary/40" />
            </div>
          ) : isLocked && lockedStory ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <LockedStoryPanel story={lockedStory} />
            </div>
          ) : selectedContent ? (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <ContentPanel content={selectedContent} isLoadingDetail={isContentLoading || isContentRefreshing} />
            </div>
          ) : isContentLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-secondary/40" />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-secondary/40 text-sm">Select a story to read</p>
            </div>
          )}
        </div>
      </div>

      {showMobileContent && (selectedContent || (isLocked && lockedStory)) && (() => {
        const story = lockedStory;
        const currentIdx = mobileContentList.findIndex((item) => item.id === selectedId);
        const nextItem = currentIdx >= 0 && currentIdx < mobileContentList.length - 1
          ? mobileContentList[currentIdx + 1]
          : null;
        const imageUrl = (selectedContent?.thumbnail || story?.thumbnail)
          ? getArticleImage(selectedContent?.thumbnail || story?.thumbnail || null, selectedContent?.title || story?.title || '')
          : null;
        const briefFmt = selectedContent?.body ? looksLikeBriefBody(selectedContent.body) : false;

        return (
          <div className="fixed inset-0 z-[70] bg-background overflow-y-auto md:hidden">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/10 flex items-center gap-2 px-4 py-3">
              <button
                onClick={closeMobileArticle}
                className="p-1.5 -ml-1.5 rounded-lg text-foreground/60 active:bg-foreground/8"
              >
                <ArrowLeft size={20} />
              </button>
              <span className="text-[13px] text-secondary/50 truncate flex-1">
                {[
                  selectedContent?.source || story?.source,
                  selectedContent?.countLabel || (story?.sourceCount ? `${story.sourceCount} sources` : null),
                ].filter(Boolean).join(' · ')}
                {selectedContent?.readingTime ? ` · ${selectedContent.readingTime} min read` : ''}
              </span>
            </div>

            <div className="px-5 pt-5 pb-12">
              <h1 className="text-[1.35rem] font-bold text-foreground leading-tight tracking-[-0.02em] mb-4">
                {selectedContent?.title || story?.title}
              </h1>

              {imageUrl && (
                <div className="mb-6">
                  <img
                    src={imageUrl}
                    alt=""
                    decoding="async"
                    className={
                      isProductHuntWidget(imageUrl)
                        ? 'max-w-[280px] rounded-2xl border border-[#ff6154]/20 bg-white'
                        : 'w-full max-h-[240px] object-cover rounded-[18px]'
                    }
                  />
                </div>
              )}

              {isLocked && story ? (
                <div className="rounded-[28px] border border-border/15 bg-surface-secondary/30 p-5">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/20 bg-foreground/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-secondary/60">
                    <Lock size={12} />
                    Subscriber story
                  </div>
                  {story.preview && (
                    <p className="text-[14px] leading-7 text-secondary/65">{story.preview}</p>
                  )}
                  <p className="mt-5 text-[14px] font-semibold text-foreground">Subscribe to unlock the full brief</p>
                  <p className="mt-1 text-[13px] leading-6 text-secondary/60">
                    Read the summary, key points, and source links for this story and the rest of your feed.
                  </p>
                  <Link
                    href="/profile?tab=subscription"
                    prefetch={false}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
                  >
                    <Sparkles size={14} />
                    Subscribe to unlock
                  </Link>
                </div>
              ) : isContentLoading && !selectedContent?.body ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-secondary/40" />
                </div>
              ) : (
                <>
                  {isContentLoading && (
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/20 bg-foreground/5 px-3 py-1.5 text-[11px] font-medium text-secondary/60">
                      <Loader2 size={11} className="animate-spin" />
                      <span>Loading full article</span>
                    </div>
                  )}
                  {selectedContent?.body && (
                    <div className="mb-6 text-secondary leading-relaxed">
                      {briefFmt ? (
                        <BriefBody body={selectedContent.body} />
                      ) : (
                        <div className="prose prose-sm max-w-none text-secondary">
                          <MarkdownProse body={selectedContent.body} />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedContent?.keyPoints && selectedContent.keyPoints.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-[10px] font-semibold text-secondary/50 mb-3 uppercase tracking-[0.18em]">Key takeaways</h3>
                      <div className="space-y-2">
                        {selectedContent.keyPoints.slice(0, 4).map((point, index) => (
                          <div key={index} className="flex gap-2.5">
                            <span className="text-secondary/35 font-mono text-xs mt-0.5">{index + 1}.</span>
                            <p className="text-[14px] text-secondary/80 leading-relaxed">{stripMarkdown(point)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedContent?.url && (
                    <a
                      href={selectedContent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-foreground text-background"
                    >
                      Read original source
                      <ExternalLink size={13} />
                    </a>
                  )}
                </>
              )}

              {nextItem && (
                <div className="mt-10 pt-6 border-t border-border/15">
                  <button
                    onClick={() => {
                      setSelectedId(nextItem.id);
                      window.history.replaceState({ article: nextItem.id }, '');
                      window.scrollTo(0, 0);
                    }}
                    className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-foreground/5 active:bg-foreground/10"
                  >
                    <div className="text-left">
                      <p className="text-[10px] font-semibold text-secondary/40 uppercase tracking-[0.15em] mb-1">Next</p>
                      <p className="text-[14px] font-semibold text-foreground leading-snug line-clamp-2">{nextItem.title}</p>
                    </div>
                    <ArrowRight size={18} className="shrink-0 ml-3 text-foreground/40" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="md:hidden bg-background">
        <div className="px-5 pt-6 pb-4">
          <p className="text-[10px] font-semibold text-secondary/40 uppercase tracking-[0.2em] mb-1">{getTodayLabel()}</p>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-[1.6rem] font-bold text-foreground tracking-[-0.025em] leading-tight">News</h1>
              {storyCount > 0 && <span className="text-[12px] text-secondary/45 mb-0.5">{storyCount} stories</span>}
            </div>
          </div>
        </div>

        <div className="min-w-0 max-w-full overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-border/15 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <div className="inline-flex w-max max-w-none items-center gap-2 px-5 pb-3">
            {([
              { key: 'for_you', label: 'For You' },
              ...interestTabs.map((item) => ({ key: item.id, label: item.label })),
              { key: 'suggested', label: 'Suggested' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                  activeFilter === key ? 'bg-foreground text-background' : 'bg-foreground/8 text-secondary/70'
                }`}
              >
                {label}
                {(filterCounts[key] || 0) > 0 ? ` (${filterCounts[key]})` : ''}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-secondary/40" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-secondary/55">
              {activeFilter === 'suggested'
                ? 'No suggested stories right now'
                : activeFilter === 'for_you'
                  ? 'No stories matching your interests'
                  : `No stories for ${INTEREST_LABEL[activeFilter] || activeFilter} yet`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {filteredList.map((item) => (
              <StoryItem
                key={item.id}
                title={item.title}
                preview={item.preview}
                timestamp={item.timestamp}
                source={item.source}
                sourceCount={item.sourceCount}
                tag={item.interestId}
                thumbnail={item.thumbnail}
                selected={false}
                onClick={() => openMobileArticle(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
