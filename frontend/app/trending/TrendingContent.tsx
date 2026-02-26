"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { getArticleImage, isValidThumbnail } from "@/lib/fallback-images";

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
    body?: string;
    key_takeaways?: string[];
    why_it_matters?: string;
  };
  reading_time_minutes?: number;
};

function TrendingCard({
  item,
  onClick,
}: {
  item: TrendingItem;
  onClick: () => void;
}) {
  const imageUrl = getArticleImage(item.thumbnail, item.title);
  const host = (() => {
    try {
      return new URL(item.url).hostname.replace("www.", "");
    } catch {
      return item.source || "";
    }
  })();

  return (
    <button onClick={onClick} className="block w-full text-left group">
      {/* Image - always shows either thumbnail or relevant fallback */}
      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Source badge */}
        {host && (
          <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <span className="text-[11px] font-medium text-white leading-none">{host}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 group-hover:text-amber-600 transition-colors">
        {item.title}
      </h3>

      {/* Summary */}
      <p className="text-sm text-secondary/60 line-clamp-2 leading-relaxed mt-1">
        {item.summary || "\u00A0"}
      </p>
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

  const hasImage = isValidThumbnail(item.thumbnail);
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

  const body = fullSummary?.short_article?.body;
  const keyTakeaways = fullSummary?.short_article?.key_takeaways;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

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
        {hasImage && (
          <div className="relative aspect-[16/9] w-full">
            <img
              src={item.thumbnail}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className={`p-5 ${hasImage ? "-mt-12 relative" : "pt-12"}`}>
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
          {/* Grid of cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            {items.map((item, i) => (
              <TrendingCard
                key={item.id || i}
                item={item}
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
