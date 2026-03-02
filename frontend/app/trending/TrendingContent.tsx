"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { getArticleImage } from "@/lib/fallback-images";

// Strip "Slide N:" prefix from slides
function cleanSlides(slides: string[]): string[] {
  return slides.map(s => s.replace(/^Slide\s*\d+:\s*/i, ''));
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

// Deterministic aspect ratio based on item index
function getAspectRatio(index: number): 'square' | 'portrait' {
  // Pattern: portrait, square, square, portrait, square, portrait...
  const pattern = [1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1];
  return pattern[index % pattern.length] ? 'portrait' : 'square';
}

function PinterestCard({
  item,
  index,
  onClick,
}: {
  item: TrendingItem;
  index: number;
  onClick: () => void;
}) {
  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const aspectRatio = getAspectRatio(index);
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
      className="block w-full text-left group relative overflow-hidden rounded-2xl bg-gray-900 break-inside-avoid mb-4"
      style={{
        aspectRatio: aspectRatio === 'portrait' ? '4/5' : '1/1',
      }}
    >
      {/* Background Image */}
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/70" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90" />

      {/* Headline at bottom - hidden on hover */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-10 transition-opacity duration-300 group-hover:opacity-0">
        <h3
          className="text-white font-extrabold leading-tight drop-shadow-xl"
          style={{
            fontSize: aspectRatio === 'portrait' ? '1.25rem' : '1.1rem',
            lineHeight: 1.15,
          }}
        >
          {item.title.length > 100 ? item.title.slice(0, 100) + '...' : item.title}
        </h3>
      </div>

      {/* Hover Overlay - shows summary */}
      <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center p-5 z-20">
        {/* Source badge */}
        {host && (
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            {host}
          </span>
        )}

        {/* Summary */}
        {item.summary ? (
          <p className="text-white/90 text-sm leading-relaxed line-clamp-6">
            {item.summary}
          </p>
        ) : (
          <p className="text-white/60 text-sm italic">
            Tap to read more
          </p>
        )}
      </div>
    </button>
  );
}

function ArticleModal({
  item,
  onClose,
}: {
  item: TrendingItem;
  onClose: () => void;
}) {
  const [fullSummary, setFullSummary] = useState<FullSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const host = (() => {
    try {
      return new URL(item.url).hostname.replace("www.", "");
    } catch {
      return item.source || "";
    }
  })();

  // Fetch full summary when modal opens
  useEffect(() => {
    async function fetchSummary() {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/summary?url=${encodeURIComponent(item.url)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.summary) {
            setFullSummary(data.summary);
          }
        }
      } catch (err) {
        console.error("Failed to fetch summary:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, [item.url]);

  // Handle both body and slides format - prefer slides for trending
  const rawSlides = fullSummary?.short_article?.slides;
  const slides = rawSlides?.length ? cleanSlides(rawSlides) : [];
  const rawBody = fullSummary?.short_article?.body || '';
  // Use slides if available, otherwise use body only if it's substantial
  const body = slides.length ? slides.join('\n\n') : (rawBody.length > 100 ? rawBody : '');
  const keyTakeaways = fullSummary?.short_article?.key_takeaways;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative bg-background w-full sm:max-w-xl sm:rounded-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
        >
          <X size={18} className="text-white" />
        </button>

        {/* Image */}
        <div className="relative aspect-[16/9] w-full">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="-mt-12 relative p-5">
          {/* Source */}
          {host && (
            <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">
              {host}
            </span>
          )}

          {/* Title */}
          <h2 className="text-xl font-bold leading-snug mt-1 mb-4">
            {item.title}
          </h2>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center gap-2 py-8 justify-center text-secondary/60">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading summary...</span>
            </div>
          )}

          {/* Key Takeaways */}
          {!loading && keyTakeaways && keyTakeaways.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                Key Takeaways
              </p>
              <ul className="space-y-1.5">
                {keyTakeaways.slice(0, 4).map((t, i) => (
                  <li key={i} className="flex gap-2 items-start text-sm">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-amber-500" />
                    <span className="text-secondary/80">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Full Summary Body */}
          {!loading && body && (
            <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-secondary/80">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          )}

          {/* Fallback to short summary */}
          {!loading && !body && item.summary && (
            <p className="text-secondary/80 leading-relaxed mb-4">
              {item.summary}
            </p>
          )}

          {/* No summary message */}
          {!loading && !body && !item.summary && (
            <p className="text-secondary/50 text-sm italic mb-4">
              Full summary not available for this article.
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
            >
              Read Full Article
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrendingContent({ items }: { items: TrendingItem[] }) {
  const [selectedItem, setSelectedItem] = useState<TrendingItem | null>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedItem) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedItem]);

  return (
    <>
      {/* Content */}
      {items.length > 0 ? (
        <>
          {/* Pinterest-style Masonry Grid */}
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {items.map((item, i) => (
              <PinterestCard
                key={item.id || i}
                item={item}
                index={i}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 mb-12 p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200/50 dark:border-amber-800/30">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                <Sparkles size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">
                  Get your personalized feed
                </h3>
                <p className="text-sm text-secondary/70 mb-4">
                  Sign up for Trace and get content filtered by your interests,
                  summarized, and delivered daily.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-amber-500 transition-all hover:bg-amber-600"
                >
                  Build your feed
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="py-24 text-center">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles size={24} className="text-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground mb-2">
            Today's reads are on the way
          </p>
          <p className="text-sm text-secondary/60 max-w-sm mx-auto">
            We pull the best content every morning. Check back soon!
          </p>
        </div>
      )}

      {/* Modal */}
      {selectedItem && (
        <ArticleModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
