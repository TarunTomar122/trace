"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, ChevronRight, Share2, ExternalLink, Loader2, Check,
} from 'lucide-react';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
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
  sourceArchiveDate?: string;
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

function getSafeReturnPath(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

function formatLongArchiveDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export default function TopicContent({ topic }: { topic: TopicData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const imageUrl = getArticleImage(topic.thumbnail, topic.title);
  const fallbackUrl = getArticleImage(null, topic.title);
  const returnHref = getSafeReturnPath(searchParams.get('from'), '/trending');
  const backLabel = returnHref.startsWith('/daily/') ? 'Back to daily' : 'Back to trending';

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
    setShareLoading(true);
    const shareUrl = window.location.href;

    try {
      // Generate share image
      const params = new URLSearchParams({
        headline: topic.title,
        imageUrl: topic.thumbnail || '',
        url: shareUrl,
      });
      const imageResponse = await fetch(`/api/share/render?${params.toString()}`);

      if (!imageResponse.ok) {
        throw new Error('Failed to generate image');
      }

      const blob = await imageResponse.blob();
      const file = new File([blob], 'trace-story.png', { type: 'image/png' });

      // Try Web Share API with file
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: topic.title,
          text: `Read the full story on Trace: ${shareUrl}`,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trace-story.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch {
      // Fallback to just copying the URL
      try {
        await navigator.clipboard.writeText(shareUrl);
        setToast("Link copied!");
        setTimeout(() => setToast(null), 2000);
      } catch {
        setToast("Couldn't copy link");
        setTimeout(() => setToast(null), 2000);
      }
    } finally {
      setShareLoading(false);
    }
  };

  const openArticle = (article: TopicArticle) => {
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
    sessionStorage.setItem("trace_article_returnTo", window.location.pathname);
    router.push("/feed/article");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Toast message={toast || ""} visible={!!toast} />

      <main className="container mx-auto px-4 max-w-3xl pt-8 pb-8">
        {/* Back + Share */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={returnHref}
            className="flex items-center gap-1.5 text-sm text-secondary/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            {backLabel}
          </Link>
          <button
            onClick={handleShare}
            disabled={shareLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border/30 text-sm font-medium text-secondary/70 hover:text-foreground hover:border-border/60 transition-colors disabled:opacity-50"
          >
            {shareLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : shareSuccess ? (
              <Check size={15} className="text-green-500" />
            ) : (
              <Share2 size={15} />
            )}
            {shareLoading ? 'Generating...' : shareSuccess ? 'Shared!' : 'Share'}
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

        {topic.sourceArchiveDate && (
          <div className="mb-6 rounded-2xl border border-border/30 bg-surface/40 p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary/40">
              Daily snapshot
            </p>
            <p className="mt-1.5 text-sm text-secondary leading-relaxed">
              This topic is included in the Trace archive for{' '}
              <span className="font-medium text-foreground/90">{formatLongArchiveDate(topic.sourceArchiveDate)}</span>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/daily/${topic.sourceArchiveDate}`}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-foreground underline-offset-2 hover:underline"
              >
                Open that day&apos;s full archive
                <ChevronRight size={14} className="opacity-60" />
              </Link>
              <span className="text-secondary/30">·</span>
              <Link
                href="/daily"
                className="text-[13px] font-medium text-secondary/60 hover:text-foreground"
              >
                Browse all archive days
              </Link>
            </div>
          </div>
        )}

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
            <div className="space-y-3">
              {sortedTimeline.map((event, i) => {
                const article = findArticle(event);
                const isClickable = !!article;

                return (
                  <div key={event.id || i} className="rounded-2xl border border-border/40 bg-white/60 p-4">
                    {isClickable ? (
                      <button
                        onClick={() => openArticle(article!)}
                        className="w-full text-left group transition-colors"
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
                      <div>
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
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
              <Link href="/daily" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
                Daily archive
              </Link>
              <Link href="/research" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
                Research
              </Link>
              <Link href="/compare" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
                Compare
              </Link>
              <Link href="/tools" className="rounded-full border border-border/25 px-3 py-1.5 text-secondary hover:text-foreground">
                Tools
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
