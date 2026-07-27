"use client";

/**
 * PROTOTYPE — throwaway. Shared model + atoms for the feed-edition redesign
 * variants (inkling-model.com-inspired editorial feed). Delete or absorb
 * once a variant wins. See NOTES.md.
 */

import React from 'react';
import Link from 'next/link';
import { Check, Layers3, LineChart, Link2, ListChecks, Mail, Smartphone, Sparkles } from 'lucide-react';
import { Newsreader } from 'next/font/google';
import { updateUserProfile } from '@/lib/firestore';
import type { V3UserFeed, FeedItem, TrendingTopic } from '@/lib/firestore';
import { buildArticleShareUrl, copyOrShareUrl, SHARE_SITE_ORIGIN } from '@/lib/article-share';
import {
  trackCheckoutClicked,
  trackDailyBriefPreferenceChanged,
  trackFeedSourceClicked,
  trackPaywallShown,
} from '@/lib/posthog';
import {
  decodeHtml,
  getArticleSummary,
  getTopicDisplay,
  INTEREST_LABEL,
  stripMarkdown,
  type FeedListItem,
} from '@/app/(auth)/feed/FeedUi';
import {
  normalizeInterestOrder,
  organizeEditionFeed,
  type EditionFeed,
} from '@/app/(auth)/feed/FeedEditionOrganizer';
import { FREE_READS_LIMIT } from '@/lib/free-reads';
import { getArticleImageCandidates } from '@/lib/fallback-images';
import { getPostAuthDestination, useAuth } from '@/contexts/AuthContext';

export const editionSerif = Newsreader({
  subsets: ['latin'],
  variable: '--font-edition-serif',
  display: 'swap',
});

/** Editorial blue — matches the app's existing brand blue and inkling's accent. */
export const BLUE = '#2557d6';
export const PAPER = '#faf9f5';
export const INK = '#1b1a17';
export const MUTED = '#75705f';
export const HAIRLINE = '#e4e1d8';

