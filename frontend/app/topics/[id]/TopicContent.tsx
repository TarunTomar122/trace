"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronRight, Share2, ExternalLink, Loader2, Check,
} from 'lucide-react';
import Link from 'next/link';
import StoryPageShell, { getStoryBackLabel } from '@/components/StoryPageShell';
import { ArticleImage } from '@/components/ArticleImage';

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
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const returnHref = getSafeReturnPath(searchParams.get('from'), '/feed');
  const backLabel = getStoryBackLabel(returnHref);
  const isFromFeed = returnHref.startsWith('/feed');

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
    <StoryPageShell
      backHref={returnHref}
      backLabel={backLabel}
      mode={isFromFeed ? 'app' : 'public'}
      ctaHref="/feed"
      ctaLabel="Open feed"
      shareButton={
        <button
          type="button"
          onClick={handleShare}
          disabled={shareLoading}
          className="story-page-share"
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
      }
    >
      <Toast message={toast || ''} visible={!!toast} />

      <div className="story-page-hero">
        <ArticleImage thumbnail={topic.thumbnail} title={topic.title} />
      </div>

      <p className="story-page-kicker">Grouped story</p>
      <h1 className="story-page-title">{topic.title}</h1>
      <div className="story-page-meta">
        <span>{topic.source_count || 0} sources</span>
        <span>·</span>
        <span>{topic.article_count || 0} updates</span>
      </div>

      {topic.summary && (
        <div className="story-page-body mb-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{topic.summary}</ReactMarkdown>
        </div>
      )}

      {topic.key_points && topic.key_points.length > 0 && (
        <div className="mb-8">
          <h2 className="story-page-section-title">Key points</h2>
          <div className="space-y-3">
            {topic.key_points.slice(0, 6).map((point, i) => (
              <div key={i} className="story-page-key-point">
                <span className="story-page-key-point-dot" />
                <div className="story-page-body text-[15px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{point}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedTimeline.length > 0 && (
        <div className="mb-8">
          <h2 className="story-page-section-title">Timeline</h2>
          <div className="space-y-3">
            {sortedTimeline.map((event, i) => {
              const article = findArticle(event);
              const isClickable = !!article;

              return (
                <div key={event.id || i} className="story-page-card">
                  {isClickable ? (
                    <button type="button" onClick={() => openArticle(article!)} className="story-page-timeline-btn">
                      <div className="flex items-center gap-2 mb-1 text-[11px] text-[#9ca3af]">
                        <span>{getTimeAgo(event.timestamp)}</span>
                        {event.source_name && (
                          <>
                            <span>·</span>
                            <span>{event.source_name}</span>
                          </>
                        )}
                      </div>
                      <h3 className="story-page-timeline-title">{event.title}</h3>
                      {event.summary && (
                        <p className="mt-1 text-xs text-[#6b7280] line-clamp-2 leading-relaxed">
                          {stripMarkdown(event.summary)}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#2563eb]">
                        Read summary
                        <ChevronRight size={12} />
                      </div>
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1 text-[11px] text-[#9ca3af]">
                        <span>{getTimeAgo(event.timestamp)}</span>
                        {event.source_name && (
                          <>
                            <span>·</span>
                            <span>{event.source_name}</span>
                          </>
                        )}
                      </div>
                      <h3 className="story-page-timeline-title">{event.title}</h3>
                      {event.summary && (
                        <p className="mt-1 text-xs text-[#6b7280] line-clamp-2 leading-relaxed">
                          {stripMarkdown(event.summary)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isFromFeed && (
        <div className="story-page-promo">
          <h2 className="story-page-promo-title">Get your personalized feed</h2>
          <p className="story-page-promo-copy">
            Trace groups the biggest stories, conversations, and launches into one daily pulse so you stay current without the tab stack.
          </p>
          <Link href="/feed" className="story-page-btn-primary">
            Open your feed
            <ExternalLink size={14} />
          </Link>
        </div>
      )}

      {!isFromFeed && (
        <div className="story-page-link-row">
          <Link href="/blog" className="story-page-btn-secondary">Blog</Link>
        </div>
      )}
    </StoryPageShell>
  );
}
