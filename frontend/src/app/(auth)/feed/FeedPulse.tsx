import React from 'react';
import { ExternalLink } from 'lucide-react';
import { FeedItem, TrendingTopic } from '@/lib/firestore';
import { getArticleImage, isValidThumbnail } from '@/lib/fallback-images';
import { PulseBetaBadge } from '@/components/PulseBetaBadge';
import {
  BriefBody,
  ContentData,
  decodeHtml,
  FEED_TYPE_PREFIX,
  getArticleSummary,
  getPreview,
  getTimeLabel,
  getTodayLabel,
  getTopicDisplay,
  isProductHuntWidget,
  looksLikeBriefBody,
  MarkdownProse,
  stripMarkdown,
} from './FeedContent';

function pulseUrlsMatch(a: string, b: string): boolean {
  try {
    return new URL(a).hostname + new URL(a).pathname === new URL(b).hostname + new URL(b).pathname;
  } catch {
    return a === b;
  }
}

const PULSE_EYEBROW =
  'text-[11px] font-semibold text-secondary/60 uppercase tracking-[0.15em]';
const PULSE_SECTION = 'mb-10 sm:mb-12';
/** Pulse shell: mobile matches News (`bg-background`); md+ uses the same white card as desktop News */
export const PULSE_MAIN_SHELL =
  'overflow-hidden bg-background md:rounded-2xl md:border md:border-border/15 md:bg-white md:shadow-[0_1px_3px_rgba(0,0,0,0.04)]';

export function FeedModeToggle({
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
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
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

/* ─── Daily Pulse — newsletter column, Trace palette (globals.css tokens) ─── */

const pulseKicker = `${PULSE_EYEBROW} mb-3`;

const pulseStoryCard =
  'relative flex flex-col py-10 sm:py-14 border-b border-border/15 last:border-0';

const pulseOutboundButton =
  'inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[13.5px] font-medium text-background shadow-sm transition-all hover:bg-foreground/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:ring-offset-2';

const pulseSecondaryLink =
  'inline-flex items-center gap-1.5 text-[13px] font-medium text-secondary/70 transition-colors hover:text-foreground underline underline-offset-[4px] decoration-border/50 hover:decoration-foreground/40';

const newsletterBody =
  'text-[15px] sm:text-[16px] leading-[1.75] text-secondary/90 [&_p]:text-secondary/90 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-[3px] [&_a]:decoration-foreground/25 hover:[&_a]:decoration-foreground/45';

function CategoryBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 inline-flex items-center rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-secondary/70 dark:bg-foreground/[0.08]">
      {children}
    </span>
  );
}

const discussionOutboundLink =
  'inline-flex items-center gap-1.5 text-[13px] font-semibold text-secondary/60 hover:text-foreground transition-colors decoration-border/50 hover:decoration-foreground/40 underline underline-offset-[4px]';