export function useDialogFocus(
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  React.useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const dialog = dialogRef.current;
    const focusable = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(() => (focusable()[0] ?? dialog)?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [dialogRef, onClose]);
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type EditionModel = {
  edition: EditionFeed;
  /** Every story in edition reading order: hero lead, hero sidebar, sections, latest. */
  orderedItems: FeedListItem[];
  /** Global story number (1-based) by item id. */
  storyNumber: Map<string, number>;
  freeIds: Set<string>;
  isPro: boolean;
  accessPending: boolean;
  accessVerificationFailed: boolean;
  totalSources: number;
  dateLabel: string;
  topicCount: number;
  /** ?img=on — rationed imagery: lead photo + images inside expanded stories. */
  showImages: boolean;
};

export type PulseEditionSection = {
  id: 'discussions' | 'tools' | 'reads';
  label: string;
  items: FeedListItem[];
};

export function isLocked(model: EditionModel, id: string): boolean {
  if (model.isPro) return false;
  return !model.freeIds.has(id);
}

function isTraceBrief(item: { source?: string }): boolean {
  return (item.source || '').trim().toLowerCase() === 'trace brief';
}

function articlePreview(item: FeedItem): string {
  return sentencePreview(item.summary?.short_article?.subtitle || item.description || getArticleSummary(item), 1);
}

/** Keep closed rows scannable without chopping a sentence in the middle. */
export function sentencePreview(value: string, sentenceCount = 2): string {
  const text = stripMarkdown(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/g) || [text];
  return sentences.slice(0, sentenceCount).join(' ').trim();
}

/** Condensed port of FeedPageRuntime's currentList merge (for_you → topics → trending). */
function buildEditionList(feed: V3UserFeed): FeedListItem[] {
  const list: FeedListItem[] = [];
  const covered = new Set<string>();

  for (const item of feed.for_you || []) {
    list.push({
      id: item.id,
      type: 'article',
      title: decodeHtml(item.title || ''),
      preview: articlePreview(item),
      timestamp: item.published_date,
      source: item.source_name || item.source,
      sourceCount: item.metadata?.source_count || item.sources?.length || 0,
      thumbnail: item.thumbnail,
      interestId: item.interest_id,
      tags: item.tags,
      data: item,
    });
    covered.add(item.id);
  }

  for (const topic of feed.trending_topics || []) {
    const articles = topic.articles || [];
    if (articles.length === 0) continue;
    const display = getTopicDisplay(topic);

    if (display.isSingleton && articles[0]) {
      const article = articles[0];
      if (covered.has(article.id)) continue;
      list.push({
        id: article.id,
        type: 'article',
        title: decodeHtml(article.title || topic.title || ''),
        preview: articlePreview(article) || sentencePreview(display.summary, 1),
        timestamp: article.published_date,
        source: article.source_name,
        sourceCount: 1,
        thumbnail: article.thumbnail || topic.thumbnail,
        interestId: topic.interest_id || article.interest_id,
        tags: topic.tags || article.tags,
        data: article,
      });
      covered.add(article.id);
      continue;
    }

    if (covered.has(topic.id)) continue;
    list.push({
      id: topic.id,
      type: 'topic',
      title: decodeHtml(display.title || ''),
      preview: sentencePreview(display.subtitle || display.summary, 1),
      timestamp: articles[0]?.published_date || topic.last_updated_at,
      sourceCount: topic.source_count || articles.length,
      thumbnail: topic.thumbnail,
      interestId: topic.interest_id,
      tags: topic.tags,
      data: topic,
    });
    for (const article of articles) covered.add(article.id);
  }

  for (const item of feed.trending || []) {
    if (covered.has(item.id)) continue;
    list.push({
      id: item.id,
      type: 'article',
      title: decodeHtml(item.title || ''),
      preview: articlePreview(item),
      timestamp: item.published_date,
      source: item.source_name,
      sourceCount: item.metadata?.source_count || item.sources?.length || 0,
      thumbnail: item.thumbnail,
      interestId: item.interest_id,
      tags: item.tags,
      data: item,
    });
  }

  return list
    .filter((item) => !isTraceBrief(item))
    .sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
}

export function buildEditionModel(
  feed: V3UserFeed | null,
  isPro: boolean,
  dateLabel: string,
  showImages: boolean,
  accessPending = false,
  accessVerificationFailed = false,
): EditionModel {
  const list = buildEditionList(feed || ({} as V3UserFeed));
  const interestOrder = normalizeInterestOrder(
    (feed?.viewer_profile?.interests || []).filter(
      (i): i is string => typeof i === 'string' && i.trim().length > 0,
    ),
  );
  const edition = organizeEditionFeed(list, interestOrder, false);

  const orderedItems: FeedListItem[] = [
    ...(edition.hero ? [edition.hero.lead, ...edition.hero.sidebar] : []),
    ...edition.sections.flatMap((s) => s.stories),
    ...edition.latest,
  ];
  const storyNumber = new Map<string, number>();
  orderedItems.forEach((item, index) => storyNumber.set(item.id, index + 1));

  const freeIds = new Set(
    orderedItems.slice(0, FREE_READS_LIMIT).map((item) => item.id),
  );

  const totalSources = orderedItems.reduce((sum, item) => sum + (item.sourceCount || 0), 0);

  return {
    edition,
    orderedItems,
    storyNumber,
    freeIds,
    isPro,
    accessPending,
    accessVerificationFailed,
    totalSources,
    dateLabel,
    topicCount: edition.sections.length,
    showImages,
  };
}

function toPulseListItem(item: FeedItem): FeedListItem {
  const raw = item as FeedItem & { signal?: string };
  const parsedSignal = raw.signal
    ? Number.parseInt(String(raw.signal).replace(/[^\d]/g, ''), 10)
    : undefined;
  const signalCount = item.metadata?.signal_count || (Number.isFinite(parsedSignal) ? parsedSignal : undefined);

  return {
    id: item.id,
    type: 'article',
    title: decodeHtml(item.title || ''),
    preview: item.summary?.short_article?.subtitle || item.description || getArticleSummary(item),
    timestamp: item.published_date,
    source: item.source_name || item.source,
    sourceCount: signalCount || item.sources?.length || 0,
    thumbnail: item.thumbnail,
    url: item.url?.trim() || undefined,
    signalCount,
    data: item,
  };
}

function uniquePulseItems(items: FeedItem[]): FeedListItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.url || item.id || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(toPulseListItem);
}

