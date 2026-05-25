import React, { useCallback, useState } from 'react';
import { Check, ExternalLink, Loader2, Share2 } from 'lucide-react';
import MarkdownProse from '@/components/MarkdownProse';
import { FeedItem, TrendingTopic, ONBOARDING_INTERESTS } from '@/lib/firestore';
import { getArticleImage, isValidThumbnail } from '@/lib/fallback-images';
import { getArticleSummary, getPreview, stripMarkdown, decodeHtmlEntities } from '@/lib/feed-article-text';

export { getArticleSummary, getPreview, stripMarkdown };

export function decodeHtml(str: string): string {
  return decodeHtmlEntities(str);
}

export const FREE_LIMITS = { trending: 3 };
export const FEED_TYPE_PREFIX: Record<string, string> = {
  for_you: 'fy',
  trending: 'tr',
};
export { MarkdownProse };

/* ─── Daily Brief Body Parser ─── */
type BriefBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'link'; source: string; title: string; url: string };

// Title may contain parentheses (e.g. "Foo (bar)"); anchor on a real http(s) URL, optionally
// markdown-wrapped as **(https://...)**.
const BRIEF_LINK_RE =
  /→\s+([^—\n]+?)\s+—\s+([\s\S]+?)\s*(?:\*\*)?\((https?:\/\/[^)\s]+)\)(?:\*\*)?/g;

export function looksLikeBriefBody(raw: string): boolean {
  return /→\s+[^—\n]+\s+—\s+[\s\S]*?(?:\*\*)?\(https?:\/\//.test(raw);
}

/** Turn a prose chunk into blocks: markdown ##, em-dash lead, or first-line / single-newline title. */
function pushTextChunkAsBlocks(chunk: string, blocks: BriefBlock[]) {
  const trimmed = chunk.trim();
  if (!trimmed) return;

  const lines = trimmed.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2 && lines[0].length <= 100 && lines[0].length >= 3 && !lines[0].startsWith('→')) {
    const restJoined = lines.slice(1).join(' ').replace(/\s+/g, ' ').trim();
    if (restJoined.length >= 25) {
      blocks.push({ type: 'heading', text: lines[0] });
      const stripped = restJoined.replace(/→\s*\[[^\]]+\]/g, '').trim();
      if (stripped.startsWith('## ')) blocks.push({ type: 'heading', text: stripped.slice(3).trim() });
      else if (stripped) blocks.push({ type: 'paragraph', text: stripped });
      return;
    }
  }

  const p = trimmed.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const stripped = p.replace(/→\s*\[[^\]]+\]/g, '').trim();
  if (!stripped) return;

  if (stripped.startsWith('## ')) {
    blocks.push({ type: 'heading', text: stripped.slice(3).trim() });
    return;
  }

  const emDash = /\s[—–]\s/.exec(stripped);
  if (emDash && emDash.index !== undefined && emDash.index > 0 && emDash.index < 72) {
    const left = stripped.slice(0, emDash.index).trim();
    const right = stripped.slice(emDash.index + emDash[0].length).trim();
    if (left.length < 90 && right.length > 15) {
      blocks.push({ type: 'heading', text: left });
      blocks.push({ type: 'paragraph', text: right });
      return;
    }
  }

  // Fused "short lead + sentence" (e.g. "Quarterly show-and-tell The Share Your Startup thread…")
  const fused = stripped.match(/^(.{8,78}?)\s+((?:The|This)\s+.+)/);
  if (fused && fused[1].length <= 78 && fused[2].length > 28) {
    blocks.push({ type: 'heading', text: fused[1].trim() });
    blocks.push({ type: 'paragraph', text: fused[2].trim() });
    return;
  }

  blocks.push({ type: 'paragraph', text: stripped });
}

