"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, Lock, Sparkles, ExternalLink, Maximize2, Minimize2, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import {
  getV3UserFeed, V3UserFeed, FeedItem, TrendingTopic,
  recordLastActive, ONBOARDING_INTERESTS,
} from '@/lib/firestore';
import { getArticleImage, isValidThumbnail } from '@/lib/fallback-images';
import { trackCheckoutClicked, trackPaywallShown, trackSubscriptionStarted } from '@/lib/posthog';
import { PulseBetaBadge } from '@/components/PulseBetaBadge';

function decodeHtml(str: string): string {
  if (!str) return str;
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

const FREE_LIMITS = { trending: 3 };

const feedFetcher = (uid: string, role?: string | null) => getV3UserFeed(uid, { role });

const trendingFetcher = async () => {
  const res = await fetch('/api/public/trending');
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data.items)) return [];
  return data.items.map((item: Record<string, unknown>): FeedItem => ({
    id: String(item.id || ''),
    title: decodeHtml(String(item.title || '')),
    url: String(item.url || ''),
    thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : null,
    source_name: typeof item.source === 'string' ? item.source : undefined,
    summary: { short_article: { subtitle: typeof item.summary === 'string' ? item.summary : '' } },
  }));
};

/* ─── Daily Brief Body Parser ─── */
type BriefBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'link'; source: string; title: string; url: string };

// Title may contain parentheses (e.g. "Foo (bar)"); anchor on a real http(s) URL, optionally
// markdown-wrapped as **(https://...)**.
const BRIEF_LINK_RE =
  /→\s+([^—\n]+?)\s+—\s+([\s\S]+?)\s*(?:\*\*)?\((https?:\/\/[^)\s]+)\)(?:\*\*)?/g;