export function buildPulseEdition(feed: V3UserFeed | null): PulseEditionSection[] {
  const daily = feed?.daily_pulse;
  const discussions = uniquePulseItems([
    ...(daily?.discussions || []),
    ...(feed?.community_pulse || []),
  ]);

  return [
    {
      id: 'tools',
      label: 'Builds',
      items: uniquePulseItems([...(daily?.tools || []), ...(feed?.build_pulse || [])]),
    },
    {
      id: 'discussions',
      label: 'Conversation',
      items: discussions.length > 0 ? discussions : uniquePulseItems(feed?.pulse || []),
    },
    {
      id: 'reads',
      label: 'Briefings',
      items: uniquePulseItems(daily?.blogs || []),
    },
  ];
}

export function interestEyebrow(item: FeedListItem): string {
  const id = item.interestId ?? item.tags?.[0];
  if (!id) return 'TECH';
  return (INTEREST_LABEL[id] || id.replace(/-/g, ' ')).toUpperCase();
}

export function timeAgo(timestamp?: string): string {
  if (!timestamp) return '';
  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) return '';
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Smooth-scroll an element to the top of the viewport (with breathing room), so
 * an opened story becomes the first thing on screen. Recomputes the target
 * every frame to track layout shifts from the expand/collapse animations.
 */
export function scrollElementToTop(el: HTMLElement | null, duration = 480) {
  if (!el) return;
  const getOffset = () => {
    const filter = document.querySelector<HTMLElement>('[data-edition-filter]');
    return (filter?.getBoundingClientRect().height || 0) + 18;
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - getOffset()) });
    return;
  }
  const startY = window.scrollY;
  const startTime = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);

  const frame = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration);
    const rect = el.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - getOffset();
    window.scrollTo(0, startY + (targetY - startY) * ease(t));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function getStoryShareUrl(item: FeedListItem): string | null {
  if (item.type === 'topic') {
    const topic = item.data as TrendingTopic;
    const slug = topic.topic_key || topic.id;
    return slug ? `${SHARE_SITE_ORIGIN}/topics/${encodeURIComponent(slug)}` : null;
  }
  const article = item.data as FeedItem;
  return buildArticleShareUrl(article) || item.url || article.url || null;
}