function parseBriefBody(raw: string): BriefBlock[] {
  const blocks: BriefBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BRIEF_LINK_RE.lastIndex = 0;

  while ((match = BRIEF_LINK_RE.exec(raw)) !== null) {
    const before = raw.slice(lastIndex, match.index).trim();
    if (before) {
      for (const chunk of before.split(/\n\n+/)) {
        pushTextChunkAsBlocks(chunk, blocks);
      }
    }
    const title = match[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    blocks.push({ type: 'link', source: match[1].trim(), title, url: match[3] });
    lastIndex = match.index + match[0].length;
  }

  const tail = raw.slice(lastIndex).trim();
  if (tail) {
    for (const chunk of tail.split(/\n\n+/)) {
      pushTextChunkAsBlocks(chunk, blocks);
    }
  }

  return blocks;
}

type BriefLink = { source: string; title: string; url: string };

type BriefStory = {
  heading?: string;
  paragraphs: string[];
  link?: BriefLink;
  /** Same summary block, extra outlets (no duplicate section heading). */
  moreLinks?: { link: BriefLink; heading?: string }[];
};

function groupBriefBlocks(blocks: BriefBlock[]): BriefStory[] {
  const stories: BriefStory[] = [];
  let current: BriefStory = { paragraphs: [] };

  for (const block of blocks) {
    if (block.type === 'heading') {
      // flush current story if it has content
      if (current.paragraphs.length > 0) { stories.push(current); current = { paragraphs: [] }; }
      current.heading = block.text;
    } else if (block.type === 'paragraph') {
      current.paragraphs.push(block.text);
    } else if (block.type === 'link') {
      current.link = block;
      stories.push(current);
      current = { paragraphs: [] };
    }
  }
  if (current.paragraphs.length > 0) stories.push(current);
  return stories;
}

/** Link-only segments (common when one paragraph cites several outlets) fold into the prior block. */
function mergeBriefLinkOnlyStories(stories: BriefStory[]): BriefStory[] {
  const out: BriefStory[] = [];
  for (const story of stories) {
    const last = out[out.length - 1];
    const linkOnly = Boolean(story.link) && story.paragraphs.length === 0;

    if (linkOnly && last?.link) {
      if (!last.moreLinks) last.moreLinks = [];
      last.moreLinks.push({ link: story.link!, heading: story.heading });
      continue;
    }
    out.push(story);
  }
  return out;
}

function briefSourceKey(s: string): string {
  return s.trim().toLowerCase();
}

function briefLinkLabel(link: BriefLink): string {
  return [link.source, link.title].filter(Boolean).join(' — ') || link.title || 'Open source';
}

export function BriefBody({ body }: { body: string }) {
  const stories = mergeBriefLinkOnlyStories(groupBriefBlocks(parseBriefBody(body)));

  return (
    <div>
      {stories.map((story, i) => {
        const prev = i > 0 ? stories[i - 1] : undefined;
        const sameSourceAsPrev =
          Boolean(story.link && prev?.link) &&
          briefSourceKey(story.link!.source) === briefSourceKey(prev!.link!.source);
        const showSourceLabel = Boolean(story.link) && !sameSourceAsPrev;
        const headingDupesSource =
          Boolean(story.heading && story.link) &&
          briefSourceKey(story.heading!) === briefSourceKey(story.link!.source);

        const separator =
          i > 0
            ? sameSourceAsPrev
              ? 'pt-3 mt-3'
              : 'pt-5 mt-5 border-t border-border/10'
            : '';

        const showHeading = Boolean(story.heading && !headingDupesSource);
        const link = story.link;
        const linkLabel = link ? briefLinkLabel(link) : '';

        return (
        <div key={i} className={separator}>
          {showSourceLabel && !showHeading && link && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={linkLabel}
              aria-label={linkLabel}
              className="group mb-2 inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-sm text-inherit no-underline transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            >
              <span className="text-[10px] font-semibold text-foreground/45 uppercase tracking-[0.18em]">
                {link.source}
              </span>
              <ExternalLink
                size={14}
                strokeWidth={2}
                className="shrink-0 translate-y-px text-foreground/40 transition-colors group-hover:text-foreground"
                aria-hidden
              />
            </a>
          )}

          {showSourceLabel && showHeading && link && (
            <p className="text-[10px] font-semibold text-foreground/45 uppercase tracking-[0.18em] mb-2">
              {link.source}
            </p>
          )}

          {showHeading && link && (
            <h3 className="mb-2.5 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-foreground">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={linkLabel}
                aria-label={linkLabel}
                className="group inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-sm text-inherit no-underline transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
              >
                <span>{story.heading}</span>
                <ExternalLink
                  size={15}
                  strokeWidth={2}
                  className="shrink-0 translate-y-px text-foreground/45 transition-colors group-hover:text-foreground"
                  aria-hidden
                />
              </a>
            </h3>
          )}

          {showHeading && !link && (
            <h3 className="mb-2.5 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-foreground">
              {story.heading}
            </h3>
          )}

          {!showHeading && !(showSourceLabel && link) && link && (
            <div className="mb-2 flex justify-end">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={linkLabel}
                aria-label={linkLabel}
                className="group inline-flex max-w-full items-center gap-1.5 rounded-sm text-[14px] font-medium text-foreground/80 no-underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
              >
                <span className="line-clamp-2">{link.title || 'Open link'}</span>
                <ExternalLink
                  size={15}
                  strokeWidth={2}
                  className="shrink-0 text-foreground/40 transition-colors group-hover:text-foreground"
                  aria-hidden
                />
              </a>
            </div>
          )}

          {story.paragraphs.map((p, j) => (
            <p key={j} className="text-[15px] text-secondary leading-[1.65] mb-3 last:mb-0">{p}</p>
          ))}
        </div>
        );
      })}
    </div>
  );
}

