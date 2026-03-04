"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, ChevronRight, Share2, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';
import { getArticleImage } from '@/lib/fallback-images';

interface TimelineEvent {
  id: string;
  title: string;
  summary?: string;
  timestamp: string;
  source_name?: string;
  source_url?: string;
  article_url?: string;
}

interface TopicArticle {
  id: string;
  url: string;
  title: string;
  source_name?: string;
  thumbnail?: string;
  summary?: {
    short_article?: {
      body?: string;
      subtitle?: string;
    };
  };
}

interface TopicData {
  id: string;
  topic_key: string;
  title: string;
  summary: string;
  key_points?: string[];
  thumbnail?: string;
  source_count?: number;
  article_count?: number;
  timeline?: TimelineEvent[];
  articles?: TopicArticle[];
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-foreground text-background text-sm font-medium rounded-full shadow-lg">
      {message}
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

function getTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function TopicContent({ topic }: { topic: TopicData }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  const imageUrl = getArticleImage(topic.thumbnail, topic.title);
  const fallbackUrl = getArticleImage(null, topic.title);

  const sortedTimeline = useMemo(() => {
    if (!topic.timeline) return [];
    return [...topic.timeline].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [topic.timeline]);

  const findArticle = useCallback((event: TimelineEvent): TopicArticle | null => {
    if (!event.article_url || !topic.articles) return null;
    return topic.articles.find(
      a => a.url === event.article_url && a.summary?.short_article?.body
    ) || null;
  }, [topic.articles]);

  const handleShare = async () => {
    const shareUrl = window.location.href;

    // Only use native share on actual mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title: topic.title, url: shareUrl });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Desktop: just copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("Link copied!");
      setTimeout(() => setToast(null), 2000);
    } catch {
      setToast("Couldn't copy link");
      setTimeout(() => setToast(null), 2000);
    }
  };

  const openArticle = (article: TopicArticle) => {
    // Store article data and navigate to article page
    const feedItem = {
      id: article.id,
      url: article.url,
      title: article.title,
      source_name: article.source_name,
      thumbnail: article.thumbnail,
      summary: article.summary,
      feed_type: 'trending',
    };
    sessionStorage.setItem("trace_article", JSON.stringify(feedItem));
    router.push("/feed/article");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Toast message={toast || ""} visible={!!toast} />

      <main className="container mx-auto px-4 max-w-3xl pt-4 pb-8">
        {/* Back + Share */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/feed"
            className="flex items-center gap-1.5 text-sm text-secondary/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back to feed
          </Link>
          <button
            onClick={handleShare}
            className="p-2.5 rounded-full border border-border/20 text-secondary/60 hover:text-foreground hover:border-border/40 transition-colors"
            title="Share"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Hero */}
        <div className="relative aspect-[16/9] sm:aspect-[2/1] rounded-2xl overflow-hidden bg-surface-secondary mb-5">
          <img src={fallbackUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          {!showFallback && (
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setShowFallback(true)}
            />
          )}
        </div>

        {/* Title + meta */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug mb-2">
          {topic.title}
        </h1>
        <div className="flex items-center gap-2 text-sm text-secondary/50 mb-6">
          <span>{topic.source_count || 0} sources</span>
          <span>·</span>
          <span>{topic.article_count || 0} updates</span>
        </div>

        {/* Overview */}
        {topic.summary && (
          <div className="mb-8">
            <div className="prose prose-base dark:prose-invert max-w-none text-secondary leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{topic.summary}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Key Points */}
        {topic.key_points && topic.key_points.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-foreground mb-3">Key Points</h3>
            <div className="space-y-2.5">
              {topic.key_points.slice(0, 6).map((point, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary/30 mt-2 shrink-0" />
                  <div className="text-sm text-secondary leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{point}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {sortedTimeline.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-foreground mb-4">Timeline</h3>
            <div className="relative pl-6 border-l-2 border-border/30">
              {sortedTimeline.map((event, i) => {
                const article = findArticle(event);
                const isClickable = !!article;

                return (
                  <div key={event.id || i} className="relative pb-6 last:pb-0">
                    <div className={`absolute -left-[25px] top-1 w-3 h-3 rounded-full border-2 ${
                      i === 0 ? 'bg-foreground border-foreground' : 'bg-background border-secondary/30'
                    }`} />
                    {isClickable ? (
                      <button
                        onClick={() => openArticle(article!)}
                        className="w-full text-left group hover:bg-surface-secondary rounded-xl p-3 -m-3 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] text-secondary/40">{getTimeAgo(event.timestamp)}</span>
                          {event.source_name && (
                            <>
                              <span className="text-secondary/20">·</span>
                              <span className="text-[11px] text-secondary/40">{event.source_name}</span>
                            </>
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-foreground leading-snug mb-1 group-hover:text-secondary transition-colors">
                          {event.title}
                        </h4>
                        {event.summary && (
                          <p className="text-xs text-secondary/50 line-clamp-2 leading-relaxed">{stripMarkdown(event.summary)}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1.5 text-secondary/30">
                          <span className="text-[10px]">Read summary</span>
                          <ChevronRight size={12} />
                        </div>
                      </button>
                    ) : (
                      <div className="p-3 -m-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] text-secondary/40">{getTimeAgo(event.timestamp)}</span>
                          {event.source_name && (
                            <>
                              <span className="text-secondary/20">·</span>
                              <span className="text-[11px] text-secondary/40">{event.source_name}</span>
                            </>
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-foreground leading-snug mb-1">
                          {event.title}
                        </h4>
                        {event.summary && (
                          <p className="text-xs text-secondary/50 line-clamp-2 leading-relaxed">{stripMarkdown(event.summary)}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="border-t border-border/10 pt-6 mt-4">
          <div className="text-center">
            <p className="text-sm text-secondary/50 mb-3">
              Get personalized news summaries delivered to your feed
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              Try Trace Free
              <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