export function StoryShareButton({ item, className = '' }: { item: FeedListItem; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const shareUrl = getStoryShareUrl(item);

  if (!shareUrl) return null;

  const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await copyOrShareUrl(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be unavailable in embedded browsers.
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Copy story link"
      title={copied ? 'Link copied' : 'Copy story link'}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-[#f0eee7] ${className}`}
      style={{ borderColor: HAIRLINE, color: copied ? '#2f7d4c' : MUTED }}
    >
      {copied ? <Check size={14} /> : <Link2 size={14} />}
    </button>
  );
}

export function EditionHeader({ view }: { view: 'edition' | 'pulse' | 'profile' }) {
  const { user } = useAuth();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const navItem = (active: boolean) => ({
    color: active ? BLUE : MUTED,
    textDecoration: active ? 'underline' : 'none',
    textUnderlineOffset: 5,
  });
  const startNavigation = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      setPendingHref(href);
    }
  };

  return (
    <header className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b py-4" style={{ borderColor: HAIRLINE, backgroundColor: '#faf9f5' }}>
      {user ? (
        <a href="/feed" className="font-mono text-[12.5px] font-bold tracking-[0.28em]" style={{ color: INK }}>
          TRACE
        </a>
      ) : (
        <Link href="/" className="font-mono text-[12.5px] font-bold tracking-[0.28em]" style={{ color: INK }}>
          TRACE
        </Link>
      )}
      <nav className="flex items-center gap-5 text-[13px] font-medium" aria-label="Trace">
        <a className="transition-opacity hover:opacity-70" href="/feed?view=pulse" onClick={startNavigation('/feed?view=pulse')} style={navItem(view === 'pulse')}>Pulse</a>
        <a className="transition-opacity hover:opacity-70" href="/feed?view=edition" onClick={startNavigation('/feed?view=edition')} style={navItem(view === 'edition')}>Edition</a>
        <Link className="transition-opacity hover:opacity-70" href="/profile" onClick={startNavigation('/profile')} style={navItem(view === 'profile')}>Profile</Link>
      </nav>
      {pendingHref && <span aria-hidden="true" className="absolute inset-x-0 bottom-[-2px] h-[2px] animate-pulse" style={{ backgroundColor: BLUE }} />}
      {pendingHref && <span className="sr-only" role="status">Loading page</span>}
    </header>
  );
}

