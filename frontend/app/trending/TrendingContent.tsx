"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR, { preload } from "swr";
import { ExternalLink, Loader2, Share2, X } from "lucide-react";

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

function getTimeLabel(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function SidebarItem({
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
  const host = (() => {
    try {
      return new URL(item.url).hostname.replace("www.", "");
    } catch {
      return item.source || "";
    }
  })();

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={`article-list-item w-full text-left ${selected ? 'selected' : ''}`}
    >
      {host && (
        <span className="text-[10px] text-secondary/50 truncate block mb-1">{host}</span>
      )}
      <h3 className="text-[0.875rem] font-semibold text-foreground leading-snug line-clamp-2">
        {item.title}
      </h3>
    </button>
  );
}

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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-secondary/30" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-sidebar-border">
          <button
            onClick={() => {
              navigator.clipboard.writeText(item.url);
              onCopyLink();
            }}
            className="p-1.5 -ml-1.5 rounded-lg text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors"
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-lg text-secondary hover:text-foreground hover:bg-surface-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <h2 className="text-xl font-semibold text-foreground leading-tight mb-4">
            {item.title}
          </h2>

          {loading ? (
            <div className="flex items-center gap-3 py-8 text-secondary/50">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : (
            <>
              {/* Body */}
              {body ? (
                <div className="prose prose-sm max-w-none text-secondary leading-relaxed mb-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              ) : item.summary ? (
                <p className="text-sm text-secondary leading-relaxed mb-4">
                  {item.summary}
                </p>
              ) : (
                <p className="text-secondary/50 text-sm italic mb-4">
                  Summary not available.
                </p>
              )}

              {/* Key Takeaways */}
              {keyTakeaways && keyTakeaways.length > 0 && (
                <div className="p-3 rounded-lg bg-surface-secondary">
                  <h3 className="text-xs font-semibold text-secondary/60 mb-2 uppercase tracking-wide">
                    Key Takeaways
                  </h3>
                  <div className="space-y-1.5">
                    {keyTakeaways.slice(0, 4).map((point, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-secondary/30 font-mono text-xs">{i + 1}.</span>
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

function ContentPanel({ item, onCopyLink }: { item: TrendingItem; onCopyLink: () => void }) {
  const { data: fullSummary, isLoading: loading } = useSWR<FullSummary | null>(
    `summary-${item.url}`,
    () => summaryFetcher(item.url),
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  const host = (() => {
    try {
      return new URL(item.url).hostname.replace("www.", "");
    } catch {
      return item.source || "";
    }
  })();

  const rawSlides = fullSummary?.short_article?.slides;
  const slides = rawSlides?.length ? cleanSlides(rawSlides) : [];
  const rawBody = fullSummary?.short_article?.body || '';
  const body = slides.length ? slides.join('\n\n') : (rawBody.length > 100 ? rawBody : '');
  const keyTakeaways = fullSummary?.short_article?.key_takeaways;

  return (
    <div className="split-main">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 text-[13px] text-secondary/50">
          {host && <span>{host}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              navigator.clipboard.writeText(item.url);
              onCopyLink();
            }}
            className="p-2 rounded-lg text-secondary/40 hover:text-foreground hover:bg-surface-secondary transition-colors"
            title="Copy link"
          >
            <Share2 size={18} />
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-secondary/40 hover:text-foreground hover:bg-surface-secondary transition-colors"
            title="Open original"
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </div>

      <h1 className="text-[2rem] font-semibold text-foreground leading-tight mb-6">
        {item.title}
      </h1>

      {loading ? (
        <div className="flex items-center gap-3 py-12 text-secondary/50">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading summary...</span>
        </div>
      ) : (
        <>
          {keyTakeaways && keyTakeaways.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">
                Key Takeaways
              </h3>
              <div className="space-y-3">
                {keyTakeaways.slice(0, 5).map((point, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-secondary/30 font-mono text-sm">{i + 1}.</span>
                    <p className="text-[15px] text-secondary leading-relaxed">{stripMarkdown(point)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {body ? (
            <div className="prose prose-lg max-w-none text-secondary leading-relaxed mb-8">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          ) : item.summary ? (
            <p className="text-lg text-secondary leading-relaxed mb-8">
              {item.summary}
            </p>
          ) : (
            <p className="text-secondary/50 text-sm italic mb-8">
              Summary not available for this article.
            </p>
          )}
        </>
      )}

      <div className="pt-6 border-t border-sidebar-border">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          Read Full Article
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}

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

  const handleSelectItem = (id: string) => {
    setSelectedId(id);
    setShowMobileContent(true);
  };

  if (items.length === 0) {
    return (
      <div className="bg-surface rounded-lg p-12 text-center">
        <p className="text-lg font-semibold mb-2">Today's stories are on the way</p>
        <p className="text-sm text-secondary/50">We pull the best content every morning. Check back soon!</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden md:block">
        <div className="split-layout" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
        {/* Sidebar */}
        <div className="split-sidebar">
          <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
            <h2 className="text-[15px] font-semibold text-foreground">
              {items.length} Stories
            </h2>
            <span className="text-xs text-secondary/50">
              Updated {getTimeLabel()}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-sidebar-border/50">
            {items.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onClick={() => setSelectedId(item.id)}
                onHover={() => preloadSummary(item.url)}
              />
            ))}
          </div>

          <div className="px-4 py-3 border-t border-sidebar-border bg-surface-secondary/50">
            <Link
              href="/"
              className="block text-center text-xs text-secondary/60 hover:text-foreground transition-colors"
            >
              Sign in for personalized feed →
            </Link>
          </div>
        </div>

        {/* Content */}
        {selectedItem ? (
          <ContentPanel item={selectedItem} onCopyLink={handleCopyLink} />
        ) : (
          <div className="split-main flex items-center justify-center">
            <p className="text-secondary/50 text-sm">Select a story to read</p>
          </div>
        )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
          <h2 className="text-[15px] font-semibold text-foreground">
            {items.length} Stories
          </h2>
          <span className="text-xs text-secondary/50">
            Updated {getTimeLabel()}
          </span>
        </div>

        {/* Mobile List */}
        <div className="divide-y divide-sidebar-border/50">
          {items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              selected={false}
              onClick={() => handleSelectItem(item.id)}
              onHover={() => {}}
            />
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="px-4 py-3 border-t border-sidebar-border bg-surface-secondary/50">
          <Link
            href="/"
            className="block text-center text-xs text-secondary/60 hover:text-foreground transition-colors"
          >
            Sign in for personalized feed →
          </Link>
        </div>

        {/* Mobile Bottom Sheet */}
        {showMobileContent && selectedItem && (
          <MobileSheet
            item={selectedItem}
            onClose={() => setShowMobileContent(false)}
            onCopyLink={handleCopyLink}
          />
        )}
      </div>

      {/* Link copied toast */}
      {showCopiedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-foreground text-background text-sm font-medium shadow-lg">
          Link copied!
        </div>
      )}
    </>
  );
}
