import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import type { FeedItem, TrendingTopic } from '@/lib/firestore';
import {
  fetchFeedItemDetail,
  feedItemDetailSwrKey,
  type FeedItemDetailResponse,
} from '@/lib/feed-item-detail-client';
import Link from 'next/link';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Flame,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  PanelLeft,
  Rows3,
  Share2,
  Sparkles,
} from 'lucide-react';
import { getArticleImage } from '@/lib/fallback-images';
import { trackCheckoutClicked } from '@/lib/posthog';
import { ScrollFeedLoadingSkeleton } from './FeedBootShell';
import { FreeBlurGate } from './FeedPaywall';
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
  PulseDiscussionCard,
  PulseReadCard,
  PulseReadHero,
  PulseSectionHeader,
  PulseToolCard,
  stripMarkdown,
} from './FeedUi';

type InterestTab = { id: string; label: string };

/** CTA to public daily archive; shows loading while App Router navigates. */
function BrowsePastDaysCta({ className = '', textAlign: ta = 'center' }: { className?: string; textAlign?: 'left' | 'center' }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <div className={ta === 'center' ? `text-center ${className}`.trim() : className}>
      <p className="text-[13px] font-semibold text-foreground/90">Older stories and past days</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-secondary/55">Browse saved daily roundups in the public archive.</p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => router.push('/daily'))}
        className="mt-4 inline-flex h-10 min-w-[9.5rem] items-center justify-center gap-2 rounded-full border border-border/25 bg-foreground/[0.04] px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground/10 disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending ? <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden /> : <Archive size={16} className="shrink-0 text-secondary/60" aria-hidden />}
        {isPending ? 'Opening…' : 'Browse past days'}
      </button>
    </div>
  );
}

/** Reserved interest key: Pulse stream in briefing (scroll + split), before "For You" */
export const BRIEFING_PULSE_TAB_KEY = '__briefing_pulse__';

/** Hot Tweets tab key — replaces Pulse in scroll layout tabs */
export const HOT_TWEETS_TAB_KEY = '__hot_tweets__';

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

/** Pro expand: visible “we're fetching the full brief” state */
function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
      }}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border border-border/30 text-foreground hover:bg-foreground/5 transition-colors"
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Share2 size={14} />}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}

function ArticleContentSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-6 sm:px-8 lg:px-10 py-6 sm:py-8 animate-pulse">
      {/* Meta bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-2.5 w-16 rounded-full bg-foreground/8 dark:bg-white/10" />
        <div className="h-2.5 w-12 rounded-full bg-foreground/6 dark:bg-white/8" />
        <div className="h-2.5 w-20 rounded-full bg-foreground/6 dark:bg-white/8" />
      </div>
      {/* Title */}
      <div className="space-y-2.5 mb-6">
        <div className="h-6 w-[85%] rounded-lg bg-foreground/10 dark:bg-white/12" />
        <div className="h-6 w-[60%] rounded-lg bg-foreground/8 dark:bg-white/10" />
      </div>
      {/* Subtitle */}
      <div className="h-4 w-[70%] rounded-md bg-foreground/6 dark:bg-white/8 mb-8" />
      {/* Body lines */}
      <div className="space-y-3">
        <div className="h-3.5 w-full rounded-md bg-foreground/6 dark:bg-white/7" />
        <div className="h-3.5 w-[97%] rounded-md bg-foreground/6 dark:bg-white/7" />
        <div className="h-3.5 w-[92%] rounded-md bg-foreground/5 dark:bg-white/6" />
        <div className="h-3.5 w-full rounded-md bg-foreground/5 dark:bg-white/6" />
        <div className="h-3.5 w-[88%] rounded-md bg-foreground/5 dark:bg-white/6" />
        <div className="h-3.5 w-[75%] rounded-md bg-foreground/4 dark:bg-white/5" />
      </div>
      {/* Key takeaways block */}
      <div className="mt-8 rounded-xl border border-foreground/6 dark:border-white/8 p-5">
        <div className="h-3 w-28 rounded-full bg-foreground/8 dark:bg-white/10 mb-4" />
        <div className="space-y-2.5">
          <div className="h-3 w-[90%] rounded-md bg-foreground/5 dark:bg-white/6" />
          <div className="h-3 w-[80%] rounded-md bg-foreground/4 dark:bg-white/5" />
          <div className="h-3 w-[85%] rounded-md bg-foreground/4 dark:bg-white/5" />
        </div>
      </div>
    </div>
  );
}


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