export function EditionFooter() {
  return (
    <footer className="mt-16 border-t pb-28 pt-10" style={{ borderColor: HAIRLINE }}>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <span className={`${editionSerif.className} text-[22px]`} style={{ color: INK }}>Trace</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[12px]" style={{ color: MUTED }} aria-label="Explore Trace">
          <Link className="transition-colors hover:text-[#2557d6]" href="/trending">Trending</Link>
          <Link className="transition-colors hover:text-[#2557d6]" href="/blog">Blog</Link>
          <Link className="transition-colors hover:text-[#2557d6]" href="/compare">Compare</Link>
          <Link className="transition-colors hover:text-[#2557d6]" href="/contact">Contact</Link>
          <Link className="transition-colors hover:text-[#2557d6]" href="/privacy-policy">Privacy</Link>
          <Link className="transition-colors hover:text-[#2557d6]" href="/terms">Terms</Link>
        </nav>
      </div>
      <p className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>
        © 2026 Trace · Independent daily tech reference
      </p>
      <div className="mt-6 border-t pt-5" style={{ borderColor: HAIRLINE }}>
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>More from the founder</p>
        <div className="mt-3 grid gap-4">
          <div>
            <a className="inline-flex items-center gap-2 text-[12px] font-medium text-[#2557d6] transition-opacity hover:opacity-70" href="https://stocksbrew.online/?utm_source=trace&utm_medium=edition_footer" target="_blank" rel="noopener noreferrer"><LineChart size={15} strokeWidth={1.8} />StocksBrew</a>
            <p className="mt-1 text-[12px]" style={{ color: MUTED }}>Know what to do with your stock.</p>
          </div>
          <div>
            <a className="inline-flex items-center gap-2 text-[12px] font-medium text-[#2557d6] transition-opacity hover:opacity-70" href="/api/affiliate/outbound?target=android_app&next=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Donline.yourtrace.app"><Smartphone size={15} strokeWidth={1.8} />Trace - Android</a>
            <p className="mt-1 text-[12px]" style={{ color: MUTED }}>TikTok for news.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

/** Mono blue section label, e.g. "01 · DEFINITION". */
export function MonoLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${className}`}
      style={{ color: BLUE }}
    >
      {children}
    </p>
  );
}

/** Compact one-line meta: "CNBC · 9h ago" or "5 sources · 2h ago". */
export function StoryMeta({ item, className = '' }: { item: FeedListItem; className?: string }) {
  const bits: string[] = [];
  if (item.source) bits.push(item.source);
  if (item.sourceCount > 1) bits.push(`${item.sourceCount} sources`);
  const ago = timeAgo(item.timestamp);
  if (ago) bits.push(ago);
  return (
    <span
      className={`font-mono text-[10.5px] uppercase tracking-[0.06em] ${className}`}
      style={{ color: MUTED }}
    >
      {bits.join(' · ')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Images (rationed: lead photo + revealed on expand). ?img=on only.
// ---------------------------------------------------------------------------

/** Image with ordered fallback chain: real thumbnail → curated Unsplash → picsum → hidden. */
export function StoryImage({
  item,
  className = '',
  useFallback = true,
}: {
  item: FeedListItem;
  className?: string;
  /** Pulse only uses source media. Edition can keep its editorial fallback chain. */
  useFallback?: boolean;
}) {
  const [candidateIndex, setCandidateIndex] = React.useState(0);
  const candidates = React.useMemo(
    () => useFallback
      ? getArticleImageCandidates(item.thumbnail, item.title)
      : item.thumbnail?.trim() ? [item.thumbnail] : [],
    [item.thumbnail, item.title, useFallback],
  );
  if (candidateIndex >= candidates.length) return null;
  return (
    <div className={`overflow-hidden border ${className}`} style={{ borderColor: HAIRLINE }}>
      <img
        src={candidates[candidateIndex]}
        alt={item.title}
        loading="lazy"
        onError={() => setCandidateIndex((i) => i + 1)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded story body (inline "open the section of the document" content)
// ---------------------------------------------------------------------------

type ExpandedContent = {
  paragraphs: string[];
  takeaways: string[];
  sources: { name: string; url?: string }[];
};

function getExpandedContent(item: FeedListItem): ExpandedContent {
  if (item.type === 'topic') {
    const topic = item.data as TrendingTopic;
    const paragraphs = (topic.summary || '')
      .split(/\n\n+/)
      .map((p) => stripMarkdown(p).trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const sources: { name: string; url?: string }[] = [];
    for (const article of topic.articles || []) {
      const name = article.source_name || article.source || '';
      if (!name || seen.has(name)) continue;
      seen.add(name);
      sources.push({ name, url: article.url });
      if (sources.length >= 5) break;
    }
    if (sources.length === 0 && item.source) {
      sources.push({ name: item.source, url: item.url });
    }
    return {
      paragraphs,
      takeaways: topic.key_points || [],
      sources,
    };
  }

  const article = item.data as FeedItem;
  const sa = article.summary?.short_article;
  const paragraphs = (sa?.body || article.description || '')
    .split(/\n\n+/)
    .map((p) => stripMarkdown(p).trim())
    .filter(Boolean);
  const sourceByName = new Map<string, { name: string; url?: string }>();
  for (const source of article.sources || []) {
    if (source.name) sourceByName.set(source.name, { name: source.name, url: source.url });
  }
  const primarySource = article.source_name || article.source || item.source;
  if (primarySource && !sourceByName.has(primarySource)) {
    sourceByName.set(primarySource, { name: primarySource, url: article.url || item.url });
  }

  return {
    paragraphs,
    takeaways: sa?.key_takeaways || [],
    sources: Array.from(sourceByName.values()),
  };
}

/** The inline-expanded "brief" for one story: paragraphs, numbered key points, sources. */
export function ExpandedStory({
  item,
  showImages = false,
  className = '',
  tracking,
}: {
  item: FeedListItem;
  showImages?: boolean;
  className?: string;
  tracking: {
    position: number;
    section: string;
    tier: 'free' | 'pro';
  };
}) {
  const content = getExpandedContent(item);
  return (
    <div className={`mx-auto max-w-[680px] pb-2 ${className}`}>
      {showImages && <StoryImage item={item} className="mb-5 aspect-[16/9] w-full" />}

      {content.paragraphs.map((p, i) => (
        <p key={i} className={`text-[15.5px] leading-[1.75] ${i > 0 ? 'mt-5' : ''}`} style={{ color: '#3d3a33' }}>
          {p}
        </p>
      ))}

      {content.takeaways.length > 0 && (
        <div className="mt-5">
          <MonoLabel>Key points</MonoLabel>
          <ul className="mt-3 space-y-2.5">
            {content.takeaways.map((point, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: BLUE }} />
                <span className="text-[14.5px] leading-[1.65]" style={{ color: '#3d3a33' }}>
                  {stripMarkdown(point)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.sources.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t pt-4" style={{ borderColor: HAIRLINE }}>
          <MonoLabel>Sources</MonoLabel>
          {content.sources.map((s, i) =>
            s.url ? (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackFeedSourceClicked({
                  itemId: item.id,
                  itemType: item.type,
                  source: s.name,
                  position: tracking.position,
                  section: tracking.section,
                  tier: tracking.tier,
                })}
                className="font-mono text-[11.5px] uppercase tracking-[0.08em] underline decoration-[0.5px] underline-offset-4"
                style={{ color: BLUE }}
              >
                {s.name} ↗
              </a>
            ) : (
              <span key={i} className="font-mono text-[11.5px] uppercase tracking-[0.08em]" style={{ color: MUTED }}>
                {s.name}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pro gating atoms
// ---------------------------------------------------------------------------

/** Blurred wireframe rows suggesting hidden stories — mirrors the real row shape. */
export function LockedWireRows({
  count,
  showImages = false,
}: {
  count: number;
  showImages?: boolean;
}) {
  return (
    <div aria-hidden>
      {Array.from({ length: Math.min(count, 2) }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-5 border-t py-5 sm:gap-7"
          style={{ borderColor: HAIRLINE, opacity: 1 - i * 0.22 }}
        >
          <div className="h-5 w-7 shrink-0 rounded-[3px]" style={{ background: '#dcd9d0', filter: 'blur(2px)' }} />
          <div className="min-w-0 flex-1">
            <div
              className="h-[15px] rounded-[3px]"
              style={{ background: '#d8d5cc', filter: 'blur(3px)', width: `${78 - i * 12}%` }}
            />
            <div
              className="mt-2 h-[11px] rounded-[3px]"
              style={{ background: '#e2dfd6', filter: 'blur(3px)', width: `${55 - i * 8}%` }}
            />
            <div
              className="mt-2.5 h-[9px] w-24 rounded-[3px]"
              style={{ background: '#e6e3da', filter: 'blur(2px)' }}
            />
          </div>
          {showImages && (
            <div
              className="h-[57px] w-[76px] shrink-0 rounded-[3px] sm:h-[84px] sm:w-[112px]"
              style={{ background: '#dcd9d0', filter: 'blur(3px)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** The one calm upsell — inkling's "EVIDENCE NOTE" box, but for Pro. */
export function ProEditionNote({
  visibleCount,
  totalCount,
  compact = false,
}: {
  visibleCount: number;
  totalCount: number;
  compact?: boolean;
}) {
  const tracked = React.useRef(false);
  const { user, profile, profileResolved, signInWithGoogle } = useAuth();
  const openCheckout = async () => {
    trackCheckoutClicked('feed_edition', {
      surface: 'web',
      visible_count: visibleCount,
      total_count: totalCount,
    });
    if (user && profileResolved) {
      window.location.href = getPostAuthDestination(profile, 'checkout');
      return;
    }
    const result = await signInWithGoogle('checkout');
    if (result.status === 'success') {
      window.location.href = getPostAuthDestination(result.profile, result.intent);
    }
  };

  React.useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackPaywallShown('feed_edition', {
      surface: 'web',
      visible_count: visibleCount,
      total_count: totalCount,
    });
  }, [totalCount, visibleCount]);

  return (
    <aside className={`${compact ? 'w-full px-5 py-5' : 'mt-10 border px-6 py-7 sm:px-8'} bg-[#f3f6ff]`} style={{ borderColor: '#d5def8' }}>
      <MonoLabel>Pro · The full edition</MonoLabel>
      <p
        className={`${editionSerif.className} mt-3 max-w-xl ${compact ? 'text-[19px] leading-[1.2]' : 'text-[22px] leading-[1.45]'}`}
        style={{ color: INK }}
      >
        Read the full day in about six minutes, with every story and source in one place.
      </p>
      {!compact && <ProBenefits className="mt-5" />}
      <div className={`${compact ? 'mt-4' : 'mt-5'} flex flex-wrap items-center gap-x-8 gap-y-3`}>
        <button
          type="button"
          onClick={() => void openCheckout()}
          className="inline-block px-6 py-3 text-[13.5px] font-semibold text-white"
          style={{ background: BLUE }}
        >
          Try Trace Pro
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: MUTED }}>
          Cancel anytime
        </span>
      </div>
    </aside>
  );
}