function looksLikeBriefBody(raw: string): boolean {
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

function BriefBody({ body }: { body: string }) {
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

function stripMarkdown(text: string): string {
  return (text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^\s*#+\s*/gm, "")
    .trim();
}

function getTimeLabel(dateStr?: string): string {
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

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function pulseUrlsMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.trim().toLowerCase().replace(/\/$/, '').split('?')[0].split('#')[0];
  return norm(a) === norm(b);
}

function getTopicDisplay(topic: TrendingTopic) {
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

function getArticleSummary(item: FeedItem): string {
  return stripMarkdown(
    item.summary?.short_article?.body ||
    item.summary?.short_article?.subtitle ||
    item.description ||
    ''
  );
}

function getPreview(text: string, maxLen = 100): string {
  if (!text) return '';
  const clean = stripMarkdown(text);
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).trim() + '...';
}

function isProductHuntWidget(url?: string | null): boolean {
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


const INTEREST_LABEL: Record<string, string> = Object.fromEntries(
  ONBOARDING_INTERESTS.map(i => [i.id, i.label])
);

/* ─── Sidebar Story Item ─── */
function StoryItem({
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
type ContentData = {
  title: string;
  body: string;
  source?: string;
  url?: string;
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

function ContentPanel({
  content,
}: {
  content: ContentData;
}) {
  const imageUrl = content.thumbnail ? getArticleImage(content.thumbnail, content.title) : null;
  const productHuntWidget = isProductHuntWidget(imageUrl);
  const countLabel = content.countLabel || ((content.sourceCount || 0) > 1 ? `${content.sourceCount} sources` : '');
  const isMultiSource = Boolean(countLabel);
  const hasTimeline = content.timeline && content.timeline.length > 0;
  const sortedTimeline = hasTimeline
    ? [...content.timeline!].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];
  const timelineSectionTitle = content.timelineSectionLabel ?? 'Timeline';

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
              className={
                productHuntWidget
                  ? 'max-w-[280px] rounded-2xl border border-[#ff6154]/20 bg-white'
                  : 'max-h-[300px] rounded-xl object-contain'
              }
            />
          </div>
        )}

        {/* Body / Overview */}
        {content.body && (() => {
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.body}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })()}

        {/* Key Takeaways */}
        {content.keyPoints && content.keyPoints.length > 0 && (
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
        )}

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

        {/* Original source link (single-source only) */}
        {!hasTimeline && content.url && (
          <div className="pt-6 border-t border-border/15">
            <a
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              Read original source
              <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** Shared with News ContentPanel — pulse page uses the same reading rhythm */
const PULSE_EYEBROW =
  'text-[11px] font-semibold text-secondary/60 uppercase tracking-[0.15em]';
const PULSE_SECTION = 'mb-10 sm:mb-12';
/** Pulse shell: mobile matches News (`bg-background`); md+ uses the same white card as desktop News */
const PULSE_MAIN_SHELL =
  'overflow-hidden bg-background md:rounded-2xl md:border md:border-border/15 md:bg-white md:shadow-[0_1px_3px_rgba(0,0,0,0.04)]';

function FeedModeToggle({
  view,
  onChange,
}: {
  view: 'pulse' | 'briefing';
  onChange: (view: 'pulse' | 'briefing') => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-foreground/6 p-1">
      {([
        { key: 'briefing' as const, label: 'News' },
        { key: 'pulse' as const, label: 'Pulse' },
      ] as const).map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
            view === item.key
              ? 'bg-foreground text-background'
              : 'text-secondary/70 hover:text-foreground'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function PulseToolsGrid({ items }: { items: FeedListItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
      {items.map((item) => {
        const thumb = item.thumbnail && isValidThumbnail(item.thumbnail)
          ? getArticleImage(item.thumbnail, item.title)
          : null;
        const isPH = thumb ? isProductHuntWidget(thumb) : false;
        return (
          <a
            key={item.id}
            href={item.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 rounded-xl border border-border/20 bg-white hover:border-border/40 hover:shadow-sm transition-all p-3.5"
          >
            {thumb && (
              <div className={`shrink-0 ${isPH ? 'w-12 h-12 bg-white rounded-lg border border-[#ff6154]/15 p-1 flex items-center justify-center' : 'w-12 h-12 rounded-lg overflow-hidden'}`}>
                <img
                  src={thumb}
                  alt=""
                  className={isPH ? 'w-full h-full object-contain' : 'w-full h-full object-cover'}
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-foreground leading-snug group-hover:underline decoration-foreground/30 underline-offset-2 line-clamp-1">
                  {item.title}
                </p>
                <ExternalLink size={12} className="shrink-0 mt-0.5 text-secondary/30 group-hover:text-secondary/60 transition-colors" />
              </div>
              {item.preview && (
                <p className="text-[12px] text-secondary/60 leading-snug mt-0.5 line-clamp-2">{item.preview}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {item.source && (
                  <span className="text-[10px] font-medium text-secondary/45 uppercase tracking-wide">{item.source}</span>
                )}
                {item.signalCount != null && item.signalCount > 0 && (
                  <>
                    <span className="text-secondary/25">·</span>
                    <span className="text-[10px] text-secondary/45">{item.signalCount.toLocaleString()} {item.source === 'Product Hunt' ? 'upvotes' : item.source === 'GitHub Trending' ? 'stars today' : 'points'}</span>
                  </>
                )}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

/* ─── Daily Pulse Scroll View — card components ─── */
function DailyPulseToolCard({ item }: { item: FeedListItem }) {
  const thumb = item.thumbnail && isValidThumbnail(item.thumbnail)
    ? getArticleImage(item.thumbnail, item.title) : null;
  const isPH = thumb ? isProductHuntWidget(thumb) : false;

  return (
    <a
      href={item.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-xl border border-border/20 bg-white hover:border-border/40 hover:shadow-sm transition-all p-3.5"
    >
      {thumb && (
        <div className={`shrink-0 ${isPH ? 'w-11 h-11 bg-white rounded-lg border border-[#ff6154]/15 p-1 flex items-center justify-center' : 'w-11 h-11 rounded-lg overflow-hidden'}`}>
          <img src={thumb} alt="" className={isPH ? 'w-full h-full object-contain' : 'w-full h-full object-cover'} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-semibold text-foreground leading-snug group-hover:underline decoration-foreground/30 underline-offset-2 line-clamp-1">{item.title}</p>
          <ExternalLink size={11} className="shrink-0 mt-0.5 text-secondary/30 group-hover:text-secondary/60 transition-colors" />
        </div>
        {item.preview && <p className="text-[12px] text-secondary/60 leading-snug mt-0.5 line-clamp-2">{item.preview}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {item.source && <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wide">{item.source}</span>}
          {item.signalCount != null && item.signalCount > 0 && (
            <>
              <span className="text-foreground/20">·</span>
              <span className="text-[10px] text-secondary/60">
                {item.signalCount.toLocaleString()} {item.source === 'Product Hunt' ? 'upvotes' : item.source === 'GitHub Trending' ? 'stars today' : 'points'}
              </span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}

function DailyPulseBlogCard({ item }: { item: FeedListItem }) {
  const feedItem = item.data as FeedItem;
  const body = feedItem.summary?.short_article?.body || '';
  const isBrief = body ? looksLikeBriefBody(body) : false;

  return (
    <div className="rounded-2xl border border-border/15 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        {item.source && (
          <span className="text-[11px] font-semibold text-foreground/55 uppercase tracking-[0.12em]">{item.source}</span>
        )}
        {item.source && item.timestamp && <span className="text-foreground/20 text-[10px]">·</span>}
        {item.timestamp && <span className="text-[11px] text-secondary/55">{getTimeLabel(item.timestamp)}</span>}
      </div>
      <h3 className="text-[17px] font-bold text-foreground leading-snug tracking-[-0.02em] mb-4">{item.title}</h3>
      {isBrief && body ? (
        <div className="mb-4">
          <BriefBody body={body} />
        </div>
      ) : item.preview ? (
        <p className="text-[14px] text-secondary/75 leading-relaxed mb-4">{item.preview}</p>
      ) : null}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground/50 hover:text-foreground underline underline-offset-2 decoration-foreground/20 hover:decoration-foreground/50 transition-colors"
        >
          Read original <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function DailyPulseDiscussionCard({ item }: { item: FeedListItem }) {
  const mainUrl = item.url || item.pulseSources?.[0]?.url;
  const extraLinks = (item.pulseSources || []).filter(
    s => !mainUrl || !pulseUrlsMatch(s.url, mainUrl)
  );

  const cardBody = (
    <div className="rounded-xl border border-border/20 bg-white p-4 h-full flex flex-col group hover:border-border/40 hover:shadow-sm transition-all">
      <div className="flex items-center gap-1.5 mb-2">
        {item.source && (
          <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.12em]">{item.source}</span>
        )}
        {item.signalCount != null && item.signalCount > 0 && (
          <>
            <span className="text-foreground/20">·</span>
            <span className="text-[10px] text-secondary/60">{item.signalCount.toLocaleString()} signals</span>
          </>
        )}
      </div>
      <p className="text-[13px] font-semibold text-foreground leading-snug mb-2 group-hover:underline decoration-foreground/30 underline-offset-2">{item.title}</p>
      {item.preview && (
        <p className="text-[12px] text-secondary/65 leading-relaxed mb-3 whitespace-pre-wrap">{item.preview}</p>
      )}
      {extraLinks.length > 0 && (
        <div className="flex gap-3 flex-wrap mt-auto pt-2">
          {extraLinks.map(s => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/45 hover:text-foreground transition-colors"
            >
              {s.name} <ExternalLink size={10} />
            </a>
          ))}
        </div>
      )}
      {mainUrl && (
        <div
          className={`flex items-center justify-end gap-1.5 pt-3 border-t border-border/10 text-[11px] font-semibold text-secondary/55 group-hover:text-foreground/75 transition-colors ${
            extraLinks.length === 0 ? 'mt-auto' : ''
          }`}
        >
          <span>Open thread</span>
          <ExternalLink size={13} className="shrink-0 text-secondary/45 group-hover:text-foreground/60" aria-hidden />
        </div>
      )}
    </div>
  );

  if (mainUrl) {
    return (
      <a
        href={mainUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/20"
      >
        {cardBody}
      </a>
    );
  }
  return cardBody;
}

function DailyPulseView({
  pulseSections,
  hasWeeklyPulse,
  pulseStoryCount,
}: {
  pulseSections: Array<{ key: string; label: string; items: FeedListItem[] }>;
  hasWeeklyPulse: boolean;
  pulseStoryCount: number;
}) {
  const tools = pulseSections.find(s => s.key === 'tools')?.items ?? [];
  const blogs = pulseSections.find(s => s.key === 'blogs')?.items ?? [];
  const discussions = pulseSections.find(s => s.key === 'discussions')?.items ?? [];
  const legacy = pulseSections.find(s => s.key === 'pulse')?.items ?? [];
  const isEmpty = tools.length + blogs.length + discussions.length + legacy.length === 0;

  if (isEmpty) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-secondary/55">Your pulse is on its way</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-0 pb-20 pt-8">
      <div className="mb-8 pb-5 border-b border-border/10">
        <p className="text-[10px] font-semibold text-foreground/35 uppercase tracking-[0.22em] mb-2">
          {hasWeeklyPulse ? 'Weekly Pulse' : 'Daily Pulse'}
        </p>
        <h1 className="text-[1.5rem] font-bold text-foreground tracking-[-0.025em] leading-tight">
          {getTodayLabel()}
        </h1>
        {pulseStoryCount > 0 && (
          <p className="text-[12px] text-secondary/50 mt-1">{pulseStoryCount} picks curated for you</p>
        )}
      </div>

      {/* Legacy (non-weekly) pulse */}
      {!hasWeeklyPulse && legacy.length > 0 && (
        <div className="divide-y divide-border/10">
          {legacy.map(item => (
            <PulseSectionItem
              key={item.id}
              title={item.title}
              preview={item.preview}
              source={item.source}
              timestamp={item.timestamp}
              thumbnail={item.thumbnail}
              headlineUrl={item.url}
              pulseSources={item.pulseSources}
              flush
            />
          ))}
        </div>
      )}

      {tools.length > 0 && (
        <section className="mb-12">
          <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-5">
            What People Are Building
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tools.map(item => <DailyPulseToolCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {blogs.length > 0 && (
        <section className="mb-12">
          <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-5">
            {hasWeeklyPulse ? 'What Happened This Week' : 'What Happened Today'}
          </p>
          <div className="space-y-4">
            {blogs.map(item => <DailyPulseBlogCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {discussions.length > 0 && (
        <section className="mb-12">
          <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-[0.2em] mb-5">
            What People Are Saying
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {discussions.map(item => <DailyPulseDiscussionCard key={item.id} item={item} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function PulseSectionItem({
  title,
  preview,
  source,
  timestamp,
  thumbnail,
  active,
  compact,
  flush,
  headlineUrl,
  pulseSources,
  onClick,
}: {
  title: string;
  preview?: string;
  source?: string;
  timestamp?: string;
  thumbnail?: string | null;
  active?: boolean;
  compact?: boolean;
  /** List rows with dividers — no card chrome */
  flush?: boolean;
  /** Opens in a new tab; only the headline is linked. */
  headlineUrl?: string;
  /** Extra outbound links (e.g. HN + Reddit) below the overview. */
  pulseSources?: Array<{ name: string; title?: string; url: string }>;
  /** Omit for static rows (no hover, not a button). */
  onClick?: () => void;
}) {
  const imageUrl = (() => {
    if (flush) return null;
    if (compact) {
      return !isValidThumbnail(thumbnail) ? null : getArticleImage(thumbnail, title);
    }
    return isValidThumbnail(thumbnail) ? getArticleImage(thumbnail, title) : null;
  })();

  const imgClass = (() => {
    if (!imageUrl) return '';
    if (isProductHuntWidget(imageUrl)) {
      if (compact) return 'w-[72px] h-[42px] object-contain rounded-lg border border-[#ff6154]/15 bg-white p-1';
      return 'w-[76px] h-[46px] object-contain rounded-xl border border-[#ff6154]/15 bg-white p-1.5';
    }
    if (compact) return 'w-12 h-12 rounded-lg object-cover';
    return 'w-14 h-14 rounded-xl object-cover';
  })();

  const interactive = Boolean(onClick);
  const outerClass = flush
    ? interactive
      ? `w-full text-left transition-colors py-4 sm:py-5 ${active ? 'bg-surface-secondary/70' : 'hover:bg-surface-secondary/40'}`
      : 'w-full text-left py-4 sm:py-5'
    : compact
      ? 'w-full text-left transition-colors py-3'
      : `w-full text-left transition-colors rounded-2xl border px-4 py-4 ${
          active
            ? 'border-foreground/15 bg-foreground/[0.035]'
            : 'border-border/20 bg-white hover:bg-surface-secondary/40'
        }`;

  const body = (
    <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {flush ? (
            <>
              <h3 className="text-sm font-semibold text-foreground leading-snug mb-1.5">
                {headlineUrl ? (
                  <a
                    href={headlineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex max-w-full items-start gap-1.5 rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2"
                  >
                    <span className="min-w-0 flex-1 decoration-foreground/35 underline-offset-[3px] group-hover:underline">
                      {title}
                    </span>
                    <ExternalLink
                      size={14}
                      className="mt-0.5 shrink-0 text-secondary/45 transition-colors group-hover:text-foreground/60"
                      aria-hidden
                    />
                    <span className="sr-only">Opens in a new tab</span>
                  </a>
                ) : (
                  title
                )}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                {timestamp && (
                  <span className="text-[10px] text-secondary/50">{getTimeLabel(timestamp)}</span>
                )}
                {timestamp && source && <span className="text-secondary/30 text-[10px]">·</span>}
                {source && (
                  <span className="text-[10px] text-secondary/50 truncate">{source}</span>
                )}
              </div>
              {preview && (
                <p className="mt-1.5 text-[13px] text-secondary/65 leading-relaxed whitespace-pre-wrap wrap-break-word">
                  {preview}
                </p>
              )}
              {(() => {
                const extra = (pulseSources || []).filter(
                  (s) => headlineUrl && !pulseUrlsMatch(s.url, headlineUrl),
                );
                if (extra.length === 0) return null;
                return (
                  <div className="mt-3 border-t border-border/10 pt-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-secondary/45">
                      {extra.length > 1 ? 'Links' : 'Also linked'}
                    </p>
                    <ul className="space-y-2">
                      {extra.map((s) => (
                        <li key={s.url}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex max-w-full items-center gap-1.5 rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2"
                            onClick={interactive ? (e) => e.stopPropagation() : undefined}
                          >
                            <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug decoration-foreground/35 underline-offset-[3px] group-hover:underline">
                              {s.name}
                            </span>
                            <ExternalLink
                              size={12}
                              className="shrink-0 text-secondary/40 transition-colors group-hover:text-foreground/55"
                              aria-hidden
                            />
                            <span className="sr-only">Opens in a new tab</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
                {source && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-secondary/45">
                    {source}
                  </span>
                )}
                {source && timestamp && <span className="text-secondary/25 text-[10px]">·</span>}
                {timestamp && (
                  <span className="text-[10px] text-secondary/45">{getTimeLabel(timestamp)}</span>
                )}
              </div>
              <p
                className={`font-semibold text-foreground leading-snug line-clamp-2 ${
                  compact ? 'text-[13px]' : 'text-[14px]'
                }`}
              >
                {title}
              </p>
              {preview && (
                <p
                  className={`mt-1.5 leading-relaxed ${
                    compact ? 'text-[11px] line-clamp-2 text-secondary/65' : 'text-[12px] line-clamp-3 text-secondary/65'
                  }`}
                >
                  {preview}
                </p>
              )}
            </>
          )}
        </div>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className={`shrink-0 bg-foreground/5 ${imgClass}`}
          />
        )}
      </div>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={outerClass}>
        {body}
      </button>
    );
  }
  return <div className={outerClass}>{body}</div>;
}

function PulseLeadStory({
  content,
}: {
  content: ContentData;
}) {
  const imageUrl = content.thumbnail ? getArticleImage(content.thumbnail, content.title) : null;
  const productHuntWidget = isProductHuntWidget(imageUrl);
  const countLabel = content.countLabel || ((content.sourceCount || 0) > 1 ? `${content.sourceCount} sources` : '');
  const isMultiSource = Boolean(countLabel);
  const keyPoints = (content.keyPoints || []).slice(0, 2);

  return (
    <article>
      <div className="flex items-center gap-2 text-[11px] text-secondary/50 mb-3">
        {content.timestamp && <span>{getTimeLabel(content.timestamp)}</span>}
        {content.source && (
          <>
            <span className="text-secondary/25">·</span>
            <span>{content.source}</span>
          </>
        )}
        {isMultiSource && (
          <>
            <span className="text-secondary/25">·</span>
            <span className="font-medium text-secondary/65">{countLabel}</span>
          </>
        )}
      </div>

      <h2 className="text-[1.9rem] font-bold tracking-[-0.04em] text-foreground leading-tight sm:text-[2.4rem]">
        {content.title}
      </h2>

      {imageUrl && (
        <div className="mt-5 mb-6">
          <img
            src={imageUrl}
            alt=""
            className={
              productHuntWidget
                ? 'max-w-[300px] rounded-2xl border border-[#ff6154]/20 bg-white'
                : 'w-full max-h-[360px] rounded-[24px] object-cover'
            }
          />
        </div>
      )}

      {content.body && (
        <div className="prose prose-slate max-w-none text-secondary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.body}</ReactMarkdown>
        </div>
      )}

      {keyPoints.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/40 mb-3">Key Takeaways</h3>
          <div className="space-y-2.5">
            {keyPoints.map((point, index) => (
              <div key={index} className="flex gap-3">
                <span className="text-secondary/35 font-mono text-xs mt-0.5">{index + 1}.</span>
                <p className="text-[15px] text-secondary/80 leading-relaxed">{stripMarkdown(point)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.url && (
        <div className="pt-6 mt-6 border-t border-border/15">
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90"
          >
            Read original source
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </article>
  );
}

type FeedListItem = {
  id: string;
  type: 'topic' | 'article';
  pulseSection?: 'tools' | 'blogs' | 'discussions';
  title: string;
  preview: string;
  timestamp?: string;
  source?: string;
  sourceCount: number;
  thumbnail?: string | null;
  interestId?: string;
  tags?: string[];
  theme?: string;
  heat?: number;
  signalCount?: number;
  /** Original article URL (pulse community/build rows). */
  url?: string;
  /** Multiple discussion links (pulse; from API `sources`). */
  pulseSources?: Array<{ name: string; title?: string; url: string }>;
  data: TrendingTopic | FeedItem;
};

function getContentFromFeedListItem(item: FeedListItem | null): ContentData | null {
  if (!item) return null;

  if (item.type === 'topic') {
    const topic = item.data as TrendingTopic;
    const display = getTopicDisplay(topic);
    const articleUrl = display.isSingleton ? display.article?.url : topic.articles?.[0]?.url;
    return {
      title: decodeHtml(display.title || ''),
      body: display.summary || display.subtitle,
      source: display.isSingleton ? display.article?.source_name : undefined,
      url: articleUrl,
      timestamp: topic.articles?.[0]?.published_date,
      keyPoints: display.isSingleton
        ? display.article?.summary?.short_article?.key_takeaways
        : topic.key_points,
      thumbnail: display.isSingleton ? display.article?.thumbnail : topic.thumbnail,
      timeline: !display.isSingleton
        ? topic.timeline?.map(e => ({ ...e, url: e.article_url || e.source_url }))
        : undefined,
      sourceCount: topic.source_count,
      countLabel: topic.source_count && topic.source_count > 1 ? `${topic.source_count} sources` : undefined,
      whyItMatters: display.isSingleton
        ? display.article?.summary?.short_article?.why_it_matters
        : undefined,
      readingTime: display.readingTime,
      articleSources: !display.isSingleton
        ? topic.articles?.map(a => ({ name: a.source_name || '', title: a.title, url: a.url })).filter(s => s.name)
        : undefined,
    };
  }

  const article = item.data as FeedItem;
  const isPulseStory = Boolean(article.metadata?.pulse_story || article.metadata?.pulse);
  return {
    title: decodeHtml(article.title || ''),
    body: getArticleSummary(article),
    source: isPulseStory
      ? (article.metadata?.theme || article.summary?.short_article?.subtitle || article.source_name)
      : (article.source_name || article.source),
    url: article.url,
    timestamp: article.published_date,
    countLabel: isPulseStory
      ? `${article.metadata?.signal_count || article.sources?.length || item.signalCount || 1} signal${(article.metadata?.signal_count || article.sources?.length || item.signalCount || 1) === 1 ? '' : 's'}`
      : ((article.metadata?.source_count || item.sourceCount || 0) > 1 ? `${article.metadata?.source_count || item.sourceCount} sources` : undefined),
    keyPoints: article.summary?.short_article?.key_takeaways,
    thumbnail: article.thumbnail,
    timeline: isPulseStory
      ? ((article.signals || article.timeline || []) as TimelineEvent[])
      : undefined,
    timelineSectionLabel: isPulseStory ? 'Signals' : undefined,
    sourceCount: article.metadata?.source_count,
    whyItMatters: article.summary?.short_article?.why_it_matters,
    readingTime: article.summary?.reading_time_minutes,
    articleSources: article.sources?.filter(s => s.name) as ContentData['articleSources'],
  };
}

/* ─── Upgrade CTA Card ─── */
function UpgradeCard({ lockedCount }: { lockedCount: number }) {
  return (
    <div className="p-4 mx-5 my-3 rounded-xl bg-linear-to-br from-foreground/5 to-foreground/10 border border-foreground/8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
          <Lock size={14} className="text-foreground/60" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{lockedCount}+ more stories</p>
          <p className="text-[11px] text-secondary/50">Unlock with Pro</p>
        </div>
      </div>
      <Link
        href="/profile?tab=subscription"
        onClick={() => trackCheckoutClicked('feed_upgrade_card_trending', { locked_count: lockedCount })}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full text-sm font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
      >
        <Sparkles size={14} />
        Start Free Trial
      </Link>
    </div>
  );
}

/* ─── Full-width Paywall Gate ─── */
const INDIA_PRICING = { trialDays: 1, priceDisplay: '₹10/month', pricingOffer: 'india' as const };
const DEFAULT_PRICING = { trialDays: 3, priceDisplay: '$4.99/month', pricingOffer: 'default' as const };

function guessClientPricing() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Kolkata') return INDIA_PRICING;
    const lang = (navigator.language || '').toLowerCase();
    if (lang === 'en-in' || lang.endsWith('-in')) return INDIA_PRICING;
  } catch {}
  return DEFAULT_PRICING;
}

function PaywallGate() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Default on server; client guess applied in useEffect before API confirms
  const [pricingPreview, setPricingPreview] = React.useState<typeof INDIA_PRICING | typeof DEFAULT_PRICING>(DEFAULT_PRICING);

  // Still confirm with server in background (handles VPN / edge cases)
  React.useEffect(() => {
    let cancelled = false;
    // Apply client-side timezone/locale guess immediately (synchronous, no round-trip)
    setPricingPreview(guessClientPricing());
    const confirm = async () => {
      try {
        const token = await user?.getIdToken();
        const response = await fetch('/api/subscription/pricing', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setPricingPreview(data);
      } catch {}
    };
    void confirm();
    return () => { cancelled = true; };
  }, [user]);

  const handleStartTrial = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    trackCheckoutClicked('feed_paywall_gate');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create checkout');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const benefits = [
    {
      title: 'Your pulse, every day',
      desc: 'Wake up to a full feed of stories filtered to what you care about — AI, tech, markets, whatever you follow.',
    },
    {
      title: 'The point, not the whole article',
      desc: "We read it for you. You get the summary, the key takeaways, and why it matters — in under a minute.",
    },
    {
      title: '10 outlets covered it. We show you one.',
      desc: 'When everyone writes about the same story, we collapse it into a single clear view so you stop reading the same thing twice.',
    },
    {
      title: 'No rabbit holes',
      desc: "Skim today's feed in 5 minutes. Know what's going on. Move on with your day.",
    },
  ];
  const trialDays = pricingPreview.trialDays;
  const priceDisplay = pricingPreview.priceDisplay;
  const planName = pricingPreview.pricingOffer === 'india' ? 'Trace Pro India' : 'Trace Pro';
  return (
    <div className="w-full sm:rounded-2xl sm:bg-surface sm:shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="max-w-md mx-auto px-6 sm:px-12 py-10 sm:py-16">
        <p className="text-[11px] font-semibold text-secondary/35 uppercase tracking-[0.18em] mb-5">{planName}</p>
        <h2 className="text-[1.65rem] font-bold text-foreground tracking-[-0.025em] leading-tight mb-3">
          The news habit that<br />doesn't waste your time.
        </h2>
        <p className="text-[14px] text-secondary/50 mb-10 leading-relaxed">
          Try it free for {trialDays} {trialDays === 1 ? 'day' : 'days'}. No charge until the trial ends.
        </p>

        <div className="space-y-5 mb-10">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <Check size={13} className="shrink-0 mt-[3px] text-foreground/40" strokeWidth={2.5} />
              <div>
                <p className="text-[13px] font-semibold text-foreground leading-snug">{b.title}</p>
                <p className="text-[12px] text-secondary/50 mt-0.5 leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <button
          onClick={handleStartTrial}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full text-[13px] font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:shadow-md hover:shadow-black/10 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:scale-100"
        >
          {loading ? <><Loader2 size={14} className="animate-spin" />Setting up your trial...</> : `Start ${trialDays}-Day Free Trial`}
        </button>
        <p className="text-[11px] text-secondary/35 mt-2.5 text-center">{priceDisplay} after {trialDays} {trialDays === 1 ? 'day' : 'days'} · Cancel anytime</p>
      </div>
    </div>
  );
}

/* ─── Main Feed Page ─── */
function FeedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, profileResolved, refreshProfile } = useAuth();
  const [feedBuildNow] = useState(() => Date.now());
  const checkoutReturned = searchParams.get('subscription') === 'success';
  const trackedPaywalls = React.useRef<Set<string>>(new Set());
  const trackedCheckoutSuccess = React.useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('for_you');
  const [feedView, setFeedView] = useState<'pulse' | 'briefing'>(
    searchParams.get('view') === 'pulse' ? 'pulse' : 'briefing'
  );
  const [isExpanded, setIsExpanded] = useState(false);
  /** Weekly Pulse only: filter sidebar/list by tools / blogs / discussions. */
  const [pulseSectionFilter, setPulseSectionFilter] = useState<
    'all' | 'tools' | 'blogs' | 'discussions'
  >('all');
  const refreshProfileRef = React.useRef(refreshProfile);

  useEffect(() => {
    const requested = searchParams.get('view') === 'pulse' ? 'pulse' : 'briefing';
    setFeedView(requested);
  }, [searchParams]);

  useEffect(() => {
    if (feedView !== 'pulse') setPulseSectionFilter('all');
  }, [feedView]);

  const switchFeedView = useCallback((nextView: 'pulse' | 'briefing') => {
    setFeedView(nextView);
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === 'pulse') params.set('view', 'pulse');
    else params.delete('view');
    const query = params.toString();
    router.replace(query ? `/feed?${query}` : '/feed', { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const onPopState = () => setShowMobileContent(false);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openMobileArticle = useCallback((id: string) => {
    setSelectedId(id);
    setShowMobileContent(true);
    window.history.pushState({ article: id }, '');
  }, []);

  const closeMobileArticle = useCallback(() => {
    setShowMobileContent(false);
    if (window.history.state?.article) window.history.back();
  }, []);

  useEffect(() => {
    refreshProfileRef.current = refreshProfile;
  }, [refreshProfile]);

  useEffect(() => {
    if (!showMobileContent) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showMobileContent]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) setIsExpanded(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isExpanded]);


  const { data: v3Feed, isLoading: feedLoading, mutate: mutateFeed } = useSWR<V3UserFeed | null>(
    user?.uid ? `feed-${user.uid}-${profile?.role || 'unknown'}` : null,
    () => feedFetcher(user!.uid, profile?.role),
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60000 }
  );

  const { data: fallbackTrending = [] } = useSWR<FeedItem[]>(
    'public-trending',
    trendingFetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const isSubscribed = profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trial'
    || profile?.appSubscriptionStatus === 'active' || profile?.appSubscriptionStatus === 'trial';

  const isFeedBuilding = (() => {
    if (profile?.feedBuildStatus !== 'building') return false;
    const raw = profile?.feedBuildRequestedAt;
    if (!raw) return false;
    const ts = typeof raw === 'string' ? new Date(raw).getTime()
      : raw?.toDate ? raw.toDate().getTime()
      : raw?.seconds ? raw.seconds * 1000 : 0;
    return ts > 0 && feedBuildNow - ts < 5 * 60 * 1000;
  })();

  useEffect(() => {
    if (!isAlphaMode()) { router.push(user ? '/waitlist' : '/'); return; }
    if (!loading && !user) { router.push('/'); return; }
    if (user && !profileResolved) return;
    if (user && profile?.onboarded) recordLastActive(user.uid);
    else if (user && !loading && !profile?.onboarded) router.push('/onboarding');
  }, [user, profile, loading, router, profileResolved]);

  useEffect(() => {
    if (!isFeedBuilding || !user) return;
    const interval = setInterval(() => mutateFeed(), 15000);
    return () => clearInterval(interval);
  }, [isFeedBuilding, user, mutateFeed]);

  useEffect(() => {
    if (!checkoutReturned || !user) return;
    let attempts = 0;
    const refreshAccess = async () => {
      attempts += 1;
      await refreshProfileRef.current();
      await mutateFeed();
    };
    refreshAccess();
    const interval = setInterval(() => {
      if (attempts >= 6) { clearInterval(interval); return; }
      refreshAccess();
    }, 4000);
    return () => clearInterval(interval);
  }, [checkoutReturned, user, mutateFeed]);

  const trendingTopics = useMemo(() => {
    const topics = v3Feed?.trending_topics || [];
    return [...topics].sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return (b.popularity_score || 0) - (a.popularity_score || 0);
    });
  }, [v3Feed?.trending_topics]);

  const userInterests = useMemo(() => new Set(profile?.interests || []), [profile?.interests]);

  const visibleTrendingTopics = useMemo(() => {
    if (isSubscribed) return trendingTopics;

    const getInterest = (t: TrendingTopic) =>
      t.interest_id && userInterests.has(t.interest_id) ? t.interest_id
        : t.tags?.find(tag => userInterests.has(tag)) || null;

    const buckets = new Map<string, TrendingTopic[]>();
    for (const t of trendingTopics) {
      const interest = getInterest(t);
      if (!interest) continue;
      const arr = buckets.get(interest) || [];
      arr.push(t);
      buckets.set(interest, arr);
    }

    const picked: TrendingTopic[] = [];
    const pickedIds = new Set<string>();
    const bucketKeys = [...buckets.keys()];

    let round = 0;
    while (picked.length < FREE_LIMITS.trending && round < 10) {
      for (const key of bucketKeys) {
        if (picked.length >= FREE_LIMITS.trending) break;
        const arr = buckets.get(key)!;
        if (round < arr.length && !pickedIds.has(arr[round].id)) {
          picked.push(arr[round]);
          pickedIds.add(arr[round].id);
        }
      }
      round++;
    }

    if (picked.length < FREE_LIMITS.trending) {
      for (const t of trendingTopics) {
        if (picked.length >= FREE_LIMITS.trending) break;
        if (!pickedIds.has(t.id)) {
          picked.push(t);
          pickedIds.add(t.id);
        }
      }
    }

    return picked;
  }, [isSubscribed, trendingTopics, userInterests]);

  const lockedTrendingCount = useMemo(() => {
    const total = trendingTopics.length || (v3Feed?.trending?.length || 0);
    return Math.max(0, total - FREE_LIMITS.trending);
  }, [trendingTopics.length, v3Feed?.trending?.length]);

  useEffect(() => {
    if (isSubscribed) return;
    if (lockedTrendingCount > 0 && !trackedPaywalls.current.has('trending')) {
      trackedPaywalls.current.add('trending');
      trackPaywallShown('feed_trending', { locked_count: lockedTrendingCount });
    }
  }, [isSubscribed, lockedTrendingCount]);

  useEffect(() => {
    if (checkoutReturned && isSubscribed && !trackedCheckoutSuccess.current) {
      trackedCheckoutSuccess.current = true;
      trackSubscriptionStarted('pro_monthly');
    }
  }, [checkoutReturned, isSubscribed]);

  const currentList = useMemo(() => {
    const list: {
      id: string;
      type: 'topic' | 'article';
      title: string;
      preview: string;
      timestamp?: string;
      source?: string;
      sourceCount: number;
      thumbnail?: string | null;
      interestId?: string;
      tags?: string[];
      data: TrendingTopic | FeedItem;
    }[] = [];

    const coveredArticleIds = new Set<string>();

    if (visibleTrendingTopics.length > 0) {
      for (const topic of visibleTrendingTopics) {
        const display = getTopicDisplay(topic);
        list.push({
          id: topic.id,
          type: 'topic',
          title: decodeHtml(display.title || ''),
          preview: getPreview(display.subtitle || display.summary),
          timestamp: topic.articles?.[0]?.published_date,
          source: display.isSingleton ? display.article?.source_name : undefined,
          sourceCount: topic.source_count || 0,
          thumbnail: display.isSingleton ? display.article?.thumbnail : topic.thumbnail,
          interestId: topic.interest_id,
          tags: topic.tags,
          data: topic,
        });
        for (const a of topic.articles || []) {
          coveredArticleIds.add(a.id);
        }
      }
    }

    const allTrending = v3Feed?.trending || [];
    const remaining = allTrending.filter(item => !coveredArticleIds.has(item.id));
    const cappedRemaining = isSubscribed ? remaining : remaining.slice(0, Math.max(0, FREE_LIMITS.trending - list.length));

    for (const item of cappedRemaining) {
      list.push({
        id: item.id,
        type: 'article',
        title: decodeHtml(item.title || ''),
        preview: getPreview(getArticleSummary(item)),
        timestamp: item.published_date,
        source: item.source_name,
        sourceCount: item.metadata?.source_count || (item.sources?.length || 0),
        thumbnail: item.thumbnail,
        interestId: item.interest_id,
        tags: item.tags,
        data: item,
      });
    }

    if (list.length === 0) {
      for (const item of fallbackTrending) {
        list.push({
          id: item.id,
          type: 'article',
          title: item.title,
          preview: getPreview(getArticleSummary(item)),
          timestamp: item.published_date,
          source: item.source_name,
          sourceCount: item.metadata?.source_count || (item.sources?.length || 0),
          thumbnail: item.thumbnail,
          interestId: item.interest_id,
          tags: item.tags,
          data: item,
        });
      }
    }

    return list.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
  }, [visibleTrendingTopics, v3Feed?.trending, isSubscribed, fallbackTrending]);

  const pulseStoryList = useMemo((): FeedListItem[] => {
    const weekly = v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse;
    if (weekly) {
      const sections: Array<{ key: 'tools' | 'blogs' | 'discussions'; items: FeedItem[] }> = [
        { key: 'tools', items: weekly.tools || [] },
        { key: 'blogs', items: weekly.blogs || [] },
        { key: 'discussions', items: weekly.discussions || [] },
      ];
      return sections.flatMap(({ key, items }) =>
        items.map((item) => ({
          id: item.id,
          type: 'article' as const,
          pulseSection: key,
          title: decodeHtml(item.title || ''),
          preview: getArticleSummary(item).trim(),
          timestamp: item.published_date,
          source: item.source_name || item.source,
          sourceCount: item.metadata?.signal_count || (item.sources?.length || 0),
          thumbnail: item.thumbnail,
          interestId: item.interest_id,
          tags: item.tags,
          theme:
            key === 'tools' ? 'Top tools'
            : key === 'blogs' ? 'Top blogs'
            : 'Top discussions',
          heat: item.metadata?.heat,
          signalCount: item.metadata?.signal_count || (item.sources?.length || 0),
          url: item.url?.trim() || undefined,
          pulseSources: (item.sources || [])
            .filter((s): s is { name: string; title: string; url: string } => Boolean(s?.url?.trim()))
            .map((s) => ({
              name: (s.name || '').trim() || 'Link',
              title: (s.title || '').trim(),
              url: s.url.trim(),
            })),
          data: item,
        }))
      );
    }

    const items = v3Feed?.pulse || [];
    return items.map((item) => ({
      id: item.id,
      type: 'article' as const,
      title: decodeHtml(item.title || ''),
      preview: getArticleSummary(item).trim(),
      timestamp: item.published_date,
      source: item.metadata?.theme || item.summary?.short_article?.subtitle || item.source_name,
      sourceCount: item.metadata?.signal_count || (item.sources?.length || 0),
      thumbnail: item.thumbnail,
      interestId: item.interest_id,
      tags: item.tags,
      theme: item.metadata?.theme || item.summary?.short_article?.subtitle,
      heat: item.metadata?.heat,
      signalCount: item.metadata?.signal_count || (item.sources?.length || 0),
      url: item.url?.trim() || undefined,
      pulseSources: (item.sources || [])
        .filter((s): s is { name: string; title: string; url: string } => Boolean(s?.url?.trim()))
        .map((s) => ({
          name: (s.name || '').trim() || 'Link',
          title: (s.title || '').trim(),
          url: s.url.trim(),
        })),
      data: item,
    }));
  }, [v3Feed?.pulse, (v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse)]);

  const pulseSections = useMemo(() => {
    if ((v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse)) {
      return [
        { key: 'tools' as const, label: 'Top Tools', items: pulseStoryList.filter(item => item.pulseSection === 'tools') },
        { key: 'blogs' as const, label: 'Top Blogs', items: pulseStoryList.filter(item => item.pulseSection === 'blogs') },
        { key: 'discussions' as const, label: 'Top Discussions', items: pulseStoryList.filter(item => item.pulseSection === 'discussions') },
      ].filter(section => section.items.length > 0);
    }
    return [{ key: 'pulse' as const, label: 'Pulse', items: pulseStoryList }];
  }, [(v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse), pulseStoryList]);

  useEffect(() => {
    if (!(v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse)) setPulseSectionFilter('all');
  }, [(v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse)]);

  const pulseFilterBuckets = useMemo(() => {
    if (!(v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse)) return [];
    const labelByKey: Record<'tools' | 'blogs' | 'discussions', string> = {
      tools: 'Tools',
      blogs: 'Blogs',
      discussions: 'Discussion',
    };
    const out: Array<{ key: 'tools' | 'blogs' | 'discussions'; label: string; count: number }> = [];
    for (const s of pulseSections) {
      if (s.key === 'tools' || s.key === 'blogs' || s.key === 'discussions') {
        out.push({ key: s.key, label: labelByKey[s.key], count: s.items.length });
      }
    }
    return out;
  }, [(v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse), pulseSections]);

  const showPulseSectionFilters = pulseFilterBuckets.length >= 2;

  useEffect(() => {
    if (pulseSectionFilter === 'all') return;
    const ok = pulseFilterBuckets.some((b) => b.key === pulseSectionFilter);
    if (!ok) setPulseSectionFilter('all');
  }, [pulseFilterBuckets, pulseSectionFilter]);

  const pulseVisibleStoryList = useMemo(() => {
    if (!(v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse) || pulseSectionFilter === 'all') return pulseStoryList;
    return pulseStoryList.filter((item) => item.pulseSection === pulseSectionFilter);
  }, [(v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse), pulseSectionFilter, pulseStoryList]);

  const filteredList = useMemo(() => {
    if (activeFilter === 'for_you') {
      // All items matching any of the user's interests
      return currentList.filter(item => {
        const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
        const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
        return matchesInterest || matchesTags;
      });
    }
    if (activeFilter === 'suggested') {
      return currentList.filter(item => {
        const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
        const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
        return !(matchesInterest || matchesTags);
      });
    }
    // Specific interest tab
    return currentList.filter(item => {
      const matchesInterest = item.interestId === activeFilter;
      const matchesTags = item.tags?.includes(activeFilter) || false;
      return matchesInterest || matchesTags;
    });
  }, [currentList, activeFilter, userInterests]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { for_you: 0, suggested: 0 };
    for (const item of currentList) {
      const matchesInterest = item.interestId ? userInterests.has(item.interestId) : false;
      const matchesTags = item.tags?.some(tag => userInterests.has(tag)) || false;
      if (matchesInterest || matchesTags) {
        counts.for_you++;
        // Count per specific interest
        const matchedInterest = item.interestId && userInterests.has(item.interestId)
          ? item.interestId
          : item.tags?.find(tag => userInterests.has(tag));
        if (matchedInterest) counts[matchedInterest] = (counts[matchedInterest] || 0) + 1;
      } else {
        counts.suggested++;
      }
    }
    return counts;
  }, [currentList, userInterests]);

  const interestTabs = useMemo(() => {
    return ONBOARDING_INTERESTS.filter(interest =>
      userInterests.has(interest.id) && (filterCounts[interest.id] || 0) > 0
    );
  }, [userInterests, filterCounts]);

  useEffect(() => {
    if (feedView !== 'briefing') return;
    if (filteredList.length === 0) return;
    if (!selectedId) { setSelectedId(filteredList[0].id); return; }
    const inFiltered = filteredList.some(item => item.id === selectedId);
    if (!inFiltered) {
      setSelectedId(filteredList[0].id);
    }
  }, [feedView, filteredList, selectedId]);

  useEffect(() => {
    if (feedView !== 'pulse') return;
    if (pulseVisibleStoryList.length === 0) return;
    if (!selectedId) { setSelectedId(pulseVisibleStoryList[0].id); return; }
    const inPulse = pulseVisibleStoryList.some(item => item.id === selectedId);
    if (!inPulse) {
      setSelectedId(pulseVisibleStoryList[0].id);
    }
  }, [feedView, pulseVisibleStoryList, selectedId]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return currentList.find(item => item.id === selectedId)
      || pulseStoryList.find(item => item.id === selectedId)
      || null;
  }, [currentList, pulseStoryList, selectedId]);

  const selectedContent = useMemo((): ContentData | null => {
    return getContentFromFeedListItem(selectedItem);
  }, [selectedItem]);

  const mobileContentList = useMemo(() => {
    if (feedView === 'briefing') return filteredList;
    return pulseVisibleStoryList;
  }, [feedView, filteredList, pulseVisibleStoryList]);

  const isLoading = loading || (feedLoading && !v3Feed);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    );
  }

  const storyCount = currentList.length + (isSubscribed ? 0 : lockedTrendingCount);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <img src="/trace.webp" alt="Trace" className="h-6 w-auto" />
              <span className="text-sm font-semibold tracking-[0.18em]">TRACE</span>
            </Link>
            <div className="flex items-center gap-3">
              {isSubscribed && (
                <div className="hidden sm:block">
                  <FeedModeToggle view={feedView} onChange={switchFeedView} />
                </div>
              )}
              {user?.photoURL ? (
                <Link href="/profile">
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                </Link>
              ) : (
                <Link
                  href="/profile"
                  className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center"
                >
                  <span className="text-sm font-semibold">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
                </Link>
              )}
            </div>
          </div>
          {isSubscribed && (
            <div className="pb-3 sm:hidden">
              <FeedModeToggle view={feedView} onChange={switchFeedView} />
            </div>
          )}
        </div>
      </header>

      <div className="py-0 sm:py-4 px-0 sm:p-6 lg:p-8 max-w-7xl mx-auto sm:px-6">
        {checkoutReturned && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <Loader2 size={16} className={`text-amber-600 ${isSubscribed ? '' : 'animate-spin'}`} />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isSubscribed ? 'Trace Pro is active.' : 'Activating your Pro access...'}
                </p>
                <p className="text-xs text-secondary/50">
                  {isSubscribed
                    ? 'Your full feed is unlocked.'
                    : 'Your payment went through. Your full feed should unlock in a moment.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {!isSubscribed && !isLoading && <PaywallGate />}

        {isSubscribed && feedView === 'pulse' && (
          isLoading ? (
            <div className={`${PULSE_MAIN_SHELL} flex items-center justify-center py-20`}>
              <Loader2 size={20} className="animate-spin text-secondary/40" />
            </div>
          ) : (
            <div className={PULSE_MAIN_SHELL}>
              <DailyPulseView
                pulseSections={pulseSections}
                hasWeeklyPulse={Boolean((v3Feed?.daily_pulse ?? v3Feed?.weekly_pulse))}
                pulseStoryCount={pulseStoryList.length}
              />
            </div>
          )
        )}

        {/* Desktop Briefing */}
        <div className={`${!isSubscribed || feedView !== 'briefing' ? 'hidden' : 'hidden md:block'} ${isExpanded ? 'fixed inset-0 z-60 bg-background p-0' : ''}`}>
          <div
            className={`flex bg-white overflow-hidden ${isExpanded ? 'h-full' : 'rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}
            style={isExpanded ? undefined : { height: 'calc(100vh - 120px)', minHeight: '500px' }}
          >
            {/* Sidebar */}
            <div className="w-[340px] shrink-0 border-r border-border/20 flex flex-col">
              <div className="px-5 pt-5 pb-3 border-b border-border/20">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-bold text-foreground tracking-[-0.01em]">
                    News
                  </h2>
                  <button
                    onClick={() => setIsExpanded(e => !e)}
                    className="p-1.5 rounded-lg text-secondary/40 hover:text-foreground hover:bg-surface-secondary transition-colors"
                    title={isExpanded ? 'Exit full screen (Esc)' : 'Full screen'}
                  >
                    {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                </div>
                <p className="text-[12px] text-secondary/55 mt-0.5 mb-3">
                  {getTodayLabel()}{storyCount > 0 ? ` · ${storyCount} stories` : ''}
                </p>
                {isSubscribed && (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {([
                      { key: 'for_you', label: 'For You' },
                      ...interestTabs.map(i => ({ key: i.id, label: i.label })),
                      { key: 'suggested', label: 'Suggested' },
                    ]).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setActiveFilter(key)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                          activeFilter === key
                            ? 'bg-foreground text-background'
                            : 'bg-foreground/8 text-secondary/70 hover:bg-foreground/12 hover:text-secondary/90'
                        }`}
                      >
                        {label}{(filterCounts[key] || 0) > 0 ? ` (${filterCounts[key]})` : ''}
                      </button>
                    ))}
                    </div>
                  </>
                )}
              </div>

              {!isSubscribed ? (
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-foreground/8 flex items-center justify-center mb-3">
                    <Lock size={16} className="text-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Pro access required</p>
                  <p className="text-[12px] text-secondary/50 mb-5 leading-relaxed">Start your free trial to unlock the full news feed.</p>
                  <Link
                    href="/profile?tab=subscription"
                    onClick={() => trackCheckoutClicked('feed_sidebar_paywall')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-foreground text-background transition-all hover:bg-foreground/90 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Sparkles size={13} />
                    Start Free Trial
                  </Link>
                  <p className="text-[11px] text-secondary/35 mt-2">Cancel anytime · $4.99/mo after trial</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-border/10">
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
                    <>
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
                          selected={selectedId === item.id}
                          onClick={() => setSelectedId(item.id)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-secondary/40" />
              </div>
            ) : selectedContent ? (
              <ContentPanel content={selectedContent} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-secondary/40 text-sm">Select a story to read</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile full-screen reader (briefing only) */}
        {isSubscribed && feedView === 'briefing' && showMobileContent && selectedContent && (() => {
          const currentIdx = mobileContentList.findIndex(i => i.id === selectedId);
          const nextItem =
            currentIdx >= 0 && currentIdx < mobileContentList.length - 1
              ? mobileContentList[currentIdx + 1]
              : null;
          const imageUrl = selectedContent.thumbnail
            ? getArticleImage(selectedContent.thumbnail, selectedContent.title)
            : null;
          const briefFmt = selectedContent.body ? looksLikeBriefBody(selectedContent.body) : false;
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
                    selectedContent.source,
                    selectedContent.countLabel,
                  ].filter(Boolean).join(' · ')}
                  {selectedContent.readingTime ? ` · ${selectedContent.readingTime} min read` : ''}
                </span>
              </div>

              <div className="px-5 pt-5 pb-12">
                <h1 className="text-[1.35rem] font-bold text-foreground leading-tight tracking-[-0.02em] mb-4">
                  {selectedContent.title}
                </h1>

                {imageUrl && (
                  <div className="mb-6">
                    <img
                      src={imageUrl}
                      alt=""
                      className={
                        isProductHuntWidget(imageUrl)
                          ? 'max-w-[280px] rounded-2xl border border-[#ff6154]/20 bg-white'
                          : 'w-full max-h-[240px] object-cover rounded-[18px]'
                      }
                    />
                  </div>
                )}

                {selectedContent.body && (
                  <div className="mb-6 text-secondary leading-relaxed">
                    {briefFmt ? (
                      <BriefBody body={selectedContent.body} />
                    ) : (
                      <div className="prose prose-sm max-w-none text-secondary">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedContent.body}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}

                {selectedContent.keyPoints && selectedContent.keyPoints.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-[10px] font-semibold text-secondary/50 mb-3 uppercase tracking-[0.18em]">Key takeaways</h3>
                    <div className="space-y-2">
                      {selectedContent.keyPoints.slice(0, 4).map((point, i) => (
                        <div key={i} className="flex gap-2.5">
                          <span className="text-secondary/35 font-mono text-xs mt-0.5">{i + 1}.</span>
                          <p className="text-[14px] text-secondary/80 leading-relaxed">{stripMarkdown(point)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedContent.url && (
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

                {feedView === 'briefing' && nextItem && (
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

        {/* Mobile Briefing */}
        <div className={`${isSubscribed && feedView === 'briefing' ? 'md:hidden' : 'hidden'}`}>
          {/* Feed list */}
          <div className="bg-background">
            {/* Briefing header */}
            <div className="px-5 pt-6 pb-4">
              <p className="text-[10px] font-semibold text-secondary/40 uppercase tracking-[0.2em] mb-1">{getTodayLabel()}</p>
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-[1.6rem] font-bold text-foreground tracking-[-0.025em] leading-tight">News</h1>
                  {storyCount > 0 && (
                    <span className="text-[12px] text-secondary/45 mb-0.5">{storyCount} stories</span>
                  )}
                </div>
              </div>
            </div>

            {/* Horizontally scrollable tabs */}
            <div className="overflow-x-auto scrollbar-hide border-b border-border/15">
              <div className="flex items-center gap-2 px-5 pb-3 w-max">
                {([
                  { key: 'for_you', label: 'For You' },
                  ...interestTabs.map(i => ({ key: i.id, label: i.label })),
                  { key: 'suggested', label: 'Suggested' },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                      activeFilter === key
                        ? 'bg-foreground text-background'
                        : 'bg-foreground/8 text-secondary/70'
                    }`}
                  >
                    {label}{(filterCounts[key] || 0) > 0 ? ` (${filterCounts[key]})` : ''}
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
                    {activeFilter === 'suggested' ? 'No suggested stories right now'
                    : activeFilter === 'for_you' ? 'No stories matching your interests'
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
        </div>

        {/* Building banner */}
        {isFeedBuilding && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-full bg-surface border border-border/20 shadow-lg">
            <Loader2 size={16} className="animate-spin text-secondary/50" />
            <p className="text-sm text-secondary/60">Building your personalized feed...</p>
          </div>
        )}


      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary/40" />
      </div>
    }>
      <FeedPageContent />
    </Suspense>
  );
}
