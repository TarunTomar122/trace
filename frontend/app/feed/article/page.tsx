"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Clock, Share2, Check } from "lucide-react";
import Header from "@/components/Header";
import { FeedItem } from "@/lib/firestore";

const ACCENT = "#F59E0B";

export default function ArticlePage() {
  const router = useRouter();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("trace_article");
      if (raw) {
        setItem(JSON.parse(raw));
      } else {
        router.replace("/feed");
      }
    } catch {
      router.replace("/feed");
    }
  }, [router]);

  if (!item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: ACCENT, borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const isTrending = item.feed_type === "trending" || item.metadata?.feed_type === "trending";
  const slides = item.summary?.short_article?.slides;
  // For trending, join slides into body if no body exists
  const body = item.summary?.short_article?.body || (isTrending && slides?.length ? slides.join('\n\n') : '');
  const keyTakeaways = item.summary?.short_article?.key_takeaways;
  const whyItMatters = item.summary?.short_article?.why_it_matters;
  const readingTime = item.summary?.reading_time_minutes || 3;
  const hasImage = item.thumbnail && typeof item.thumbnail === 'string' && item.thumbnail.length > 10;

  const handleShare = async () => {
    if (!item.id) return;
    const shareUrl = `${window.location.origin}/articles/${item.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header  />

      <main className="container mx-auto px-4 max-w-3xl py-6">
        <h1 className="text-2xl font-bold leading-tight mb-3">{item.title}</h1>

        <div className="flex items-center gap-3 text-sm text-secondary/60 mb-6">
          {item.source_name && <span>{item.source_name}</span>}
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {readingTime} min read
          </span>
        </div>

        {/* Thumbnail */}
        {hasImage && (
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-6">
            <img
              src={item.thumbnail!}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {!isTrending && keyTakeaways && keyTakeaways.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-5 mb-6">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-3">
              Key Takeaways
            </p>
            <ul className="space-y-2">
              {keyTakeaways.map((t: string, i: number) => (
                <li key={i} className="flex gap-2.5 items-start text-sm">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: ACCENT }}
                  />
                  <span className="prose prose-sm dark:prose-invert [&>p]:m-0 [&>p]:inline">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{t}</ReactMarkdown>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {body ? (
          <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-secondary/60 mb-6">
            No summary available. Read the original article.
          </p>
        )}

        {!isTrending && whyItMatters && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-5 mb-6">
            <p className="text-xs font-semibold text-secondary/60 uppercase tracking-wider mb-1.5">
              Why it matters
            </p>
            <div className="prose prose-sm dark:prose-invert max-w-none italic text-secondary/70">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{whyItMatters}</ReactMarkdown>
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 dark:border-gray-800 pt-5 mt-2 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-sm text-secondary/60 hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            Back to feed
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 size={14} />
                  Share
                </>
              )}
            </button>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: ACCENT }}
            >
              Read Original <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
