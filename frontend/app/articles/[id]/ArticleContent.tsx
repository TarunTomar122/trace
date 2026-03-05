"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { ExternalLink, Clock, Share2, Check, Sparkles } from "lucide-react";

const ACCENT = "#F59E0B";

interface ArticleData {
  id: string;
  url: string;
  title: string;
  type: string;
  source: string;
  source_name: string;
  interest_id: string;
  feed_type: string;
  published_date: string;
  thumbnail: string | null;
  summary: {
    short_article?: {
      subtitle?: string;
      outline?: string[];
      body?: string;
      key_takeaways?: string[];
      why_it_matters?: string;
    };
    reading_time_minutes?: number;
  };
  metadata: {
    feed_type: string;
    source_description?: string;
  };
}

interface Props {
  article: ArticleData;
}

export default function ArticleContent({ article }: Props) {
  const [copied, setCopied] = useState(false);

  const body = article.summary?.short_article?.body;
  const keyTakeaways = article.summary?.short_article?.key_takeaways;
  const whyItMatters = article.summary?.short_article?.why_it_matters;
  const readingTime = article.summary?.reading_time_minutes || 3;
  const isTrending = article.feed_type === "trending";
  const hasImage = article.thumbnail && typeof article.thumbnail === 'string' && article.thumbnail.length > 10;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* nothing */ }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal public header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4 max-w-3xl h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/trace.webp" alt="Trace" width={120} height={32} className="h-8 w-auto" />
            <span className="text-lg font-semibold tracking-[0.12em] text-foreground">TRACE</span>
          </Link>
          <Link
            href="/feed"
            className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: ACCENT }}
          >
            Get your feed
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-2xl py-8">
        <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-4">
          {article.title}
        </h1>

        <div className="flex items-center gap-3 text-sm text-secondary/60 mb-6">
          {article.source_name && <span>{article.source_name}</span>}
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {readingTime} min read
          </span>
        </div>

        {/* Thumbnail */}
        {hasImage && (
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-6">
            <img
              src={article.thumbnail!}
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

        {body && (
          <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </div>
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

        <div className="border-t border-gray-100 dark:border-gray-800 pt-5 mt-2 flex items-center justify-end gap-2">
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
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            Read Original <ExternalLink size={14} />
          </a>
        </div>

        {/* CTA Section */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200/50 dark:border-amber-800/30">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: ACCENT }}
            >
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">
                Get your personalized feed
              </h3>
              <p className="text-sm text-secondary/70 mb-4">
                Trace curates the best articles, videos, and discussions based on your
                interests and role. Stop doom-scrolling, start learning.
              </p>
              <Link
                href="/feed"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ backgroundColor: ACCENT }}
              >
                Try Trace free
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