function PulseDiscussionCard({ item }: { item: FeedListItem }) {
  const url = item.url || item.pulseSources?.[0]?.url;
  const extraLinks = (item.pulseSources || []).filter(
    s => !url || !pulseUrlsMatch(s.url, url)
  );
  
  const feedItem = item.data as FeedItem;
  const body = feedItem.summary?.short_article?.body || '';
  const isBrief = body ? looksLikeBriefBody(body) : false;
  
  const sourceLower = (item.source || '').toLowerCase();
  const isHN = sourceLower.includes('hacker news');
  const isReddit = sourceLower.includes('reddit');
  const sourceColor = isHN ? 'text-[#ff6600] bg-[#ff6600]/10 border-[#ff6600]/20' : isReddit ? 'text-[#ff4500] bg-[#ff4500]/10 border-[#ff4500]/20' : 'text-secondary/70 bg-foreground/[0.04] border-border/10';

  return (
    <article className="relative flex flex-col py-8 sm:py-10 border-b border-border/15 last:border-0 group">
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${sourceColor}`}>
           {item.source || 'Discussion'}
        </span>
        {item.signalCount != null && item.signalCount > 0 && (
          <span className="text-[12px] font-medium text-secondary/50">
            {item.signalCount.toLocaleString()} points
          </span>
        )}
      </div>
      
      <h3 className="text-[1.35rem] sm:text-[1.5rem] font-bold text-foreground leading-[1.25] tracking-[-0.02em] mb-4">
        {item.title}
      </h3>
      
      <div className="pl-4 border-l-2 border-border/40 text-[14.5px] sm:text-[15px] leading-[1.65] text-secondary/80 mb-6">
        {isBrief && body ? (
          <BriefBody body={body} />
        ) : item.preview ? (
          <p>{item.preview}</p>
        ) : null}
      </div>
      
      <div className="flex items-center gap-x-5">
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className={discussionOutboundLink}>
            Join discussion <ExternalLink size={13} strokeWidth={2.5} />
          </a>
        )}
        {extraLinks.slice(0, 2).map(s => (
          <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={discussionOutboundLink}>
            {s.name} <ExternalLink size={13} strokeWidth={2.5} />
          </a>
        ))}
      </div>
    </article>
  );
}

function PulseToolCard({ item }: { item: FeedListItem }) {
  const url = item.url || item.pulseSources?.[0]?.url;
  const thumb = item.thumbnail && isValidThumbnail(item.thumbnail) ? getArticleImage(item.thumbnail, item.title) : null;
  const isPH = thumb ? isProductHuntWidget(thumb) : false;

  return (
    <a
      href={url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col justify-between gap-4 p-5 rounded-2xl border border-border/20 bg-foreground/1.5 hover:bg-foreground/3 hover:border-border/30 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] h-full"
    >
      <div className="flex items-start gap-4">
        {thumb && (
          <div className={`shrink-0 ${isPH ? 'w-12 h-12 bg-white rounded-[10px] border border-border/20 p-1.5 flex items-center justify-center shadow-sm' : 'w-12 h-12 rounded-[10px] overflow-hidden shadow-sm'}`}>
            <img
              src={thumb}
              alt=""
              loading="lazy"
              decoding="async"
              className={isPH ? 'w-full h-full object-contain' : 'w-full h-full object-cover'}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-foreground leading-[1.35] tracking-tight mb-1.5 group-hover:underline decoration-foreground/30 underline-offset-[3px] line-clamp-2">
            {item.title}
          </h3>
          <p className="text-[13px] text-secondary/70 leading-relaxed line-clamp-2">
            {item.preview}
          </p>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-1 pt-1">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-background border border-border/40 text-[10px] font-bold uppercase tracking-wider text-secondary/60">
            {item.source || 'Tool'}
          </span>
          {item.signalCount != null && item.signalCount > 0 && (
            <span className="text-[11px] font-medium text-secondary/50">
              {item.signalCount.toLocaleString()} {item.source === 'GitHub Trending' ? 'stars' : 'upvotes'}
            </span>
          )}
        </div>
        
        <div className="w-8 h-8 rounded-full bg-background border border-border/40 flex items-center justify-center text-secondary/40 group-hover:text-foreground group-hover:border-foreground/30 transition-all shadow-sm shrink-0">
          <ExternalLink size={14} strokeWidth={2} />
        </div>
      </div>
    </a>
  );
}

function PulseReadCard({ item }: { item: FeedListItem }) {
  const feedItem = item.data as FeedItem;
  const body = feedItem.summary?.short_article?.body || '';
  const isBrief = body ? looksLikeBriefBody(body) : false;
  const keyTakeaways = feedItem.summary?.short_article?.key_takeaways ?? [];
  const thumb =
    item.thumbnail && isValidThumbnail(item.thumbnail)
      ? getArticleImage(item.thumbnail, item.title)
      : null;
  const isPH = thumb ? isProductHuntWidget(thumb) : false;

  const metaBits: string[] = [];
  if (item.source) metaBits.push(item.source);
  if (item.timestamp) metaBits.push(getTimeLabel(item.timestamp));

  return (
    <article className={pulseStoryCard}>
      <h2 className="text-[1.65rem] sm:text-[2rem] font-bold text-foreground leading-[1.12] tracking-[-0.03em] mb-4 transition-colors">
        {item.title}
      </h2>

      {thumb && !isPH && (
        <div className="mb-6">
          <div className="overflow-hidden rounded-xl bg-foreground/[0.02] dark:bg-surface-tertiary/40 border border-border/10">
            <img
              src={thumb}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              className="aspect-[16/9] w-full object-cover sm:aspect-[2/1]"
            />
          </div>
          {metaBits.length > 0 && (
            <p className="mt-3 text-[12px] font-medium text-secondary/60 tracking-wide uppercase">{metaBits.join(' · ')}</p>
          )}
        </div>
      )}

      {(!thumb || isPH) && metaBits.length > 0 && (
        <p className="mb-5 text-[12px] font-medium text-secondary/60 tracking-wide uppercase">{metaBits.join(' · ')}</p>
      )}

      <div className={`${newsletterBody} space-y-4`}>
        {isBrief && body ? (
          <BriefBody body={body} />
        ) : item.preview ? (
          <p>{item.preview}</p>
        ) : null}
      </div>

      {keyTakeaways.length > 0 && (
        <div className="mt-8 border-t border-border/20 pt-6">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-foreground/80 mb-4">The details</h3>
          <ul className="space-y-3">
            {keyTakeaways.map((point, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-foreground/85">
                <span className="shrink-0 font-bold text-secondary/40 tabular-nums">{i + 1}.</span>
                <span>{stripMarkdown(point)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.url && (
        <div className="mt-8">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={pulseOutboundButton}
          >
            Read the full story
            <ExternalLink size={14} strokeWidth={2.5} />
          </a>
        </div>
      )}
    </article>
  );
}

export function DailyPulseView({
  pulseSections,
  hasWeeklyPulse,
  pulseStoryCount,
}: {
  pulseSections: Array<{ key: string; label: string; items: FeedListItem[] }>;
  hasWeeklyPulse: boolean;
  pulseStoryCount: number;
}) {
  const byDateDesc = (a: FeedListItem, b: FeedListItem) =>
    new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();

  const tools = [...(pulseSections.find(s => s.key === 'tools')?.items ?? [])].sort(byDateDesc);
  const blogs = [...(pulseSections.find(s => s.key === 'blogs')?.items ?? [])].sort(byDateDesc);
  const discussions = [
    ...(pulseSections.find(s => s.key === 'discussions')?.items ?? []),
  ].sort(byDateDesc);
  const legacy = pulseSections.find(s => s.key === 'pulse')?.items ?? [];

  const isEmpty =
    tools.length + blogs.length + discussions.length + legacy.length === 0;

  if (isEmpty) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-secondary/55">Your pulse is on its way</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-8 lg:max-w-4xl lg:px-10">
      <header className="mb-10 border-b border-border/30 pb-8 text-left">
        <p className={PULSE_EYEBROW}>
          {hasWeeklyPulse ? 'Weekly pulse' : 'Daily pulse'}
        </p>
        <h1 className="mt-2 text-[1.75rem] font-bold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[2rem]">
          {getTodayLabel()}
        </h1>
        {pulseStoryCount > 0 && (
          <p className="mt-2 text-[14px] text-secondary">
            {pulseStoryCount} stories hand-picked for you.
          </p>
        )}
      </header>

      <div className="flex flex-col gap-12 sm:gap-16">
        {/* Legacy (non-weekly) pulse */}
        {!hasWeeklyPulse && legacy.length > 0 && (
          <section className="flex flex-col gap-6">
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
          </section>
        )}

        {blogs.length > 0 && (
          <section>
            <div className="mb-6 flex items-center gap-4">
              <h2 className="text-[14px] font-bold uppercase tracking-[0.12em] text-foreground">Top Reads</h2>
              <div className="h-px flex-1 bg-border/40"></div>
            </div>
            <div className="flex flex-col">
              {blogs.map(item => (
                <PulseReadCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {tools.length > 0 && (
          <section>
            <div className="mb-6 flex items-center gap-4">
              <h2 className="text-[14px] font-bold uppercase tracking-[0.12em] text-foreground">Trending Tools & Repos</h2>
              <div className="h-px flex-1 bg-border/40"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tools.map(item => (
                <PulseToolCard key={`Building-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {discussions.length > 0 && (
          <section>
            <div className="mb-6 flex items-center gap-4">
              <h2 className="text-[14px] font-bold uppercase tracking-[0.12em] text-foreground">Top Discussions</h2>
              <div className="h-px flex-1 bg-border/40"></div>
            </div>
            <div className="flex flex-col">
              {discussions.map(item => (
                <PulseDiscussionCard key={`Saying-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        )}
      </div>
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
            loading="lazy"
            decoding="async"
            fetchPriority="low"
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
            decoding="async"
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
          <MarkdownProse body={content.body} />
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

export type FeedListItem = {
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

function buildArticleShareUrl(article: FeedItem): string | null {
  const feedType = article.feed_type || article.metadata?.feed_type;
  const prefix = feedType ? FEED_TYPE_PREFIX[feedType] : null;
  if (!prefix || !article.id) return null;
  const normalizedId = article.id.startsWith(`${prefix}_`) ? article.id : `${prefix}_${article.id}`;
  return `https://www.yourtrace.online/articles/${normalizedId}`;
}

function buildTopicShareUrl(topic: TrendingTopic): string | null {
  const topicSlug = topic.topic_key || topic.id;
  if (!topicSlug) return null;
  return `https://www.yourtrace.online/topics/${encodeURIComponent(topicSlug)}`;
}

export function getContentFromFeedListItem(item: FeedListItem | null): ContentData | null {
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
      shareUrl: display.isSingleton
        ? (display.article ? buildArticleShareUrl(display.article) : null) || buildTopicShareUrl(topic) || undefined
        : buildTopicShareUrl(topic) || undefined,
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
    shareUrl: buildArticleShareUrl(article) || undefined,
    timestamp: article.published_date,
    countLabel: isPulseStory
      ? `${article.metadata?.signal_count || article.sources?.length || item.signalCount || 1} signal${(article.metadata?.signal_count || article.sources?.length || item.signalCount || 1) === 1 ? '' : 's'}`
      : ((article.metadata?.source_count || item.sourceCount || 0) > 1 ? `${article.metadata?.source_count || item.sourceCount} sources` : undefined),
    keyPoints: article.summary?.short_article?.key_takeaways,
    thumbnail: article.thumbnail,
    timeline: isPulseStory
      ? ((article.signals || article.timeline || []) as ContentData['timeline'])
      : undefined,
    timelineSectionLabel: isPulseStory ? 'Signals' : undefined,
    sourceCount: article.metadata?.source_count,
    whyItMatters: article.summary?.short_article?.why_it_matters,
    readingTime: article.summary?.reading_time_minutes,
    articleSources: article.sources?.filter(s => s.name) as ContentData['articleSources'],
  };
}