/** Expanded scroll row: blurred preview + subscribe CTA when content is locked */
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
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-200/90">
            <Sparkles size={11} />
            Trace Pro
          </div>
          <p className="text-[16px] font-bold text-[#0f1419] dark:text-[#f7f9f9]">
            Unlock the full brief
          </p>
          <p className="mt-1 text-[14px] leading-snug text-[#536471] dark:text-[#8b98a5]">
            Get key takeaways, why it matters, and source links for every story.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-secondary/70">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
              <Check size={12} className="text-emerald-600/80" />
              Daily signal
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
              <Check size={12} className="text-emerald-600/80" />
              No fluff
            </span>
          </div>
          <Link
            href="/profile?tab=subscription"
            prefetch={false}
            onClick={() => trackCheckoutClicked('feed_scroll_expand_unlock')}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
          >
            <Sparkles size={14} />
            Subscribe
          </Link>
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
  /** Tighter top padding so the list doesn't double-gap under the tab bar */
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
  /** One max height so expand doesn't reflow the hero image upward */
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

          {/* Image — same slot collapsed + expanded so layout doesn't jump up */}
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

                {/* Actions row — share + original source */}
                {(content?.shareUrl || content?.url) && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <ShareButton url={content.shareUrl || content.url!} />
                    {content?.url && (
                      <a
                        href={content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-3 flex-1 min-w-0 p-3 rounded-2xl border border-[#cfd9de] hover:bg-[#f7f9f9] transition-colors dark:border-white/15 dark:hover:bg-white/5"
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
                  </div>
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

type HotTweetItemProps = {
  tweet: { id: string; title: string; url: string; description: string; pubDate: string };
  compact?: boolean;
};

function HotTweetItem({ tweet, compact }: HotTweetItemProps) {
  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block ${compact ? 'py-3' : 'py-3.5 px-2 -mx-2'} rounded-lg hover:bg-foreground/[0.04] transition-colors border-b border-border/15 last:border-b-0`}
    >
      <h4 className={`font-semibold text-foreground leading-snug tracking-[-0.01em] ${compact ? 'text-[15px]' : 'text-[14px] line-clamp-2'}`}>
        {tweet.title}
      </h4>
      {compact && tweet.description && (
        <p className="text-secondary/75 leading-relaxed mt-1 text-[13px]">
          {tweet.description}
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-1">
        <span className={`text-secondary/50 ${compact ? 'text-[11px]' : 'text-[10px]'}`}>
          {getTimeLabel(tweet.pubDate)}
        </span>
        <span className="text-secondary/25 text-[10px]">·</span>
        <span className={`font-medium ${compact ? 'text-[11px]' : 'text-[10px]'} text-[#1d9bf0]`}>
          View on X
        </span>
      </div>
    </a>
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
    ...(showPulseTab ? [{ key: BRIEFING_PULSE_TAB_KEY, label: 'Pulse', pulseAccent: true as const, hotTweetsAccent: false as const }] : []),
    { key: 'for_you', label: 'For You' as const, pulseAccent: false as const, hotTweetsAccent: false as const },
    ...interestTabs.map((t) => ({ key: t.id, label: t.label, pulseAccent: false as const, hotTweetsAccent: false as const })),
    { key: 'suggested', label: 'Suggested' as const, pulseAccent: false as const, hotTweetsAccent: false as const },
  ];

  return (
    <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-border/20 bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-0">
        <p className="text-center text-[11px] text-secondary/55 mb-0 leading-tight">
          {getTodayLabel()}
          {storyCount > 0 ? ` · ${storyCount} stories` : ''}
        </p>
      </div>
      <div className="min-w-0 max-w-full overflow-x-auto overflow-y-hidden scrollbar-hide pb-0 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]">
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
                  className={`relative shrink-0 px-3.5 py-1.5 text-[15px] font-medium whitespace-nowrap transition-colors ${
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

/* ─── Desktop Editorial Layout (lg+) ─── */

function EditorialHeroCard({ item }: { item: FeedListItem }) {
  const imgUrl = item.thumbnail ? getArticleImage(item.thumbnail, item.title) : null;
  const showImg = imgUrl && !isProductHuntWidget(imgUrl);
  const isMultiSource = item.sourceCount > 1;

  return (
    <article className="group">
      {showImg && (
        <div className="overflow-hidden rounded-xl mb-4">
          <img
            src={imgUrl!}
            alt=""
            loading="eager"
            decoding="async"
            className="w-full h-[320px] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
      )}
      <div className="flex items-center gap-1.5 text-[11px] text-secondary/55 mb-2">
        {item.source && <span className="font-medium uppercase tracking-[0.08em]">{item.source}</span>}
        {item.timestamp && (
          <>
            <span className="text-secondary/30">·</span>
            <span>{getTimeLabel(item.timestamp)}</span>
          </>
        )}
        {isMultiSource && (
          <>
            <span className="text-secondary/30">·</span>
            <span>{item.sourceCount} sources</span>
          </>
        )}
      </div>
      <h2 className="text-[1.65rem] font-bold text-foreground leading-[1.18] tracking-[-0.025em] mb-2">
        {item.title}
      </h2>
      {item.preview && (
        <p className="text-[15px] text-secondary/70 leading-relaxed line-clamp-3">
          {item.preview}
        </p>
      )}
    </article>
  );
}

function EditorialMediumCard({ item }: { item: FeedListItem }) {
  const imgUrl = item.thumbnail ? getArticleImage(item.thumbnail, item.title) : null;
  const showImg = imgUrl && !isProductHuntWidget(imgUrl);
  const isMultiSource = item.sourceCount > 1;

  return (
    <article className="group">
      {showImg && (
        <div className="overflow-hidden rounded-lg mb-3">
          <img
            src={imgUrl!}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-[180px] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
      )}
      <div className="flex items-center gap-1.5 text-[10px] text-secondary/50 mb-1.5">
        {item.source && <span className="font-medium uppercase tracking-[0.08em]">{item.source}</span>}
        {isMultiSource && (
          <>
            <span className="text-secondary/30">·</span>
            <span>{item.sourceCount} sources</span>
          </>
        )}
      </div>
      <h3 className="min-h-[3.9rem] text-[15px] font-bold text-foreground leading-snug tracking-[-0.01em] mb-1 line-clamp-3">
        {item.title}
      </h3>
      {item.preview && (
        <p className="text-[13px] text-secondary/60 leading-relaxed line-clamp-2">
          {item.preview}
        </p>
      )}
    </article>
  );
}

function EditorialSidebarItem({
  item,
  showDivider = true,
}: {
  item: FeedListItem;
  showDivider?: boolean;
}) {
  const isMultiSource = item.sourceCount > 1;

  return (
    <article className={`py-3.5 ${showDivider ? 'border-b border-border/15' : ''}`}>
      <h4 className="text-[14px] font-semibold text-foreground leading-snug tracking-[-0.01em] mb-1.5 line-clamp-3">
        {item.title}
      </h4>
      <div className="flex items-center gap-1.5 text-[10px] text-secondary/50">
        {item.source && <span className="truncate max-w-[120px]">{item.source}</span>}
        {isMultiSource && (
          <>
            <span className="text-secondary/25">·</span>
            <span className="shrink-0">{item.sourceCount} sources</span>
          </>
        )}
        {item.timestamp && (
          <>
            <span className="text-secondary/25">·</span>
            <span className="shrink-0">{getTimeLabel(item.timestamp)}</span>
          </>
        )}
      </div>
    </article>
  );
}

function DesktopEditorialLayout({
  filteredList,
  isLoading,
  onSelect,
  activeFilter,
  isLocked,
  hotTweets,
}: {
  filteredList: FeedListItem[];
  isLoading: boolean;
  onSelect: (id: string) => void;
  activeFilter: string;
  isLocked: boolean | ((itemId: string) => boolean);
  hotTweets: { id: string; title: string; url: string; description: string; pubDate: string; category: string }[];
}) {
  if (isLoading) {
    return <ScrollFeedLoadingSkeleton editorial />;
  }

  if (filteredList.length === 0) {
    return (
      <div className="px-4 pb-12">
        <p className="py-10 text-center text-[15px] text-secondary/55">
          {activeFilter === BRIEFING_PULSE_TAB_KEY ? 'Nothing in your pulse yet' : 'Nothing here yet'}
        </p>
        <BrowsePastDaysCta className="pt-2" />
      </div>
    );
  }

  // Split list: topics go center, articles go to sidebars
  const topics = filteredList.filter((item) => item.type === 'topic');
  const articles = filteredList.filter((item) => item.type === 'article');

  // If no topics, promote first few articles to center
  const heroItem = topics[0] || articles[0] || null;
  const centerGrid = topics.length > 0
    ? topics.slice(1, 5)
    : articles.slice(1, 5);

  // Remaining go to right sidebar
  const usedIds = new Set([
    heroItem?.id,
    ...centerGrid.map((item) => item.id),
  ].filter(Boolean));
  const remaining = filteredList.filter((item) => !usedIds.has(item.id));

  return (
    <>
    <div className="grid grid-cols-[minmax(200px,1fr)_minmax(0,2.2fr)_minmax(200px,1fr)] gap-8 pt-6 pb-8">
      {/* Left sidebar — Hot Tweets */}
      <aside className="min-w-0">
        <div className="mb-4 flex items-center gap-2">
          <Flame size={13} className="shrink-0 text-orange-500" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700 dark:text-orange-400">
            Hot Tweets
          </span>
          <div className="flex-1 h-px bg-border/25" />
        </div>
        {hotTweets.length > 0 ? (
          <div>
            {(isLocked ? hotTweets.slice(0, 3) : hotTweets).map((tweet) => (
              <HotTweetItem key={tweet.id} tweet={tweet} />
            ))}
            {isLocked && <FreeBlurGate hiddenCount={Math.max(0, hotTweets.length - 3)} noun="tweets" />}
          </div>
        ) : (
          <p className="text-[13px] text-secondary/40 py-4">More stories coming soon</p>
        )}
      </aside>

      {/* Center — hero + grid */}
      <main className="min-w-0">
        {heroItem && (
          <button
            type="button"
            onClick={() => onSelect(heroItem.id)}
            className="block w-full text-left mb-8 hover:opacity-95 transition-opacity"
          >
            <EditorialHeroCard item={heroItem} />
          </button>
        )}
        {centerGrid.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-6">
              {(isLocked ? centerGrid.slice(0, 2) : centerGrid).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="block w-full text-left hover:opacity-95 transition-opacity"
                >
                  <EditorialMediumCard item={item} />
                </button>
              ))}
            </div>
            {isLocked && <FreeBlurGate hiddenCount={Math.max(0, centerGrid.length - 2 + remaining.length)} noun="stories" />}
          </>
        )}
      </main>

      {/* Right sidebar — Trending Stories (includes remaining items) */}
      <aside className="min-w-0">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/60">
            Trending Stories
          </span>
          <div className="flex-1 h-px bg-border/25" />
        </div>
        <div>
          {(isLocked ? remaining.slice(0, 3) : remaining.slice(0, 10)).map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="block w-full text-left hover:bg-foreground/[0.03] -mx-2 px-2 rounded-lg transition-colors"
            >
              <EditorialSidebarItem
                item={item}
                showDivider={i < (isLocked ? Math.min(remaining.length, 3) : remaining.length) - 1}
              />
            </button>
          ))}
          {isLocked && <FreeBlurGate hiddenCount={Math.max(0, remaining.length - 3)} noun="stories" />}
          {remaining.length === 0 && (
            <p className="text-[13px] text-secondary/40 py-4">More stories coming soon</p>
          )}
        </div>
      </aside>
    </div>
    <div className="pb-6">
      <BrowsePastDaysCta className="border-t border-border/15 pt-8" />
    </div>
    </>
  );
}

/* ─── Desktop Pulse Editorial Layout (lg+) ─── */

function DesktopPulseEditorialLayout({
  filteredList,
  isLoading,
}: {
  filteredList: FeedListItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <ScrollFeedLoadingSkeleton editorial />;
  }

  if (filteredList.length === 0) {
    return (
      <div className="px-4 pb-12">
        <p className="py-10 text-center text-[15px] text-secondary/55">Nothing in your pulse yet</p>
        <BrowsePastDaysCta className="pt-2" />
      </div>
    );
  }

  const blogs = filteredList.filter((item) => item.pulseSection === 'blogs');
  const tools = filteredList.filter((item) => item.pulseSection === 'tools');
  const discussions = filteredList.filter((item) => item.pulseSection === 'discussions');
  // Items without a pulseSection go to a general bucket
  const other = filteredList.filter((item) => !item.pulseSection);

  const heroRead = blogs[0] || null;
  const restReads = blogs.slice(1);

  return (
    <div className="pt-8 pb-16">
      {/* Top Reads */}
      {blogs.length > 0 && (
        <section className="mb-14">
          <PulseSectionHeader title="Top Reads" />
          {heroRead && restReads.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-8 lg:gap-10">
              <div>
                <PulseReadHero item={heroRead} />
              </div>
              <div className="flex flex-col lg:border-l lg:border-border/15 lg:pl-8">
                {restReads.map((item) => (
                  <PulseReadCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ) : heroRead ? (
            <PulseReadHero item={heroRead} />
          ) : (
            <div className="flex flex-col">
              {blogs.map((item) => (
                <PulseReadCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Discussions + Tools rail */}
      {discussions.length > 0 && tools.length > 0 ? (
        <section className="mb-14">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-8 xl:gap-10 items-start">
            <div>
              <PulseSectionHeader title="Top Discussions" />
              <div className="flex flex-col">
                {discussions.map((item, i) => (
                  <PulseDiscussionCard key={item.id} item={item} rank={i + 1} />
                ))}
              </div>
            </div>
            <aside className="min-w-0 xl:sticky xl:top-24">
              <PulseSectionHeader title="Trending Tools & Repos" />
              <div className="flex flex-col gap-3">
                {tools.map((item) => (
                  <PulseToolCard key={item.id} item={item} />
                ))}
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <>
          {/* Tools & Repos */}
          {tools.length > 0 && (
            <section className="mb-14">
              <PulseSectionHeader title="Trending Tools & Repos" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tools.map((item) => (
                  <PulseToolCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* Discussions */}
          {discussions.length > 0 && (
            <section className="mb-14">
              <PulseSectionHeader title="Top Discussions" />
              <div className="flex flex-col">
                {discussions.map((item, i) => (
                  <PulseDiscussionCard key={item.id} item={item} rank={i + 1} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Other items without a section */}
      {other.length > 0 && (
        <section className="mb-14">
          <PulseSectionHeader title="More" />
          <div className="flex flex-col">
            {other.map((item, i) => (
              <PulseDiscussionCard key={item.id} item={item} rank={i + 1} />
            ))}
          </div>
        </section>
      )}
      <div className="pt-2">
        <BrowsePastDaysCta className="border-t border-border/15 pt-8" />
      </div>
    </div>
  );
}

/* ─── Desktop Full Article Page (lg+) ─── */

function DesktopArticlePageView({
  selectedContent,
  lockedStory,
  isLocked,
  isContentLoading,
  filteredList,
  selectedId,
  setSelectedId,
  onBack,
  isItemLocked,
}: {
  selectedContent: ContentData | null;
  lockedStory: FeedListItem | null;
  isLocked: boolean;
  isContentLoading: boolean;
  filteredList: FeedListItem[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  onBack: () => void;
  isItemLocked?: (itemId: string) => boolean;
}) {
  const story = lockedStory;
  const imageUrl = (selectedContent?.thumbnail || story?.thumbnail)
    ? getArticleImage(selectedContent?.thumbnail || story?.thumbnail || null, selectedContent?.title || story?.title || '')
    : null;
  const briefFmt = selectedContent?.body ? looksLikeBriefBody(selectedContent.body) : false;

  // Build sidebar: exclude current article, take up to 8
  const sidebarItems = filteredList.filter((item) => item.id !== selectedId).slice(0, 8);
  const currentIdx = filteredList.findIndex((item) => item.id === selectedId);
  const [desktopStreamState, setDesktopStreamState] = useState<{ anchorId: string | null; loadedIds: string[] }>({
    anchorId: null,
    loadedIds: [],
  });
  const desktopLoadedIds = useMemo(
    () => (desktopStreamState.anchorId === selectedId ? desktopStreamState.loadedIds : []),
    [desktopStreamState, selectedId]
  );
  const desktopNextCandidate =
    currentIdx >= 0 && currentIdx + 1 + desktopLoadedIds.length < filteredList.length
      ? filteredList[currentIdx + 1 + desktopLoadedIds.length]
      : null;
  const desktopLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const desktopDetailRequestsRef = useRef<Set<string>>(new Set());
  const [desktopDetailCache, setDesktopDetailCache] = useState<Record<string, FeedItemDetailResponse>>({});

  useEffect(() => {
    if (!desktopNextCandidate || isLocked) return;
    const node = desktopLoadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        observer.disconnect();
        setDesktopStreamState((prev) => {
          const base = prev.anchorId === selectedId ? prev.loadedIds : [];
          if (base.includes(desktopNextCandidate.id)) return prev;
          return {
            anchorId: selectedId,
            loadedIds: [...base, desktopNextCandidate.id],
          };
        });
      },
      { root: null, threshold: 0.15, rootMargin: '0px 0px 280px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [desktopNextCandidate, isLocked, selectedId]);

  useEffect(() => {
    if (isLocked || desktopLoadedIds.length === 0) return;
    for (const id of desktopLoadedIds) {
      if (desktopDetailCache[id]) continue;
      if (desktopDetailRequestsRef.current.has(id)) continue;
      desktopDetailRequestsRef.current.add(id);
      fetchFeedItemDetail(id)
        .then((detail) => {
          if (!detail) return;
          setDesktopDetailCache((prev) => ({ ...prev, [id]: detail }));
        })
        .catch(() => {
          // Keep skeleton when detail fetch fails.
        });
    }
  }, [desktopLoadedIds, desktopDetailCache, isLocked]);

  return (
    <div className="pt-6 pb-16">
      <div className="grid grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-10 xl:gap-14 items-start">
        {/* Main article content */}
        <article className="min-w-0">
          {/* Back to feed */}
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] text-secondary/60 hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            <span>Back to feed</span>
          </button>
          {/* Meta bar */}
          <div className="flex items-center gap-2 text-[12px] text-secondary/55 mb-4">
            {selectedContent?.source || story?.source ? (
              <span className="font-medium">{selectedContent?.source || story?.source}</span>
            ) : null}
            {selectedContent?.timestamp && (
              <>
                {(selectedContent?.source || story?.source) && <span className="text-secondary/30">·</span>}
                <span>{getTimeLabel(selectedContent.timestamp)}</span>
              </>
            )}
            {(selectedContent?.countLabel || (story?.sourceCount && story.sourceCount > 1)) && (
              <>
                <span className="text-secondary/30">·</span>
                <span>{selectedContent?.countLabel || `${story!.sourceCount} sources`}</span>
              </>
            )}
            {selectedContent?.readingTime && (
              <>
                <span className="text-secondary/30">·</span>
                <span>{selectedContent.readingTime} min read</span>
              </>
            )}
          </div>

          {/* Title */}
          <h1 className="text-[2rem] xl:text-[2.25rem] font-bold text-foreground leading-[1.12] tracking-[-0.03em] mb-6">
            {selectedContent?.title || story?.title}
          </h1>

          {/* Hero image */}
          {imageUrl && (
            <div className="mb-8">
              <img
                src={imageUrl}
                alt=""
                decoding="async"
                className={
                  isProductHuntWidget(imageUrl)
                    ? 'max-w-[280px] rounded-2xl border border-[#ff6154]/20 bg-white'
                    : 'w-full max-h-[420px] object-cover rounded-xl'
                }
              />
            </div>
          )}

          {/* Locked state */}
          {isLocked && story ? (
            <div className="rounded-2xl border border-border/15 bg-surface-secondary/30 p-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-200/90">
                <Lock size={12} />
                Trace Pro story
              </div>
              {story.preview && (
                <p className="text-[15px] leading-7 text-secondary/65">{story.preview}</p>
              )}
              <p className="mt-5 text-[17px] font-semibold text-foreground">Unlock the full brief in 2 minutes</p>
              <p className="mt-1 text-[14px] leading-6 text-secondary/60">
                Key takeaways, context, and source links are waiting for you.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-secondary/70">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
                  <Check size={12} className="text-emerald-600/80" />
                  Daily signal
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
                  <Check size={12} className="text-emerald-600/80" />
                  No rabbit holes
                </span>
              </div>
              <Link
                href="/profile?tab=subscription"
                prefetch={false}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
              >
                <Sparkles size={14} />
                Subscribe
              </Link>
            </div>
          ) : isContentLoading && !selectedContent?.body ? (
            <div className="animate-pulse space-y-4 py-2">
              <div className="h-[17px] w-full rounded-md bg-foreground/7" />
              <div className="h-[17px] w-[97%] rounded-md bg-foreground/7" />
              <div className="h-[17px] w-[92%] rounded-md bg-foreground/6" />
              <div className="h-[17px] w-full rounded-md bg-foreground/6" />
              <div className="h-[17px] w-[88%] rounded-md bg-foreground/5" />
              <div className="h-[17px] w-[74%] rounded-md bg-foreground/5" />
              <div className="h-[17px] w-[95%] rounded-md bg-foreground/5" />
              <div className="mt-8 rounded-xl border border-foreground/8 p-5">
                <div className="h-3 w-32 rounded-full bg-foreground/8 mb-4" />
                <div className="space-y-3">
                  <div className="h-3.5 w-[90%] rounded-md bg-foreground/5" />
                  <div className="h-3.5 w-[82%] rounded-md bg-foreground/5" />
                  <div className="h-3.5 w-[87%] rounded-md bg-foreground/4" />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Article body */}
              {selectedContent?.body && (
                <div className="mb-8 text-[17px] text-foreground/85 leading-[1.85]">
                  {briefFmt ? (
                    <BriefBody body={selectedContent.body} />
                  ) : (
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                      <MarkdownProse body={selectedContent.body} />
                    </div>
                  )}
                </div>
              )}

              {/* Key takeaways */}
              {selectedContent?.keyPoints && selectedContent.keyPoints.length > 0 && (
                <div className="mb-8 p-6 rounded-xl border border-border/15 bg-surface-secondary/20">
                  <h3 className="text-[11px] font-semibold text-secondary/55 mb-4 uppercase tracking-[0.15em]">
                    Key Takeaways
                  </h3>
                  <div className="space-y-3">
                    {selectedContent.keyPoints.slice(0, 6).map((point, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-secondary/35 font-mono text-[13px] mt-0.5 shrink-0">{i + 1}.</span>
                        <p className="text-[15px] text-secondary/80 leading-relaxed">{stripMarkdown(point)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Why it matters */}
              {selectedContent?.whyItMatters && (
                <div className="mb-8 pl-5 border-l-2 border-foreground/15">
                  <h3 className="text-[11px] font-semibold text-secondary/55 mb-2 uppercase tracking-[0.15em]">
                    Why It Matters
                  </h3>
                  <p className="text-[15px] text-secondary/75 leading-relaxed">{stripMarkdown(selectedContent.whyItMatters)}</p>
                </div>
              )}

              {/* Actions — share + source link */}
              {(selectedContent?.shareUrl || selectedContent?.url) && (
                <div className="pt-6 border-t border-border/15 flex flex-wrap items-center gap-3">
                  <ShareButton url={selectedContent.shareUrl || selectedContent.url!} />
                  {selectedContent?.url && (
                    <a
                      href={selectedContent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
                    >
                      Read original source
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              )}
            </>
          )}

          {/* Appended stories stream */}
          {desktopLoadedIds.map((id) => {
            const listItem = filteredList.find((entry) => entry.id === id);
            if (!listItem) return null;
            const streamLocked = isItemLocked ? isItemLocked(id) : false;
            const detail = desktopDetailCache[id];
            const hydrated =
              detail?.item?.id === listItem.id
                ? (listItem.type === 'article' && detail.kind === 'article')
                  ? { ...listItem, data: detail.item }
                  : (listItem.type === 'topic' && detail.kind === 'topic')
                    ? { ...listItem, data: detail.item }
                    : listItem
                : listItem;
            const content = getContentFromFeedListItem(hydrated);
            const hasBody = Boolean(content?.body);
            const streamImageUrl = (content?.thumbnail || listItem.thumbnail)
              ? getArticleImage(content?.thumbnail || listItem.thumbnail || null, content?.title || listItem.title || '')
              : null;
            return (
              <section key={id} className="mt-12 pt-8 border-t border-border/15">
                <p className="text-[10px] font-semibold text-secondary/40 uppercase tracking-[0.15em] mb-3">Next Story</p>
                <div className="flex items-center gap-2 text-[12px] text-secondary/55 mb-4">
                  {content?.source || listItem.source ? (
                    <span className="font-medium">{content?.source || listItem.source}</span>
                  ) : null}
                  {content?.timestamp && (
                    <>
                      {(content?.source || listItem.source) && <span className="text-secondary/30">·</span>}
                      <span>{getTimeLabel(content.timestamp)}</span>
                    </>
                  )}
                  {(content?.countLabel || (listItem.sourceCount > 1 ? `${listItem.sourceCount} sources` : null)) && (
                    <>
                      <span className="text-secondary/30">·</span>
                      <span>{content?.countLabel || `${listItem.sourceCount} sources`}</span>
                    </>
                  )}
                  {content?.readingTime && (
                    <>
                      <span className="text-secondary/30">·</span>
                      <span>{content.readingTime} min read</span>
                    </>
                  )}
                </div>
                <h2 className="text-[2rem] xl:text-[2.2rem] font-bold text-foreground leading-[1.12] tracking-[-0.03em] mb-6">
                  {content?.title || listItem.title}
                </h2>
                {streamLocked ? (
                  <div className="rounded-2xl border border-border/15 bg-surface-secondary/30 p-6">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-200/90">
                      <Lock size={12} />
                      Trace Pro story
                    </div>
                    {listItem.preview && (
                      <p className="text-[15px] leading-7 text-secondary/65">{listItem.preview}</p>
                    )}
                    <p className="mt-5 text-[17px] font-semibold text-foreground">Unlock the full brief</p>
                    <p className="mt-1 text-[14px] leading-6 text-secondary/60">
                      You've used your free reads for today. Upgrade to Pro for unlimited access.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-secondary/70">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
                        <Check size={12} className="text-emerald-600/80" />
                        Daily signal
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
                        <Check size={12} className="text-emerald-600/80" />
                        No fluff
                      </span>
                    </div>
                    <Link
                      href="/profile?tab=subscription"
                      prefetch={false}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
                    >
                      <Sparkles size={14} />
                      Subscribe
                    </Link>
                  </div>
                ) : !hasBody ? (
                  <div className="animate-pulse space-y-4 py-2">
                    <div className="h-[17px] w-full rounded-md bg-foreground/7" />
                    <div className="h-[17px] w-[97%] rounded-md bg-foreground/7" />
                    <div className="h-[17px] w-[92%] rounded-md bg-foreground/6" />
                    <div className="h-[17px] w-full rounded-md bg-foreground/6" />
                    <div className="h-[17px] w-[88%] rounded-md bg-foreground/5" />
                    <div className="h-[17px] w-[74%] rounded-md bg-foreground/5" />
                    <div className="h-[17px] w-[95%] rounded-md bg-foreground/5" />
                  </div>
                ) : (
                  <>
                    {streamImageUrl && (
                      <div className="mb-8">
                        <img
                          src={streamImageUrl}
                          alt=""
                          decoding="async"
                          className={
                            isProductHuntWidget(streamImageUrl)
                              ? 'max-w-[280px] rounded-2xl border border-[#ff6154]/20 bg-white'
                              : 'w-full max-h-[420px] object-cover rounded-xl'
                          }
                        />
                      </div>
                    )}
                    <div className="mb-8 text-[17px] text-foreground/85 leading-[1.85]">
                      {looksLikeBriefBody(content!.body) ? (
                        <BriefBody body={content!.body} />
                      ) : (
                        <div className="prose prose-lg dark:prose-invert max-w-none">
                          <MarkdownProse body={content!.body} />
                        </div>
                      )}
                    </div>
                    {content?.keyPoints && content.keyPoints.length > 0 && (
                      <div className="mb-8 p-6 rounded-xl border border-border/15 bg-surface-secondary/20">
                        <h3 className="text-[11px] font-semibold text-secondary/55 mb-4 uppercase tracking-[0.15em]">
                          Key Takeaways
                        </h3>
                        <div className="space-y-3">
                          {content.keyPoints.slice(0, 6).map((point, i) => (
                            <div key={i} className="flex gap-3">
                              <span className="text-secondary/35 font-mono text-[13px] mt-0.5 shrink-0">{i + 1}.</span>
                              <p className="text-[15px] text-secondary/80 leading-relaxed">{stripMarkdown(point)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {content?.whyItMatters && (
                      <div className="mb-8 pl-5 border-l-2 border-foreground/15">
                        <h3 className="text-[11px] font-semibold text-secondary/55 mb-2 uppercase tracking-[0.15em]">
                          Why It Matters
                        </h3>
                        <p className="text-[15px] text-secondary/75 leading-relaxed">{stripMarkdown(content.whyItMatters)}</p>
                      </div>
                    )}
                    {(content?.shareUrl || content?.url) && (
                      <div className="pt-6 border-t border-border/15 flex flex-wrap items-center gap-3">
                        <ShareButton url={content.shareUrl || content.url!} />
                        {content?.url && (
                          <a
                            href={content.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
                          >
                            Read original source
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}

          {desktopNextCandidate && !isLocked && (
            <div ref={desktopLoadMoreRef} className="mt-10 pt-6 border-t border-border/15">
              <div className="w-full rounded-xl border border-border/10 bg-foreground/[0.02] px-5 py-5 animate-pulse">
                <div className="h-3 w-24 rounded-full bg-foreground/10 mb-3" />
                <div className="h-4 w-[80%] rounded-md bg-foreground/10 mb-2" />
                <div className="h-4 w-[58%] rounded-md bg-foreground/8" />
              </div>
            </div>
          )}
        </article>

        {/* Right sidebar — Most Popular */}
        <aside className="min-w-0 sticky top-20 self-start">
            <div className="mb-5 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/70">
                Most Popular
              </span>
              <div className="flex-1 h-px bg-border/25" />
            </div>

            <div className="flex flex-col">
              {sidebarItems.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    window.history.replaceState({ article: item.id }, '');
                    window.scrollTo(0, 0);
                  }}
                  className="group flex gap-3 py-3.5 border-b border-border/10 last:border-0 text-left hover:bg-foreground/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                >
                  <span className="text-[22px] font-bold text-foreground/15 leading-none mt-0.5 shrink-0 w-7 text-right tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[14px] font-semibold text-foreground leading-snug tracking-[-0.01em] mb-1 line-clamp-3 group-hover:text-foreground/80">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-secondary/45">
                      {item.source && <span className="truncate max-w-[120px]">{item.source}</span>}
                      {item.source && item.sourceCount > 1 && <span className="text-secondary/25">·</span>}
                      {item.sourceCount > 1 && <span className="shrink-0">{item.sourceCount} sources</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {sidebarItems.length === 0 && (
              <p className="text-[13px] text-secondary/40 py-4">No other stories right now</p>
            )}
        </aside>
      </div>
    </div>
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
  isLocked: boolean | ((itemId: string) => boolean);
}) {
  const getItemLocked = (id: string) =>
    typeof isLocked === 'function' ? isLocked(id) : isLocked;
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
    // Scroll the expanded card to the top of viewport, just below any sticky header (~120px offset)
    const headerOffset = 120;
    const elTop = el.getBoundingClientRect().top;
    if (job.root === window) {
      window.scrollTo({ top: window.scrollY + elTop - headerOffset, behavior: 'smooth' });
    } else {
      const container = job.root as HTMLElement;
      container.scrollTo({ top: container.scrollTop + elTop - headerOffset, behavior: 'smooth' });
    }
  }, [expandedIds, filteredList]);

  if (isLoading) {
    return <ScrollFeedLoadingSkeleton rows={6} embedded />;
  }

  if (filteredList.length === 0) {
    return (
      <div className="px-4 pb-12">
        <p className="py-10 text-center text-[15px] text-secondary/55">
          {activeFilter === BRIEFING_PULSE_TAB_KEY ? 'Nothing in your pulse yet' : 'Nothing here yet'}
        </p>
        <BrowsePastDaysCta className="pt-2" />
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
          isLocked={getItemLocked(item.id)}
          articleRef={(node) => {
            if (node) cardElByIdRef.current.set(item.id, node);
            else cardElByIdRef.current.delete(item.id);
          }}
        />
      ))}
      <div className="px-4 pb-8">
        <BrowsePastDaysCta className="mt-8 border-t border-border/15 pt-8" />
      </div>
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
  isLocked: boolean | ((itemId: string) => boolean);
  isItemLocked?: (itemId: string) => boolean;
  lockedStory: FeedListItem | null;
  mobileContentList: FeedListItem[];
  showMobileContent: boolean;
  openMobileArticle: (id: string) => void;
  closeMobileArticle: () => void;
  briefingLayout: 'panel' | 'scroll';
  showPulseTab: boolean;
  hotTweets?: { id: string; title: string; url: string; description: string; pubDate: string; category: string }[];
  /** When true, subscribe overlay blocks feed body but tab filters stay clickable (z-index above overlay). */
  interactionLocked?: boolean;
};

function LockedStoryPanel({ story }: { story: FeedListItem }) {
  const imageUrl = story.thumbnail ? getArticleImage(story.thumbnail, story.title) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-200/90">
          <Lock size={12} />
          Trace Pro story
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
          <p className="text-[19px] font-semibold text-foreground">
            Unlock this story in full
          </p>
          <p className="mt-2 text-sm leading-6 text-secondary/60">
            Get key takeaways, context, and source links for every story in your feed.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-secondary/70">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
              <Check size={12} className="text-emerald-600/80" />
              Daily signal
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
              <Check size={12} className="text-emerald-600/80" />
              No fluff
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/profile?tab=subscription"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
            >
              <Sparkles size={14} />
              Subscribe
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
  isItemLocked,
  lockedStory,
  mobileContentList,
  showMobileContent,
  openMobileArticle,
  closeMobileArticle,
  briefingLayout,
  showPulseTab,
  hotTweets = [],
  interactionLocked = false,
}: FeedBriefingViewProps) {
  const resolvedIsItemLocked = isItemLocked ?? (typeof isLocked === 'function' ? isLocked : () => isLocked);
  const selectedIsLocked = selectedId ? resolvedIsItemLocked(selectedId) : false;
  const [lgUp, setLgUp] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const mobileArticleRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setLgUp(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Reset mobile article overlay scroll and share state when switching articles
  useEffect(() => {
    if (showMobileContent && mobileArticleRef.current) {
      mobileArticleRef.current.scrollTop = 0;
    }
  }, [selectedId, showMobileContent]);

  const panelNewsListRef = useRef<HTMLDivElement | null>(null);
  const isFirstActiveFilterEffect = useRef(true);

  /** When switching interest tabs (or Pulse / Suggested), jump back to the top of the feed. */
  useEffect(() => {
    if (isFirstActiveFilterEffect.current) {
      isFirstActiveFilterEffect.current = false;
      return;
    }
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const list = panelNewsListRef.current;
    if (list) list.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeFilter]);

  if (briefingLayout === 'scroll') {
    return (
      <>
        <div className={interactionLocked ? 'relative z-[90]' : undefined}>
          <ScrollFeedInterestTabs
            activeFilter={activeFilter}
            interestTabs={interestTabs}
            filterCounts={filterCounts}
            setActiveFilter={setActiveFilter}
            storyCount={storyCount}
            showPulseTab={showPulseTab}
          />
        </div>
        <div inert={interactionLocked ? true : undefined}>
          {activeFilter === BRIEFING_PULSE_TAB_KEY ? (
            <DesktopPulseEditorialLayout
              filteredList={filteredList}
              isLoading={isLoading}
            />
          ) : lgUp ? (
            showMobileContent && (selectedContent || (selectedIsLocked && lockedStory)) ? (
              <DesktopArticlePageView
                selectedContent={selectedContent}
                lockedStory={lockedStory}
                isLocked={selectedIsLocked}
                isContentLoading={isContentLoading}
                filteredList={filteredList}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                onBack={closeMobileArticle}
                isItemLocked={resolvedIsItemLocked}
              />
            ) : (
              <DesktopEditorialLayout
                filteredList={filteredList}
                isLoading={isLoading}
                onSelect={(id) => { setSelectedId(id); openMobileArticle(id); }}
                activeFilter={activeFilter}
                isLocked={resolvedIsItemLocked}
                hotTweets={hotTweets}
              />
            )
          ) : (
            <div
              className="mx-auto w-full max-w-[min(43rem,100%)] min-h-[calc(100vh-11rem)]"
              style={{ overflowAnchor: 'none' }}
            >
              <ScrollFeedPosts
                filteredList={filteredList}
                isLoading={isLoading}
                onSelect={setSelectedId}
                activeFilter={activeFilter}
                isLocked={resolvedIsItemLocked}
              />
            </div>
          )}
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
            <div
              className={`px-5 pt-5 pb-3 border-b border-border/20 ${
                interactionLocked ? 'relative z-[90]' : ''
              }`}
            >
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

            <div
              ref={panelNewsListRef}
              inert={interactionLocked ? true : undefined}
              className="flex-1 overflow-y-auto divide-y divide-border/10"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-secondary/40" />
                </div>
              ) : (
                <>
                  {filteredList.length === 0 ? (
                    <div className="px-5 py-10 text-center">
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
                  <div className="border-t border-border/15 p-4">
                    <BrowsePastDaysCta textAlign="left" className="text-left" />
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            inert={interactionLocked ? true : undefined}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-secondary/40" />
            </div>
          ) : selectedIsLocked && lockedStory ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <LockedStoryPanel story={lockedStory} />
            </div>
          ) : selectedContent ? (
            <div key={selectedId} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <ContentPanel content={selectedContent} isLoadingDetail={isContentLoading || isContentRefreshing} />
            </div>
          ) : isContentLoading ? (
            <ArticleContentSkeleton key={`skeleton-${selectedId}`} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-secondary/40 text-sm">Select a story to read</p>
            </div>
          )}
          </div>
        </div>
      </div>

      {showMobileContent && (selectedContent || isContentLoading || (selectedIsLocked && lockedStory)) && (() => {
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
          <div ref={mobileArticleRef} className="fixed inset-0 z-[70] bg-background overflow-y-auto md:hidden">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/10 bg-background px-4 py-3">
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
              {(selectedContent?.shareUrl || selectedContent?.url) && (
                <button
                  type="button"
                  onClick={async () => {
                    const url = selectedContent?.shareUrl || selectedContent?.url;
                    if (!url) return;
                    try {
                      await navigator.clipboard.writeText(url);
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    } catch { /* ignore */ }
                  }}
                  className="p-1.5 -mr-1.5 rounded-lg text-foreground/60 active:bg-foreground/8"
                >
                  {shareCopied ? <Check size={18} className="text-green-500" /> : <Share2 size={18} />}
                </button>
              )}
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

              {selectedIsLocked && story ? (
                <div className="rounded-[28px] border border-border/15 bg-surface-secondary/30 p-5">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-200/90">
                    <Lock size={12} />
                    Trace Pro story
                  </div>
                  {story.preview && (
                    <p className="text-[14px] leading-7 text-secondary/65">{story.preview}</p>
                  )}
                  <p className="mt-5 text-[16px] font-semibold text-foreground">Unlock the full brief in 2 minutes</p>
                  <p className="mt-1 text-[13px] leading-6 text-secondary/60">
                    Read the summary, key points, and source links for this story and the rest of your feed.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-secondary/70">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
                      <Check size={12} className="text-emerald-600/80" />
                      Daily signal
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1">
                      <Check size={12} className="text-emerald-600/80" />
                      No fluff
                    </span>
                  </div>
                  <Link
                    href="/profile?tab=subscription"
                    prefetch={false}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
                  >
                    <Sparkles size={14} />
                    Subscribe
                  </Link>
                </div>
              ) : isContentLoading && !selectedContent?.body ? (
                <div className="animate-pulse space-y-3 py-2">
                  <div className="h-3.5 w-full rounded-md bg-foreground/6 dark:bg-white/7" />
                  <div className="h-3.5 w-[97%] rounded-md bg-foreground/6 dark:bg-white/7" />
                  <div className="h-3.5 w-[92%] rounded-md bg-foreground/5 dark:bg-white/6" />
                  <div className="h-3.5 w-full rounded-md bg-foreground/5 dark:bg-white/6" />
                  <div className="h-3.5 w-[85%] rounded-md bg-foreground/5 dark:bg-white/6" />
                  <div className="h-3.5 w-[70%] rounded-md bg-foreground/4 dark:bg-white/5" />
                  <div className="mt-6 rounded-xl border border-foreground/6 dark:border-white/8 p-4">
                    <div className="h-3 w-28 rounded-full bg-foreground/8 dark:bg-white/10 mb-3" />
                    <div className="space-y-2">
                      <div className="h-3 w-[90%] rounded-md bg-foreground/5 dark:bg-white/6" />
                      <div className="h-3 w-[80%] rounded-md bg-foreground/4 dark:bg-white/5" />
                    </div>
                  </div>
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

                  {(selectedContent?.shareUrl || selectedContent?.url) && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          const url = selectedContent?.shareUrl || selectedContent?.url;
                          if (!url) return;
                          try {
                            await navigator.clipboard.writeText(url);
                            setShareCopied(true);
                            setTimeout(() => setShareCopied(false), 2000);
                          } catch { /* ignore */ }
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-border/25 bg-white px-5 py-2.5 text-sm font-semibold text-foreground active:bg-foreground/5"
                      >
                        {shareCopied ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Share2 size={14} />
                        )}
                        {shareCopied ? 'Link copied' : 'Copy link'}
                      </button>
                      {selectedContent?.url && (
                        <a
                          href={selectedContent.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-foreground text-background"
                        >
                          Read original
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
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
        <div className={interactionLocked ? 'relative z-[90]' : undefined}>
          <div className="px-5 pt-6 pb-4">
            <p className="text-[10px] font-semibold text-secondary/40 uppercase tracking-[0.2em] mb-1">{getTodayLabel()}</p>
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-[1.6rem] font-bold text-foreground tracking-[-0.025em] leading-tight">News</h1>
                {activeFilter === HOT_TWEETS_TAB_KEY ? (
                  hotTweets.length > 0 && <span className="text-[12px] text-secondary/45 mb-0.5">{hotTweets.length} tweets</span>
                ) : (
                  storyCount > 0 && <span className="text-[12px] text-secondary/45 mb-0.5">{storyCount} stories</span>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 max-w-full overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-border/15 touch-pan-x overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <div className="inline-flex w-max max-w-none items-center gap-2 px-5 pb-3">
              {([
                { key: HOT_TWEETS_TAB_KEY, label: 'Hot Tweets', special: true as const },
                { key: 'for_you', label: 'For You' },
                ...interestTabs.map((item) => ({ key: item.id, label: item.label })),
                { key: 'suggested', label: 'Suggested' },
              ]).map(({ key, label, special }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                    special
                      ? activeFilter === key
                        ? 'bg-[#1d9bf0] text-white'
                        : 'text-[#1d9bf0]/70 hover:text-[#1d9bf0] bg-[#1d9bf0]/5'
                      : activeFilter === key
                        ? 'bg-foreground text-background'
                        : 'bg-foreground/8 text-secondary/70'
                  }`}
                >
                  {special && <Flame size={11} className="inline mr-1 -mt-px" aria-hidden />}
                  {label}
                  {(key === HOT_TWEETS_TAB_KEY ? hotTweets.length : (filterCounts[key] || 0)) > 0 ? ` (${key === HOT_TWEETS_TAB_KEY ? hotTweets.length : filterCounts[key]})` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div inert={interactionLocked ? true : undefined}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-secondary/40" />
          </div>
        ) : activeFilter === HOT_TWEETS_TAB_KEY ? (
          hotTweets.length > 0 ? (
            <div className="px-5 pt-4 pb-10">
              {hotTweets.map((tweet) => (
                <HotTweetItem key={tweet.id} tweet={tweet} compact />
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-secondary/55">No hot tweets right now</p>
            </div>
          )
        ) : filteredList.length === 0 ? (
          <div className="px-5 pb-10">
            <p className="py-8 text-center text-sm text-secondary/55">
              {activeFilter === 'suggested'
                ? 'No suggested stories right now'
                : activeFilter === 'for_you'
                  ? 'No stories matching your interests'
                  : `No stories for ${INTEREST_LABEL[activeFilter] || activeFilter} yet`}
            </p>
            <BrowsePastDaysCta />
          </div>
        ) : (
          <>
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
            <div className="border-t border-border/15 px-5 py-8">
              <BrowsePastDaysCta />
            </div>
          </>
        )}
        </div>
      </div>
    </>
  );
}