export function getTimeLabel(dateStr?: string): string {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return '';
  const now = new Date();
  const date = new Date(ts);
  const diffMin = Math.floor((now.getTime() - ts) / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function pulseUrlsMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.trim().toLowerCase().replace(/\/$/, '').split('?')[0].split('#')[0];
  return norm(a) === norm(b);
}

export function getTopicDisplay(topic: TrendingTopic) {
  const isSingleton = (topic.source_count ?? 0) <= 1 || (topic.article_count ?? 0) <= 1;
  const article = isSingleton ? (topic.articles?.[0] ?? null) : null;
  return {
    isSingleton,
    article,
    title: decodeHtml(article?.title || topic.title || ''),
    summary: article?.summary?.short_article?.body || topic.summary || '',
    subtitle: article?.summary?.short_article?.subtitle || topic.summary || '',
    readingTime: article?.summary?.reading_time_minutes,
  };
}

export function isProductHuntWidget(url?: string | null): boolean {
  return !!url && /api\.producthunt\.com\/widgets\/embed-image/i.test(url);
}

type TimelineEvent = {
  id?: string;
  title: string;
  summary?: string;
  timestamp: string;
  source_name?: string;
  url?: string;
};


export const INTEREST_LABEL: Record<string, string> = Object.fromEntries(
  ONBOARDING_INTERESTS.map(i => [i.id, i.label])
);

/* ─── Sidebar Story Item ─── */
export function StoryItem({
  title,
  preview,
  timestamp,
  source,
  sourceCount,
  tag,
  thumbnail,
  selected,
  onClick,
}: {
  title: string;
  preview?: string;
  timestamp?: string;
  source?: string;
  sourceCount: number;
  tag?: string;
  thumbnail?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  const isMultiSource = sourceCount > 1;
  const tagLabel = tag ? INTEREST_LABEL[tag] : undefined;
  const imgUrl = thumbnail ? getArticleImage(thumbnail, title) : null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 transition-colors ${
        selected ? 'bg-surface-secondary' : 'hover:bg-surface-secondary/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1.5">
            {title}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {timestamp && (
              <span className="text-[10px] text-secondary/50">
                {getTimeLabel(timestamp)}
              </span>
            )}
            {timestamp && (source || isMultiSource) && (
              <span className="text-secondary/30 text-[10px]">·</span>
            )}
            {isMultiSource ? (
              <span className="text-[10px] text-secondary/50">{sourceCount} sources</span>
            ) : source ? (
              <span className="text-[10px] text-secondary/50 truncate">{source}</span>
            ) : null}
            {tagLabel && (
              <>
                <span className="text-secondary/30 text-[10px]">·</span>
                <span className="text-[10px] text-secondary/50">{tagLabel}</span>
              </>
            )}
          </div>
        </div>
        {imgUrl && (
          <img
            src={imgUrl}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="shrink-0 w-14 h-14 rounded-lg object-cover bg-foreground/5"
          />
        )}
      </div>
    </button>
  );
}

function PulseStoryItem({
  title,
  label,
  theme,
  signalCount,
  selected,
  onClick,
}: {
  title: string;
  label?: string;
  theme?: string;
  signalCount?: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-5 py-4 transition-colors ${
        selected ? 'bg-surface-secondary' : 'hover:bg-surface-secondary/50'
      }`}
    >
      <div className="min-w-0">
        {label && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-secondary/40 mb-1.5">
            {label}
          </p>
        )}
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1.5">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeof signalCount === 'number' && signalCount > 0 && (
            <span className="text-[10px] text-secondary/50">
              {signalCount} signal{signalCount === 1 ? '' : 's'}
            </span>
          )}
          {typeof signalCount === 'number' && signalCount > 0 && theme && (
            <span className="text-secondary/30 text-[10px]">·</span>
          )}
          {theme && (
            <span className="text-[10px] text-secondary/50 truncate">{theme}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Content Panel ─── */
export type ContentData = {
  title: string;
  body: string;
  source?: string;
  url?: string;
  shareUrl?: string;
  timestamp?: string;
  countLabel?: string;
  keyPoints?: string[];
  whyItMatters?: string;
  thumbnail?: string | null;
  timeline?: TimelineEvent[];
  /** Sidebar detail: default "Timeline" (News); Pulse uses "Signals". */
  timelineSectionLabel?: string;
  sourceCount?: number;
  readingTime?: number;
  articleSources?: { name: string; title: string; url: string }[];
};

export function ContentPanel({
  content,
  isLoadingDetail = false,
}: {
  content: ContentData;
  isLoadingDetail?: boolean;
}) {
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const imageUrl = content.thumbnail ? getArticleImage(content.thumbnail, content.title) : null;
  const productHuntWidget = isProductHuntWidget(imageUrl);
  const countLabel = content.countLabel || ((content.sourceCount || 0) > 1 ? `${content.sourceCount} sources` : '');
  const isMultiSource = Boolean(countLabel);
  const hasTimeline = content.timeline && content.timeline.length > 0;
  const sortedTimeline = hasTimeline
    ? [...content.timeline!].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];
  const timelineSectionTitle = content.timelineSectionLabel ?? 'Timeline';

  const handleShare = useCallback(async () => {
    const shareUrl = content.shareUrl || content.url;
    if (!shareUrl) return;
    setShareLoading(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    } finally {
      setShareLoading(false);
    }
  }, [content.shareUrl, content.title, content.url]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 sm:px-8 lg:px-10 py-6 sm:py-8">
        {/* Meta bar */}
        <div className="flex items-center gap-2 text-[12px] text-secondary/60 mb-4">
          {content.timestamp && <span>{getTimeLabel(content.timestamp)}</span>}
          {content.source && (
            <>
              <span className="text-secondary/30">·</span>
              <span>{content.source}</span>
            </>
          )}
          {isMultiSource && (
            <>
              <span className="text-secondary/30">·</span>
              <span className="font-medium text-secondary/70">{countLabel}</span>
            </>
          )}
          {content.readingTime && (
            <>
              <span className="text-secondary/30">·</span>
              <span>{content.readingTime} min read</span>
            </>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-[1.75rem] font-bold text-foreground leading-tight tracking-[-0.02em] mb-3">
          {content.title}
        </h1>

        {/* Source names strip for multi-source */}
        {isMultiSource && content.articleSources && content.articleSources.length > 0 && (
          <p className="text-[13px] text-secondary/50 mb-6">
            Synthesized from{' '}
            {content.articleSources.map((s, i) => (
              <span key={i}>
                {i > 0 && (i === content.articleSources!.length - 1 ? ' and ' : ', ')}
                <span className="text-secondary/70">{s.name}</span>
              </span>
            ))}
          </p>
        )}

        {!isMultiSource && <div className="mb-6" />}

        {/* Thumbnail */}
        {imageUrl && (
          <div className="mb-8">
            <img
              src={imageUrl}
              alt=""
              decoding="async"
              className={
                productHuntWidget
                  ? 'max-w-[280px] rounded-2xl border border-[#ff6154]/20 bg-white'
                  : 'max-h-[300px] rounded-xl object-contain'
              }
            />
          </div>
        )}

        {/* Body / Overview */}
        {isLoadingDetail && !content.body ? (
          <div className="mb-8">
            <h3 className="text-[11px] font-semibold text-secondary/60 mb-4 uppercase tracking-[0.15em]">Overview</h3>
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-foreground/8 rounded w-full" />
              <div className="h-4 bg-foreground/8 rounded w-[92%]" />
              <div className="h-4 bg-foreground/8 rounded w-[85%]" />
              <div className="h-4 bg-foreground/8 rounded w-[96%]" />
              <div className="h-4 bg-foreground/8 rounded w-[78%]" />
            </div>
          </div>
        ) : content.body ? (() => {
          const isBriefFormat = looksLikeBriefBody(content.body);
          return (
            <div className="text-secondary leading-relaxed mb-8">
              {!isBriefFormat && (
                <h3 className="text-[11px] font-semibold text-secondary/60 mb-4 uppercase tracking-[0.15em]">
                  Overview
                </h3>
              )}
              {isBriefFormat ? (
                <BriefBody body={content.body} />
              ) : (
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <MarkdownProse body={content.body} />
                </div>
              )}
            </div>
          );
        })() : null}

        {/* Key Takeaways */}
        {isLoadingDetail && !content.keyPoints ? (
          <div className="mb-8">
            <h3 className="text-[11px] font-semibold text-secondary/60 mb-4 uppercase tracking-[0.15em]">Key Takeaways</h3>
            <div className="space-y-3 animate-pulse">
              {[100, 88, 94, 82].map((w, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-4 w-4 bg-foreground/8 rounded shrink-0 mt-0.5" />
                  <div className={`h-4 bg-foreground/8 rounded`} style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          </div>
        ) : content.keyPoints && content.keyPoints.length > 0 ? (
          <div className="mb-8">
            <h3 className="text-[11px] font-semibold text-secondary/60 mb-4 uppercase tracking-[0.15em]">
              Key Takeaways
            </h3>
            <div className="space-y-3">
              {content.keyPoints.map((point, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-secondary/35 font-mono text-xs mt-0.5">{i + 1}.</span>
                  <p className="text-[15px] text-secondary/80 leading-relaxed">{stripMarkdown(point)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Timeline (News) / Signals (Pulse) */}
        {hasTimeline && (
          <div className="mb-8">
            <h3 className="text-[11px] font-semibold text-secondary/50 mb-4 uppercase tracking-[0.15em]">
              {timelineSectionTitle}
            </h3>
            <div className="space-y-1">
              {sortedTimeline.slice(0, 8).map((event, i) => {
                const inner = (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-secondary/50">{getTimeLabel(event.timestamp)}</span>
                      {event.source_name && (
                        <>
                          <span className="text-secondary/30 text-[10px]">·</span>
                          <span className="text-[10px] text-secondary/50 truncate max-w-[140px]">{event.source_name}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground leading-snug">{event.title}</h4>
                        {event.summary && (
                          <p className="text-xs text-secondary/50 line-clamp-2 mt-1">{stripMarkdown(event.summary)}</p>
                        )}
                      </div>
                      {event.url && <ExternalLink size={13} className="shrink-0 mt-0.5 text-secondary/25 group-hover:text-secondary/50 transition-colors" />}
                    </div>
                  </>
                );
                return event.url ? (
                  <a
                    key={event.id || i}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg px-3 py-3 -mx-3 hover:bg-foreground/4 transition-colors"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={event.id || i} className="px-3 py-3 -mx-3">
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(content.shareUrl || content.url) && (
          <div className="pt-6 border-t border-border/15">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleShare}
                disabled={shareLoading}
                className="inline-flex items-center gap-2 rounded-full border border-border/25 bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-foreground/5 disabled:opacity-60"
              >
                {shareLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : shareCopied ? (
                  <Check size={14} className="text-green-500" />
                ) : (
                  <Share2 size={14} />
                )}
                {shareLoading ? 'Copying...' : shareCopied ? 'Link copied' : 'Copy article link'}
              </button>
              {content.url && (
                <a
                  href={content.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Read original source
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Shared with News ContentPanel — pulse page uses the same reading rhythm */