/** Makes the next-day return loop explicit without interrupting the edition. */
export function DailyBriefNote() {
  const { user, profile, profileResolved, refreshProfile } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  if (!user || !profileResolved || !profile?.updatedAt) return null;

  const enabled = profile.dailyNewsletterEnabled === true || profile.newsletterOptIn === true;
  const enableDailyBrief = async () => {
    setSaving(true);
    setError('');
    try {
      await updateUserProfile(user.uid, {
        dailyNewsletterEnabled: true,
        newsletterOptIn: true,
      });
      trackDailyBriefPreferenceChanged(true, 'feed');
      await refreshProfile();
    } catch {
      setError('Could not save that preference. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="mt-16 border-y py-8" style={{ borderColor: HAIRLINE }}>
      <div className="flex items-start gap-4">
        <Mail className="mt-1 shrink-0" size={18} strokeWidth={1.6} style={{ color: BLUE }} />
        <div className="min-w-0 flex-1">
          <MonoLabel>Tomorrow&rsquo;s edition</MonoLabel>
          {enabled ? (
            <>
              <p className={`${editionSerif.className} mt-3 text-[22px] leading-[1.4]`} style={{ color: INK }}>
                Your next personal brief will land in {user.email || 'your inbox'}.
              </p>
              <Link href="/profile" className="mt-3 inline-block text-[12px] font-semibold underline underline-offset-4" style={{ color: MUTED }}>
                Manage email
              </Link>
            </>
          ) : (
            <>
              <p className={`${editionSerif.className} mt-3 max-w-[560px] text-[22px] leading-[1.4]`} style={{ color: INK }}>
                Get your personal edition by email each morning.
              </p>
              <p className="mt-2 text-[13px] leading-[1.65]" style={{ color: MUTED }}>
                One brief based on your beats. Unsubscribe anytime.
              </p>
              <button
                type="button"
                onClick={enableDailyBrief}
                disabled={saving}
                className="mt-5 px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: BLUE }}
              >
                {saving ? 'Saving…' : 'Email me tomorrow’s edition'}
              </button>
              {error && <p className="mt-2 text-[12px] text-[#a33]">{error}</p>}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export function ProBenefits({ className = '' }: { className?: string }) {
  return (
    <ul className={`grid gap-3 sm:grid-cols-3 ${className}`}>
      {[
        { icon: Layers3, title: 'Every topic', detail: 'Read the full daily edition.' },
        { icon: ListChecks, title: 'Six minutes, not 50 tabs', detail: 'Get the day’s signal in one focused read.' },
        { icon: Sparkles, title: 'Every source', detail: 'Follow the complete evidence trail.' },
      ].map(({ icon: Icon, title, detail }) => (
        <li key={title} className="border-t pt-3" style={{ borderColor: HAIRLINE }}>
          <Icon size={16} strokeWidth={1.6} style={{ color: BLUE }} />
          <p className="mt-2 text-[13px] font-semibold" style={{ color: INK }}>{title}</p>
          <p className="mt-1 text-[12px] leading-[1.55]" style={{ color: MUTED }}>{detail}</p>
        </li>
      ))}
    </ul>
  );
}

/** Small inline tag marking locked sections/stories. */
export function ProTag() {
  return (
    <span
      className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{ color: BLUE }}
    >
      Pro
    </span>
  );
}
