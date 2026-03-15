"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR, { preload } from "swr";
import { ArrowRight, ExternalLink, Loader2, Share2, X } from "lucide-react";

const summaryFetcher = async (url: string) => {
  const res = await fetch(`/api/public/summary?url=${encodeURIComponent(url)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.summary || null;
};

const preloadSummary = (url: string) => {
  preload(`summary-${url}`, () => summaryFetcher(url));
};

function cleanSlides(slides: string[]): string[] {
  return slides.map(s => s.replace(/^Slide\s*\d+:\s*/i, ''));
}

function stripMarkdown(text: string): string {
  return (text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

type TrendingItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  thumbnail?: string;
};

type FullSummary = {
  short_article?: {
    subtitle?: string;
    headline?: string;
    slides?: string[];
    body?: string;
    key_takeaways?: string[];
    why_it_matters?: string;
  };
  reading_time_minutes?: number;
};

function getHost(url: string, fallback: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return fallback || "";
  }
}

/* ─── Story list item ─── */

function StoryItem({
  item,
  selected,
  onClick,
  onHover,
}: {
  item: TrendingItem;
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  const host = getHost(item.url, item.source);

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={`w-full text-left px-5 py-4 transition-colors ${
        selected
          ? 'bg-surface-secondary'
          : 'hover:bg-surface-secondary/50'
      }`}
    >
      {host && (
        <span className="text-[11px] text-secondary/40 block mb-1">{host}</span>
      )}
      <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
        {item.title}
      </h3>
      {item.summary && (
        <p className="mt-1.5 text-xs text-secondary/50 line-clamp-2 leading-relaxed">
          {stripMarkdown(item.summary).slice(0, 120)}
        </p>
      )}
    </button>
  );
}

/* ─── Content detail panel ─── */

function ContentPanel({ item, onCopyLink }: { item: TrendingItem; onCopyLink: () => void }) {
  const { data: fullSummary, isLoading: loading } = useSWR<FullSummary | null>(
    `summary-${item.url}`,
    () => summaryFetcher(item.url),
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const host = getHost(item.url, item.source);
  const rawSlides = fullSummary?.short_article?.slides;
  const slides = rawSlides?.length ? cleanSlides(rawSlides) : [];
  const rawBody = fullSummary?.short_article?.body || '';
  const body = slides.length ? slides.join('\n\n') : (rawBody.length > 100 ? rawBody : '');
  const keyTakeaways = fullSummary?.short_article?.key_takeaways;

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10">
      {/* Meta */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[13px] text-secondary/45">{host}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              navigator.clipboard.writeText(item.url);
              onCopyLink();
            }}
            className="p-2 rounded-lg text-secondary/35 hover:text-foreground hover:bg-surface-secondary transition-colors"
            title="Copy link"
          >
            <Share2 size={16} />
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-secondary/35 hover:text-foreground hover:bg-surface-secondary transition-colors"
            title="Open original"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight tracking-[-0.02em] mb-8">
        {item.title}
      </h1>

      {loading ? (
        <div className="flex items-center gap-3 py-16 text-secondary/40">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading summary...</span>
        </div>
      ) : (
        <>
          {/* Key Takeaways */}
          {keyTakeaways && keyTakeaways.length > 0 && (
            <div className="mb-8 rounded-xl bg-surface-secondary/50 p-5">
              <h3 className="text-[11px] font-semibold text-secondary/50 mb-4 uppercase tracking-[0.15em]">
                Key Takeaways
              </h3>
              <div className="space-y-3">
                {keyTakeaways.slice(0, 5).map((point, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-secondary/25 font-mono text-xs mt-0.5">{i + 1}.</span>
                    <p className="text-[15px] text-secondary leading-relaxed">{stripMarkdown(point)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          {body ? (
            <div className="prose prose-lg max-w-none text-secondary leading-relaxed mb-8">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          ) : item.summary ? (
            <p className="text-base text-secondary leading-relaxed mb-8">
              {item.summary}
            </p>
          ) : (
            <p className="text-secondary/40 text-sm mb-8">
              Summary not available for this article.
            </p>
          )}
        </>
      )}

      {/* Source link */}
      <div className="pt-6 border-t border-border/20">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10 hover:scale-[1.02] active:scale-[0.98]"
        >
          Read Full Article
          <ExternalLink size={15} />
        </a>
      </div>
    </div>
  );
}

/* ─── Mobile bottom sheet ─── */

function MobileSheet({ item, onClose, onCopyLink }: { item: TrendingItem; onClose: () => void; onCopyLink: () => void }) {
  const { data: fullSummary, isLoading: loading } = useSWR<FullSummary | null>(
    `summary-${item.url}`,
    () => summaryFetcher(item.url),
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const rawSlides = fullSummary?.short_article?.slides;
  const slides = rawSlides?.length ? cleanSlides(rawSlides) : [];
  const rawBody = fullSummary?.short_article?.body || '';
  const body = slides.length ? slides.join('\n\n') : (rawBody.length > 100 ? rawBody : '');
  const keyTakeaways = fullSummary?.short_article?.key_takeaways;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-secondary/20" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border/20">
          <button
            onClick={() => { navigator.clipboard.writeText(item.url); onCopyLink(); }}
            className="p-1.5 -ml-1.5 rounded-lg text-secondary/50 hover:text-foreground transition-colors"
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-lg text-secondary/50 hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <h2 className="text-xl font-bold text-foreground leading-tight mb-4">
            {item.title}
          </h2>
          {loading ? (
            <div className="flex items-center gap-3 py-8 text-secondary/40">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : (
            <>
              {body ? (
                <div className="prose prose-sm max-w-none text-secondary leading-relaxed mb-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              ) : item.summary ? (
                <p className="text-sm text-secondary leading-relaxed mb-4">{item.summary}</p>
              ) : (
                <p className="text-secondary/40 text-sm mb-4">Summary not available.</p>
              )}
              {keyTakeaways && keyTakeaways.length > 0 && (
                <div className="p-3 rounded-xl bg-surface-secondary/50">
                  <h3 className="text-[11px] font-semibold text-secondary/50 mb-2 uppercase tracking-[0.15em]">
                    Key Takeaways
                  </h3>
                  <div className="space-y-1.5">
                    {keyTakeaways.slice(0, 4).map((point, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-secondary/25 font-mono text-xs">{i + 1}.</span>
                        <p className="text-sm text-secondary leading-relaxed">{stripMarkdown(point)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Main export ─── */

export default function TrendingContent({ items }: { items: TrendingItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const handleCopyLink = useCallback(() => {
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  }, []);

  useEffect(() => {
    if (items.length > 0 && !selectedId) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const selectedItem = items.find(item => item.id === selectedId) || null;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-16 text-center">
        <p className="text-lg font-semibold mb-2">Today&apos;s stories are on the way</p>
        <p className="text-sm text-secondary/50">We pull the best content every morning. Check back soon!</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="flex rounded-2xl bg-surface overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ height: 'calc(100vh - 160px)', minHeight: '500px' }}>
          {/* Sidebar */}
          <div className="w-[340px] shrink-0 border-r border-border/20 flex flex-col">
            <div className="px-5 py-4 border-b border-border/20">
              <h2 className="text-sm font-semibold text-foreground">
                Today&apos;s stories
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border/10">
              {items.map((item) => (
                <StoryItem
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onClick={() => setSelectedId(item.id)}
                  onHover={() => preloadSummary(item.url)}
                />
              ))}
            </div>
            <div className="px-5 py-4 border-t border-border/20">
              <Link
                href="/"
                className="group flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background transition-all hover:bg-foreground/90 hover:shadow-lg hover:shadow-black/10"
              >
                Sign in for your full feed
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* Content */}
          {selectedItem ? (
            <ContentPanel item={selectedItem} onCopyLink={handleCopyLink} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-secondary/40 text-sm">Select a story to read</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="rounded-2xl bg-surface overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-5 py-4 border-b border-border/20">
            <h2 className="text-sm font-semibold text-foreground">
              Today&apos;s stories
            </h2>
          </div>
          <div className="divide-y divide-border/10">
            {items.map((item) => (
              <StoryItem
                key={item.id}
                item={item}
                selected={false}
                onClick={() => { setSelectedId(item.id); setShowMobileContent(true); }}
                onHover={() => {}}
              />
            ))}
          </div>
          <div className="px-5 py-4 border-t border-border/20">
            <Link
              href="/"
              className="group flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background transition-all hover:bg-foreground/90"
            >
              Sign in for your full feed
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {showMobileContent && selectedItem && (
          <MobileSheet
            item={selectedItem}
            onClose={() => setShowMobileContent(false)}
            onCopyLink={handleCopyLink}
          />
        )}
      </div>

      {showCopiedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-foreground text-background text-sm font-medium shadow-lg">
          Link copied!
        </div>
      )}
    </>
  );
}
