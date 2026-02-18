"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Youtube,
  Github,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Bookmark,
  Sparkles,
  ArrowUpRight,
  MessageCircle,
  X,
  Brain,
  Zap,
  Eye,
  Newspaper,
  Flame,
  Loader2,
  ChevronRight,
  Lock,
  Bell,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';
import { getUserPatterns } from '@/lib/firestore';
import { buildTraceInsights, TraceInsights } from '@/lib/traceInsights';
import TraceInsightCard from '@/components/TraceInsightCard';
import {
  trackFeedViewed,
  trackFeedItemUpvoted,
  trackFeedItemDownvoted,
  trackFeedItemBookmarked,
  trackFeedItemClicked,
  trackSummaryOpened,
  trackPaywallShown,
  trackCheckoutClicked,
} from '@/lib/posthog';
import remarkGfm from 'remark-gfm';

type FeedItem = {
  id: string;
  type?: string;
  source?: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string | null;
  view_count?: number | null;
  stars?: number | null;
  tags?: string[];
  summary?: {
    short_article?: {
      subtitle?: string;
      outline?: string[];
      body?: string;
    };
    reading_time_minutes?: number;
  };
  metadata?: {
    why_relevant?: string;
    is_hot?: boolean;
    feed_category?: string;
  };
  _seen?: boolean;
  _originalIndex?: number;
};

type FeedMetadata = {
  is_preview?: boolean;
} & Record<string, unknown>;

type InteractionItem = {
  item_id?: string;
  action?: 'upvote' | 'downvote' | 'remove';
};

const sourceConfig: Record<string, { icon: typeof Youtube; color: string; label: string; accent: string; bg: string }> = {
  video: { icon: Youtube, color: 'text-red-500', label: 'Video', accent: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/40' },
  repo: { icon: Github, color: 'text-violet-500', label: 'Repo', accent: 'bg-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  paper: { icon: BookOpen, color: 'text-blue-500', label: 'Paper', accent: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  blog: { icon: BookOpen, color: 'text-emerald-600 dark:text-emerald-400', label: 'Article', accent: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  discussion: { icon: MessageCircle, color: 'text-amber-600 dark:text-amber-400', label: 'Discussion', accent: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  tweet: { icon: MessageCircle, color: 'text-sky-500', label: 'Thread', accent: 'bg-sky-500', bg: 'bg-sky-50 dark:bg-sky-950/40' },
  launch: { icon: Sparkles, color: 'text-fuchsia-500', label: 'Launch', accent: 'bg-fuchsia-500', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40' },
  model: { icon: Sparkles, color: 'text-indigo-500', label: 'Model', accent: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  news: { icon: Newspaper, color: 'text-orange-500', label: 'News', accent: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/40' },
};

/** Strip the "Why this matters for you" personalised section from a summary body. */
const stripPersonalizedSection = (body: string): string => {
  // Remove ## / ### headings containing "why" + "matters" / "care" and everything until the next heading or end
  return body.replace(
    /#{2,3}\s*(?:Why\s+(?:this\s+matters|it\s+matters|you\s+might\s+care)[^\n]*)\n[\s\S]*?(?=\n#{2,3}\s|\n*$)/gi,
    ''
  ).trim();
};

// Pastel colors for fallback thumbnails (deterministic by URL)
const PASTEL_COLORS = [
  'bg-rose-100 dark:bg-rose-900/40 text-rose-400 dark:text-rose-300',
  'bg-sky-100 dark:bg-sky-900/40 text-sky-400 dark:text-sky-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-400 dark:text-amber-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-400 dark:text-emerald-300',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-400 dark:text-violet-300',
  'bg-teal-100 dark:bg-teal-900/40 text-teal-400 dark:text-teal-300',
  'bg-orange-100 dark:bg-orange-900/40 text-orange-400 dark:text-orange-300',
  'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-400 dark:text-indigo-300',
  'bg-pink-100 dark:bg-pink-900/40 text-pink-400 dark:text-pink-300',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-400 dark:text-cyan-300',
];

function getDomainLetter(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return hostname.charAt(0).toUpperCase();
  } catch {
    return '?';
  }
}

function getPastelColor(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
}

function ArticleThumbnail({ url, thumbnail, size = 'sm' }: { url: string; thumbnail?: string | null; size?: 'sm' | 'lg' }) {
  const [imgError, setImgError] = React.useState(false);
  const pastel = getPastelColor(url);
  const letter = getDomainLetter(url);

  const sizeClasses = size === 'lg'
    ? 'w-full rounded-xl'
    : 'w-16 h-16 md:w-20 md:h-20 rounded-xl';

  if (thumbnail && !imgError) {
    return (
      <div className={`${sizeClasses} overflow-hidden shrink-0`}>
        <img
          src={thumbnail}
          alt=""
          className={`w-full ${size === 'lg' ? 'h-auto' : 'h-full object-cover'}`}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // Pastel fallback with letter
  return (
    <div className={`${sizeClasses} shrink-0 flex items-center justify-center ${pastel.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('dark:')).join(' ')}`}>
      <span className={`${size === 'lg' ? 'text-4xl' : 'text-xl'} font-semibold ${pastel.split(' ').filter(c => c.startsWith('text-') || (c.startsWith('dark:') && c.includes('text-'))).join(' ')}`}>
        {letter}
      </span>
    </div>
  );
}

const formatSummaryBody = (body: string): string => {
  let formatted = body.trim();
  formatted = formatted.replace(/(#{2,3}\s*[^\n]+)/g, '$1\n\n');
  formatted = formatted.replace(/(?<!\n)\n?(#{2,3}\s)/g, '\n\n$1');
  formatted = formatted.replace(/\n(?!\n|#|[-*]\s|\d+\.\s)/g, '\n\n');
  if (!formatted.includes('\n\n')) {
    formatted = formatted.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n\n');
  }
  return formatted.replace(/\n{3,}/g, '\n\n').trim();
};

// Fake feed items for the blurred preview behind the paywall
const PREVIEW_FEED_ITEMS = [
  { title: 'How AI Is Reshaping Software Development in 2026', source: 'TechCrunch', category: 'Trending' },
  { title: 'The State of Cloud Infrastructure: What Changed This Year', source: 'The Verge', category: 'For You' },
  { title: 'Building Reliable Distributed Systems at Scale', source: 'Engineering Blog', category: 'For You' },
  { title: 'Why Senior Engineers Are Betting on Rust for Backend', source: 'Hacker News', category: 'Trending' },
  { title: 'A Deep Dive Into Modern Authentication Patterns', source: 'Dev.to', category: 'Suggested' },
  { title: 'The Future of Mobile: Cross-Platform vs Native in 2026', source: 'Medium', category: 'For You' },
  { title: 'Understanding Vector Databases and Their Real-World Uses', source: 'Towards Data Science', category: 'Suggested' },
];

function FeedPaywall() {
  const { user } = useAuth();
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    if (!user) return;
    setIsCreatingCheckout(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }
      const data = await response.json();
      trackCheckoutClicked('feed_paywall', { source: 'hard_paywall' });
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError(err instanceof Error ? err.message : 'Failed to start trial');
      setIsCreatingCheckout(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header backHref="/" backLabel="Back" />

      <main className="max-w-xl mx-auto px-6 pt-16 md:pt-24 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-6">
              <Lock size={28} className="text-accent" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              How your free trial works
            </h1>
            <p className="text-base text-secondary max-w-sm mx-auto">
              Try Trace free for 3 days. Cancel anytime.
            </p>
          </div>

          {/* Timeline */}
          <div className="space-y-8 mb-14">
            {/* Today */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center shrink-0 shadow-md shadow-accent/20">
                <Lock size={18} className="text-accent-foreground" />
              </div>
              <div className="pt-1">
                <p className="text-lg font-bold text-foreground">Today</p>
                <p className="text-sm text-secondary mt-1">
                  Full access to your personalized feed and AI summaries.
                </p>
              </div>
            </div>

            {/* In 2 days */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-accent/60 flex items-center justify-center shrink-0 shadow-md shadow-accent/10">
                <Bell size={18} className="text-accent-foreground" />
              </div>
              <div className="pt-1">
                <p className="text-lg font-bold text-foreground">In 2 days</p>
                <p className="text-sm text-secondary mt-1">
                  We&apos;ll remind you your trial is ending.
                </p>
              </div>
            </div>

            {/* In 3 days */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-accent/30 flex items-center justify-center shrink-0 shadow-md shadow-accent/5">
                <CheckCircle2 size={18} className="text-accent-foreground" />
              </div>
              <div className="pt-1">
                <p className="text-lg font-bold text-foreground">In 3 days</p>
                <p className="text-sm text-secondary mt-1">
                  Subscription starts at $2.99/mo. Cancel before &mdash; no charge.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="max-w-sm mx-auto">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleStartTrial}
              disabled={isCreatingCheckout}
              className="w-full bg-accent text-accent-foreground py-4 rounded-xl text-base font-semibold hover:bg-accent/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 disabled:opacity-50 shadow-lg shadow-accent/25"
            >
              {isCreatingCheckout ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Setting up your trial...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Start Free Trial
                </>
              )}
            </button>

            <p className="text-xs text-secondary/50 text-center mt-4">
              3-day free trial, then $2.99/month. Cancel anytime.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// Simple feed item card for the list view
function FeedListItem({ item, onClick, showSubscribeCta }: {
  item: FeedItem;
  onClick: () => void;
  showSubscribeCta?: boolean;
}) {
  const hasSummary = Boolean(item.summary?.short_article?.body);
  const feedCategory = item.metadata?.feed_category;
  const isSample = feedCategory === 'sample_summary';
  const isHot = item.metadata?.is_hot;
  const snippet = item.summary?.short_article?.subtitle || item.description || '';

  // Category badge configuration
  const getCategoryBadge = () => {
    if (feedCategory === 'trending_news' || isHot) {
      return { label: 'Trending', color: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800' };
    }
    if (feedCategory === 'suggested') {
      return { label: 'Suggested', color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800' };
    }
    if (feedCategory === 'topics') {
      return { label: 'For You', color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' };
    }
    return null;
  };

  const categoryBadge = getCategoryBadge();

  return (
    <article
      className="group py-4 md:py-5 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 px-0 md:px-4"
      onClick={onClick}
    >
      {/* Mobile: image left (20%), content right */}
      <div className="flex flex-row gap-3 md:hidden">
        <div className="w-[20%] shrink-0 [&>div]:!w-full [&>div]:!h-auto [&>div]:aspect-square">
          <ArticleThumbnail url={item.url} thumbnail={item.thumbnail} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
          {/* {categoryBadge && (
            <span className={`inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-full border ${categoryBadge.color} w-fit`}>
              <span className="text-[9px] font-medium uppercase tracking-wider">{categoryBadge.label}</span>
            </span>
          )} */}
          <h3 className="text-[15px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {item.title}
            {hasSummary ? (
              <ChevronRight size={13} className="inline ml-1 opacity-40 group-hover:opacity-70 transition-opacity" />
            ) : (
              <ArrowUpRight size={13} className="inline ml-1 opacity-40 group-hover:opacity-70 transition-opacity" />
            )}
          </h3>
          {snippet ? (
            <p className="text-[13px] text-secondary/70 leading-relaxed line-clamp-2 mt-1">
              {snippet}
            </p>
          ) : showSubscribeCta ? (
            <p className="text-xs text-secondary/50 mt-1 italic">
              Subscribe to unlock all summaries
            </p>
          ) : null}
          {isSample && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 w-fit">
              <Sparkles size={10} strokeWidth={2} />
              <span className="text-[9px] font-medium uppercase tracking-wider">Free summary</span>
            </span>
          )}
        </div>
      </div>

      {/* Desktop: thumbnail left, content right */}
      <div className="hidden md:flex items-start gap-4">
        <ArticleThumbnail url={item.url} thumbnail={item.thumbnail} size="sm" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {item.title}
            {hasSummary ? (
              <ChevronRight size={14} className="inline ml-1 opacity-40 group-hover:opacity-70 transition-opacity" />
            ) : (
              <ArrowUpRight size={14} className="inline ml-1 opacity-40 group-hover:opacity-70 transition-opacity" />
            )}
          </h3>
          {snippet ? (
            <p className="text-sm text-secondary/70 leading-relaxed line-clamp-2 mt-1.5">
              {snippet}
            </p>
          ) : showSubscribeCta ? (
            <p className="text-xs text-secondary/50 mt-1.5 italic">
              Subscribe to unlock all summaries
            </p>
          ) : null}
          {isSample && (
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 w-fit">
              <Sparkles size={10} strokeWidth={2} />
              <span className="text-[9px] font-medium uppercase tracking-wider">Free summary</span>
            </span>
          )}
          {categoryBadge && (
            <span className={`inline-flex items-center gap-1 mb-1.5 px-2 py-0.5 text-secondary/70 w-fit`}>
              <span className="text-[9px] font-medium uppercase tracking-wider">{categoryBadge.label}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// Article detail view component
function ArticleView({
  item,
  onBack,
  onUpvote,
  onDownvote,
  onStar,
  initialVote,
  initialBookmarked,
  isBookmarkLoading,
  disabled,
  onDisabledClick,
  hasAccess
}: {
  item: FeedItem;
  onBack: () => void;
  onUpvote: (note?: string) => void;
  onDownvote: (note?: string) => void;
  onStar: () => void;
  initialVote?: 'upvote' | 'downvote';
  initialBookmarked?: boolean;
  isBookmarkLoading?: boolean;
  disabled?: boolean;
  onDisabledClick?: () => void;
  hasAccess: boolean;
}) {
  const itemKind = item.type || item.source || 'blog';
  const config = sourceConfig[itemKind] || sourceConfig.blog;
  const Icon = config.icon;
  const isSample = item.metadata?.feed_category === 'sample_summary';
  const rawSummary = item.summary?.short_article;
  // Strip the personalised "Why this matters for you" section for sample items
  const shortSummary = rawSummary && isSample
    ? { ...rawSummary, body: rawSummary.body ? stripPersonalizedSection(rawSummary.body) : undefined }
    : rawSummary;
  const [upvoted, setUpvoted] = useState(initialVote === 'upvote');
  const [downvoted, setDownvoted] = useState(initialVote === 'downvote');
  const [bookmarked, setBookmarked] = useState(initialBookmarked || false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setUpvoted(initialVote === 'upvote');
    setDownvoted(initialVote === 'downvote');
  }, [initialVote]);

  useEffect(() => {
    setBookmarked(initialBookmarked || false);
  }, [initialBookmarked]);

  const handleUpvote = () => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    const newUpvoted = !upvoted;
    setUpvoted(newUpvoted);
    if (newUpvoted) {
      setDownvoted(false);
      onUpvote();
    }
  };

  const handleDownvote = () => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    const newDownvoted = !downvoted;
    setDownvoted(newDownvoted);
    if (newDownvoted) {
      setUpvoted(false);
      onDownvote();
    }
  };

  const handleFeedbackSubmit = () => {
    if (feedback.trim()) {
      onDownvote(feedback);
      setShowFeedback(false);
      setFeedback('');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-secondary/70 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          Feed
        </button>
        <ChevronRight size={14} className="text-secondary/40" />
        <span className="text-foreground font-medium truncate max-w-[200px] md:max-w-md">
          {item.title}
        </span>
      </nav>

      {/* Free lesson callout for unsubscribed users */}
      {!hasAccess && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-3">
          <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            This summary is free! <Link href="/profile?tab=subscription" className="font-medium underline underline-offset-2 hover:text-emerald-900">Subscribe</Link> to unlock summaries for every article in your feed.
          </p>
        </div>
      )}

      {/* Article header */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex w-8 h-8 rounded-lg items-center justify-center ${config.bg}`}>
            <Icon size={16} className={config.color} strokeWidth={1.5} />
          </div>
          <span className={`text-xs font-medium uppercase tracking-wider ${config.color}`}>{config.label}</span>
          {item.metadata?.is_hot && itemKind !== 'news' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">
              <Flame size={10} strokeWidth={2} />
              <span className="text-[9px] font-medium uppercase tracking-wider">Hot</span>
            </span>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold leading-tight text-foreground mb-4">
          {item.title}
        </h1>

        {shortSummary?.subtitle && (
          <p className="text-lg text-secondary italic">
            {shortSummary.subtitle}
          </p>
        )}

        {/* Hero image — only show if there's a real thumbnail */}
        {itemKind !== 'video' && item.thumbnail && (
          <div className="mt-6 w-full rounded-xl overflow-hidden">
            <img
              src={item.thumbnail}
              alt=""
              className="w-full h-auto rounded-xl"
              loading="lazy"
            />
          </div>
        )}
      </header>

      {/* Article body */}
      {shortSummary?.body && (
        <div className="prose prose-lg max-w-none text-foreground prose-headings:font-semibold prose-headings:text-foreground prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-p:leading-relaxed prose-p:mb-5 prose-ul:my-5 prose-li:my-1.5 mb-10">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {formatSummaryBody(shortSummary.body)}
          </ReactMarkdown>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-5 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-1">
          <button
            onClick={handleUpvote}
            className={`flex items-center gap-1 p-2 rounded-lg transition-colors ${disabled
              ? 'text-secondary/20 cursor-not-allowed'
              : upvoted
                ? 'text-green-500 bg-green-50'
                : 'text-secondary/60 hover:text-green-500 hover:bg-green-50'
              }`}
            title={disabled ? "Subscribe to teach Trace" : "Upvote"}
          >
            <ThumbsUp size={18} fill={upvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            <span className="text-xs font-medium hidden sm:inline">Like</span>
          </button>

          <button
            onClick={handleDownvote}
            className={`flex items-center gap-1 p-2 rounded-lg transition-colors ${disabled
              ? 'text-secondary/20 cursor-not-allowed'
              : downvoted
                ? 'text-red-500 bg-red-50'
                : 'text-secondary/60 hover:text-red-500 hover:bg-red-50'
              }`}
            title={disabled ? "Subscribe to teach Trace" : "Downvote"}
          >
            <ThumbsDown size={18} fill={downvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            <span className="text-xs font-medium hidden sm:inline">Dislike</span>
          </button>

          <button
            onClick={() => {
              if (disabled) {
                onDisabledClick?.();
                return;
              }
              setShowFeedback(!showFeedback);
            }}
            className={`flex items-center gap-1 p-2 rounded-lg transition-colors ${disabled
              ? 'text-secondary/20 cursor-not-allowed'
              : showFeedback
                ? 'text-blue-500 bg-blue-50'
                : 'text-secondary/60 hover:text-blue-500 hover:bg-blue-50'
              }`}
            title={disabled ? "Subscribe to teach Trace" : "Add feedback"}
          >
            <MessageSquare size={18} strokeWidth={1.5} />
            <span className="text-xs font-medium hidden sm:inline">Notes</span>
          </button>

          <button
            onClick={() => {
              if (disabled) {
                onDisabledClick?.();
                return;
              }
              if (isBookmarkLoading) return;
              setBookmarked(!bookmarked);
              onStar();
            }}
            className={`flex items-center gap-1 p-2 rounded-lg transition-colors ${disabled
              ? 'text-secondary/20 cursor-not-allowed'
              : isBookmarkLoading
                ? 'text-secondary/40'
                : bookmarked
                  ? 'text-primary bg-primary/10'
                  : 'text-secondary/60 hover:text-primary hover:bg-primary/10'
              }`}
            title={disabled ? "Subscribe to teach Trace" : "Bookmark"}
            disabled={isBookmarkLoading}
          >
            {isBookmarkLoading ? (
              <div className="w-[18px] h-[18px] border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} strokeWidth={1.5} />
            )}
            <span className="text-xs font-medium hidden sm:inline">Save</span>
          </button>
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors w-full sm:w-auto"
        >
          <ArrowUpRight size={14} />
          Open original
        </a>
      </div>

      {/* Feedback input */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="py-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFeedbackSubmit()}
                  placeholder="Tell Trace what you think about this article..."
                  className="flex-1 px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                  autoFocus
                />
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={!feedback.trim()}
                  className="px-5 py-3 text-sm font-medium rounded-xl bg-foreground text-background disabled:opacity-40 hover:bg-foreground/90 transition-all"
                >
                  Send feedback
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type FilterType = 'all' | 'category:for-you' | 'category:trending' | 'category:suggested' | string;
const FREE_SUMMARY_UNLOCK_COUNT = 1;

function FeedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedItemId = searchParams.get('item');
  const fromOnboarding = searchParams.get('from') === 'onboarding';

  const { user, loading, profile } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedDate, setFeedDate] = useState<string>('');
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [interactions, setInteractions] = useState<Record<string, 'upvote' | 'downvote'>>({});
  const hasAccess = useMemo(() => {
    if (!profile) return false;
    const subscriptionStatus = profile.subscriptionStatus || 'none';
    const appSubscriptionStatus = profile.appSubscriptionStatus || 'none';
    let valid = ['trial', 'active'].includes(subscriptionStatus) || ['trial', 'active'].includes(appSubscriptionStatus);

    if (valid && profile.cancelledAt) {
      const now = new Date();
      const toDate = (ts: Date | { seconds: number } | null | undefined): Date | null => {
        if (!ts) return null;
        if (ts instanceof Date) return ts;
        if (typeof ts === 'object' && 'seconds' in ts) return new Date(ts.seconds * 1000);
        return null;
      };
      const willCancelAt = toDate(profile.willCancelAt);
      const nextBilling = toDate(profile.nextBillingDate);
      const cancelDate = willCancelAt || nextBilling;
      if (cancelDate && now >= cancelDate) valid = false;
    }

    return valid;
  }, [profile]);
  const [showHint, setShowHint] = useState(false);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const [subscribePromptSource, setSubscribePromptSource] = useState<'summary_gate' | 'engagement_gate' | 'post_onboarding_gate' | 'manual'>('manual');
  const [summaryOpenCount, setSummaryOpenCount] = useState(0);
  const [showPostOnboardingGate, setShowPostOnboardingGate] = useState(false);
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<string>>(new Set());
  const [loadingBookmarks, setLoadingBookmarks] = useState<Set<string>>(new Set());
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [traceInsights, setTraceInsights] = useState<TraceInsights | null>(null);
  const [traceInsightsLoading, setTraceInsightsLoading] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [showTraceInsight, setShowTraceInsight] = useState(false);
  const [insightDismissed, setInsightDismissed] = useState(false);

  const [unseenCount, setUnseenCount] = useState(0);
  const [feedMetadata, setFeedMetadata] = useState<FeedMetadata | null>(null);
  const isLoadingRef = useRef(false);
  const hasLoadedInitialFeed = useRef(false);
  const postOnboardingGateHandled = useRef(false);

  const [feedGenTimeRemaining, setFeedGenTimeRemaining] = useState(90);
  const [feedGenActive, setFeedGenActive] = useState(false);
  const feedGenRefreshAttempted = useRef(false);

  useEffect(() => {
    const hasSeenHint = localStorage.getItem('feed-hint-dismissed');
    if (!hasSeenHint) {
      setShowHint(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = sessionStorage.getItem('trace-insight-dismissed') === 'true';
    setInsightDismissed(dismissed);
  }, []);

  const isOnboarded = profile?.onboarded ?? false;
  const showPersonalizedFeed = isOnboarded && hasAccess;
  const isFallbackFeed = showPersonalizedFeed && !isFeedLoading && feed.length === 0;
  const currentFeed = showPersonalizedFeed ? feed : [];

  const openSubscribePrompt = useCallback(
    (
      source: 'summary_gate' | 'engagement_gate' | 'post_onboarding_gate' | 'manual',
      props?: Record<string, unknown>,
    ) => {
      setSubscribePromptSource(source);
      setShowSubscribePrompt(true);
      trackPaywallShown(source, props);
    },
    [],
  );

  const normalizeInterest = (interest: string) => {
    return interest
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/&/g, 'and')
      .replace(/[\\/]/g, '-')
      .replace(/[()]/g, '');
  };

  const profileTopics = [
    ...(profile?.interests || []),
    ...(profile?.hobbies || []),
  ].filter((i): i is string => typeof i === 'string' && i.trim().length > 0);

  const profileFilters = profileTopics.map((topic) => ({
    id: normalizeInterest(topic),
    label: topic,
  }));

  const availableTagIds = new Set(
    currentFeed.flatMap((item) => (Array.isArray(item.tags) ? item.tags : []))
  );

  const tagFilters = Array.from(availableTagIds).map((tag) => ({
    id: tag,
    label: tag.replace(/-/g, ' '),
  }));

  const availableProfileFilters = profileFilters.filter((filter) => availableTagIds.has(filter.id));
  const topicFilters = availableProfileFilters.length > 0 ? availableProfileFilters : tagFilters;
  
  // Category filters (shown only if feed has items with those categories)
  const categoryFilters = [
    { id: 'category:for-you', label: 'For You', hasItems: currentFeed.some(item => item.metadata?.feed_category === 'topics') },
    { id: 'category:trending', label: 'Trending', hasItems: currentFeed.some(item => item.metadata?.feed_category === 'trending_news' || item.metadata?.is_hot) },
    { id: 'category:suggested', label: 'Suggested', hasItems: currentFeed.some(item => item.metadata?.feed_category === 'suggested') },
  ].filter(f => f.hasItems);
  
  const insightInsertIndex = 2;
  const canShowTraceInsight = Boolean(showTraceInsight && traceInsights && !traceInsightsLoading);

  useEffect(() => {
    if (!user || !profile?.onboarded) {
      setTraceInsights(null);
      return;
    }

    let isActive = true;
    setTraceInsightsLoading(true);

    Promise.all([
      getUserPatterns(user.uid),
    ])
      .then(([patterns]) => {
        if (!isActive) return;
        const insights = buildTraceInsights({ patterns });
        setTraceInsights(insights);
      })
      .catch((error) => {
        console.error('Error loading trace insights:', error);
      })
      .finally(() => {
        if (!isActive) return;
        setTraceInsightsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [user, profile]);

  const filteredByTopic = activeFilter === 'all'
    ? currentFeed
    : activeFilter.startsWith('category:')
      ? (() => {
        const category = activeFilter.replace('category:', '');
        return currentFeed.filter((item) => {
          const feedCategory = item.metadata?.feed_category;
          const isHot = item.metadata?.is_hot;
          
          if (category === 'for-you') return feedCategory === 'topics';
          if (category === 'trending') return feedCategory === 'trending_news' || isHot;
          if (category === 'suggested') return feedCategory === 'suggested';
          
          return false;
        });
      })()
      : currentFeed.filter((item) => {
        const tags = item.tags || [];
        return tags.includes(activeFilter);
      });

  // For subscribed users: only show items with summaries
  // For unsubscribed users: keep only a single free summary sample at the top.
  const filteredFeed = hasAccess
    ? filteredByTopic
    : (() => {
      const items = [...filteredByTopic];
      const promoted: FeedItem[] = [];
      for (let i = 0; i < items.length && promoted.length < FREE_SUMMARY_UNLOCK_COUNT; i++) {
        if (items[i].summary?.short_article?.body) {
          const sampleItem = {
            ...items[i],
            metadata: {
              ...(items[i].metadata || {}),
              feed_category: 'sample_summary',
            },
          };
          promoted.push(sampleItem);
          items.splice(i, 1);
          i--;
        }
      }

      return [...promoted, ...items];
    })();

  // Find selected item
  const selectedItem = selectedItemId
    ? filteredFeed.find(item => item.id === selectedItemId) || currentFeed.find(item => item.id === selectedItemId)
    : null;

  useEffect(() => {
    if (!traceInsights || insightDismissed || !hasAccess) return;
    if (interactionCount >= 3 && !showTraceInsight) {
      setShowTraceInsight(true);
    }
  }, [interactionCount, traceInsights, insightDismissed, showTraceInsight, hasAccess]);

  useEffect(() => {
    if (activeFilter === 'all') return;
    
    // Check if it's a category filter
    if (activeFilter.startsWith('category:')) {
      const categoryExists = categoryFilters.some((filter) => filter.id === activeFilter);
      if (!categoryExists) {
        setActiveFilter('all');
      }
      return;
    }
    
    // Check if it's a topic filter
    if (!topicFilters.some((filter) => filter.id === activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, topicFilters, categoryFilters]);

  // hasAccess is now computed via useMemo above (synchronous with profile changes)

  useEffect(() => {
    if (!user || !profile?.onboarded || hasAccess || postOnboardingGateHandled.current) return;
    if (!fromOnboarding) return;

    const gateKey = `post_onboarding_gate_seen:${user.uid}`;
    const alreadySeen = typeof window !== 'undefined' && sessionStorage.getItem(gateKey) === '1';
    if (alreadySeen) return;

    postOnboardingGateHandled.current = true;
    setShowPostOnboardingGate(true);
    openSubscribePrompt('post_onboarding_gate');
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(gateKey, '1');
    }
    router.replace('/feed');
  }, [user, profile, hasAccess, fromOnboarding, router, openSubscribePrompt]);

  useEffect(() => {
    if (!isAlphaMode()) {
      if (user) {
        router.push('/waitlist');
      } else {
        router.push('/');
      }
      return;
    }

    if (!loading && !user) {
      router.push('/');
      return;
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (!profile.onboarded) {
      router.replace('/onboarding');
    }
  }, [loading, user, profile, router]);

  const loadInteractions = useCallback(async (uid: string, feedGenDate: string) => {
    if (!feedGenDate) return;

    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/interactions?date=${feedGenDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const interactionsMap: Record<string, 'upvote' | 'downvote'> = {};

        if (Array.isArray(data.interactions)) {
          data.interactions.forEach((interaction: InteractionItem) => {
            if (
              interaction.item_id &&
              (interaction.action === 'upvote' || interaction.action === 'downvote')
            ) {
              interactionsMap[interaction.item_id] = interaction.action;
            }
          });
        }

        setInteractions(interactionsMap);
      }
    } catch (error) {
      console.error('Error loading interactions:', error);
    }
  }, [user]);

  const loadFeed = useCallback(async (uid: string, dateOverride?: string) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    setIsFeedLoading(true);

    try {
      const token = await user?.getIdToken();
      if (!token) {
        isLoadingRef.current = false;
        return;
      }

      const params = new URLSearchParams();
      if (dateOverride) params.set('date', dateOverride);
      params.set('limit', '50');

      const response = await fetch(`/api/feed/paginated?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const sortedItems = items.map((item: FeedItem, index: number) => ({
          ...item,
          _originalIndex: index,
        }));

        setFeed(sortedItems);
        setFeedMetadata(data.metadata || null);

        if (data.feedDate) {
          setFeedDate(data.feedDate);
        }

        const unseenItems = sortedItems.filter((item: FeedItem) => !item._seen);
        setUnseenCount(unseenItems.length);

        trackFeedViewed(items.length, data.metadata?.is_preview);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setIsFeedLoading(false);
      isLoadingRef.current = false;
    }
  }, [user]);

  const loadBookmarks = useCallback(async () => {
    if (!user || bookmarksLoaded) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/bookmarks', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const bookmarkIds = new Set<string>(
          (data.bookmarks || []).map((b: { item_id: string }) => b.item_id)
        );
        setBookmarkedItems(bookmarkIds);
        setBookmarksLoaded(true);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  }, [user, bookmarksLoaded]);

  useEffect(() => {
    if (!user || loading) return;

    if (hasLoadedInitialFeed.current) return;
    hasLoadedInitialFeed.current = true;

    if (showPersonalizedFeed) {
      loadFeed(user.uid);
    } else {
      setIsFeedLoading(false);
      setFeed([]);
    }
  }, [user, loading, showPersonalizedFeed, loadFeed]);

  // Safety net: trigger feed generation if subscribed user has empty feed
  const hasTriggeredFeedGen = useRef(false);
  useEffect(() => {
    if (!isFallbackFeed || !user || hasTriggeredFeedGen.current) return;
    hasTriggeredFeedGen.current = true;

    (async () => {
      try {
        const token = await user.getIdToken();
        await fetch('/api/onboard', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: user.uid }),
        });
      } catch (err) {
        console.error('Error triggering feed generation:', err);
      }
    })();
  }, [isFallbackFeed, user]);

  useEffect(() => {
    if (!showPersonalizedFeed || !isFallbackFeed) {
      setFeedGenActive(false);
      setFeedGenTimeRemaining(90);
      feedGenRefreshAttempted.current = false;
      return;
    }

    setFeedGenActive(true);

    const timer = setInterval(() => {
      setFeedGenTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showPersonalizedFeed, isFallbackFeed]);

  // While fallback feed is showing, keep checking for personalized feed readiness.
  useEffect(() => {
    if (!showPersonalizedFeed || !isFallbackFeed || !user) return;

    const poll = setInterval(() => {
      if (!isLoadingRef.current) {
        loadFeed(user.uid);
      }
    }, 15000);

    return () => clearInterval(poll);
  }, [showPersonalizedFeed, isFallbackFeed, user, loadFeed]);

  useEffect(() => {
    if (feedGenTimeRemaining !== 0 || feedGenRefreshAttempted.current) return;
    feedGenRefreshAttempted.current = true;

    if (user) {
      isLoadingRef.current = false;
      hasLoadedInitialFeed.current = false;
      loadFeed(user.uid);
    }
  }, [feedGenTimeRemaining, user, loadFeed]);

  const recordInteraction = async (itemId: string, action: 'upvote' | 'downvote', note?: string) => {
    if (!user || !feedDate) return;

    try {
      const token = await user.getIdToken();
      await fetch('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: itemId,
          action,
          date: feedDate,
          note,
        }),
      });

      setInteractions((prev) => ({
        ...prev,
        [itemId]: action,
      }));
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  };

  const handleUpvote = async (itemId: string, note?: string) => {
    console.log('Upvoted:', itemId);

    if (Object.keys(interactions).length === 0 && user && feedDate) {
      await loadInteractions(user.uid, feedDate);
    }

    const item = feed.find(i => i.id === itemId);
    trackFeedItemUpvoted(itemId, item?.type || item?.source || 'unknown');
    recordInteraction(itemId, 'upvote', note);
    setInteractionCount((prev) => prev + 1);
  };

  const handleDownvote = async (itemId: string, note?: string) => {
    console.log('Downvoted:', itemId, note ? `with note: ${note}` : '');

    if (Object.keys(interactions).length === 0 && user && feedDate) {
      await loadInteractions(user.uid, feedDate);
    }

    const item = feed.find(i => i.id === itemId);
    trackFeedItemDownvoted(itemId, item?.type || item?.source || 'unknown');
    recordInteraction(itemId, 'downvote', note);
    setInteractionCount((prev) => prev + 1);
  };

  const dismissTraceInsight = () => {
    setShowTraceInsight(false);
    setInsightDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('trace-insight-dismissed', 'true');
    }
  };

  const handleStar = async (itemId: string) => {
    if (!user) return;

    const item = feed.find(i => i.id === itemId);
    if (!item) return;

    setLoadingBookmarks(prev => new Set(prev).add(itemId));

    try {
      const token = await user.getIdToken();

      if (!bookmarksLoaded) {
        await loadBookmarks();
      }

      const isCurrentlyBookmarked = bookmarkedItems.has(itemId);

      if (isCurrentlyBookmarked) {
        await fetch(`/api/bookmarks?item_id=${itemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        setBookmarkedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      } else {
        await fetch('/api/bookmarks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            item_id: itemId,
            item_metadata: {
              type: item.type || item.source,
              title: item.title,
              description: item.description,
              url: item.url,
              thumbnail: item.thumbnail,
              tags: item.tags || [],
              why_relevant: item.metadata?.why_relevant,
            },
          }),
        });
        trackFeedItemBookmarked(itemId, item.type || item.source || 'unknown');
        setBookmarkedItems(prev => new Set(prev).add(itemId));
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    } finally {
      setLoadingBookmarks(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleItemClick = (itemId: string) => {
    const item = filteredFeed.find(i => i.id === itemId);
    if (item) {
      trackFeedItemClicked(itemId, item.type || item.source || 'blog', item.source || 'unknown');

      // If item has summary, go to article view; otherwise open original link
      const hasSummary = Boolean(item.summary?.short_article?.body);
      if (hasSummary) {
        const isSample = item.metadata?.feed_category === 'sample_summary';
        if (!hasAccess && !isSample) {
          openSubscribePrompt('summary_gate', {
            item_id: itemId,
            summary_open_count: summaryOpenCount,
          });
          return;
        }
        trackSummaryOpened(itemId, hasAccess);
        if (!hasAccess) {
          setSummaryOpenCount((prev) => prev + 1);
        }
        router.push(`/feed?item=${itemId}`);
        window.scrollTo(0, 0);
      } else {
        window.open(item.url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleBackToFeed = () => {
    router.push('/feed');
    window.scrollTo(0, 0);
  };

  const subscribeModalContent = (() => {
    if (subscribePromptSource === 'post_onboarding_gate' || showPostOnboardingGate) {
      return {
        title: 'Your personalized feed is ready. Unlock full access?',
        body:
          'You just set up your interests. Start your trial to unlock every summary, daily premium curation, and a newsletter tuned to your topics.',
        cta: 'Start 3-day trial',
      };
    }
    if (subscribePromptSource === 'engagement_gate') {
      return {
        title: 'Unlock full feed + actions',
        body:
          'You are engaging like a power user. Subscribe to unlock all summaries, voting, notes, and smarter daily recommendations.',
        cta: 'Unlock full feed',
      };
    }
    return {
      title: 'Unlock the full feed',
      body:
        'Subscribe to unlock summaries for every article. Your interactions help Trace learn what to curate for you across hundreds of sources.',
      cta: 'Unlock full feed',
    };
  })();

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (profile?.onboarded && !hasAccess) {
    return <FeedPaywall />;
  }

  // Article detail view
  if (selectedItem) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header backHref="/feed" backLabel="Feed" />

        <main className="w-full mt-6 md:mt-10 px-4 md:px-6 lg:px-8 pb-20">
          <ArticleView
            item={selectedItem}
            onBack={handleBackToFeed}
            onUpvote={(note) => handleUpvote(selectedItem.id, note)}
            onDownvote={(note) => handleDownvote(selectedItem.id, note)}
            onStar={() => handleStar(selectedItem.id)}
            initialVote={interactions[selectedItem.id]}
            initialBookmarked={bookmarkedItems.has(selectedItem.id)}
            isBookmarkLoading={loadingBookmarks.has(selectedItem.id)}
            disabled={!hasAccess}
            onDisabledClick={() =>
              openSubscribePrompt('engagement_gate', {
                context: 'article_actions_disabled',
                item_id: selectedItem.id,
              })
            }
            hasAccess={hasAccess}
          />
        </main>

        {/* Subscribe prompt modal */}
        <AnimatePresence>
          {showSubscribePrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
              onClick={() => {
                setShowSubscribePrompt(false);
                setShowPostOnboardingGate(false);
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-[#16161e] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 max-w-md w-full shadow-xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Brain size={22} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">{subscribeModalContent.title}</h3>
                </div>
                <p className="text-sm text-secondary mb-6">
                  {subscribeModalContent.body}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSubscribePrompt(false);
                      setShowPostOnboardingGate(false);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Not now
                  </button>
                  <Link
                    href="/profile?tab=subscription"
                    onClick={() =>
                      trackCheckoutClicked(subscribePromptSource, {
                        from_onboarding: showPostOnboardingGate,
                      })
                    }
                    className="flex-1 px-4 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-medium text-center hover:bg-accent/90 transition-colors"
                  >
                    {subscribeModalContent.cta}
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Feed list view
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header backHref="/" backLabel="Back" />

      {/* Callout banner */}
      {profile && !profile.onboarded ? (
        <div className="sticky top-14 md:top-16 z-40 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/40">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                  <Brain size={18} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Make the feed yours in 2 minutes
                  </p>
                  <p className="text-xs text-secondary/70 mt-0.5">
                    82% of early users say their feed feels sharper after picking interests
                  </p>
                </div>
              </div>
              <Link
                href="/onboarding"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors shrink-0"
              >
                <Sparkles size={14} />
                Personalize my feed
              </Link>
            </div>
          </div>
        </div>
      ) : !hasAccess && profile ? (
        <div className="hidden md:block sticky top-14 md:top-16 z-40 bg-amber-100 dark:bg-[#1a1a10] border-b border-amber-200 dark:border-amber-900/60">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-200 dark:bg-amber-900 flex items-center justify-center shrink-0">
                  <Brain size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    You&apos;re seeing a starter feed
                  </p>
                  <p className="text-xs text-secondary/70 mt-0.5">
                    Unlock the full feed + AI-generated lessons from every article.
                  </p>
                </div>
              </div>
              <Link
                href="/profile?tab=subscription"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-colors shrink-0"
              >
                <Zap size={14} />
                Unlock full feed
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Subscribe prompt modal */}
      <AnimatePresence>
        {showSubscribePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
            onClick={() => {
              setShowSubscribePrompt(false);
              setShowPostOnboardingGate(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#16161e] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 max-w-md w-full shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Brain size={22} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{subscribeModalContent.title}</h3>
              </div>
              <p className="text-sm text-secondary mb-6">
                {subscribeModalContent.body}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSubscribePrompt(false);
                    setShowPostOnboardingGate(false);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-secondary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Not now
                </button>
                <Link
                  href="/profile?tab=subscription"
                  onClick={() =>
                    trackCheckoutClicked(subscribePromptSource, {
                      from_onboarding: showPostOnboardingGate,
                    })
                  }
                  className="flex-1 px-4 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-medium text-center hover:bg-accent/90 transition-colors"
                >
                  {subscribeModalContent.cta}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full mt-6 md:mt-10">
        {/* Mobile: Feed date */}
        {showPersonalizedFeed && (
          <div className="md:hidden px-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {feedDate && (
                  <span className="text-xs font-mono text-secondary/60">
                    Feed: {feedDate}
                  </span>
                )}
                {unseenCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-mono text-primary">
                    <Eye size={10} />
                    {unseenCount} new
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile filters */}
        <div className="md:hidden overflow-x-auto mb-4 px-4 scrollbar-hide">
          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${activeFilter === 'all'
                ? 'bg-foreground text-background'
                : 'bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              {showPersonalizedFeed ? 'All' : 'Discover'}
            </button>
            
            {categoryFilters.map(filter => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as FilterType)}
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${isActive
                    ? 'bg-foreground text-background'
                    : 'bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  {filter.label}
                </button>
              );
            })}
            
            {categoryFilters.length > 0 && topicFilters.length > 0 && (
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
            )}
            
            {topicFilters.map(filter => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as FilterType)}
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${isActive
                    ? 'bg-foreground text-background'
                    : 'bg-gray-100 dark:bg-gray-800 text-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 md:flex md:gap-8">
          {/* Filters - left sidebar, sticky (desktop only) */}
          <aside className={`hidden md:block w-48 shrink-0 sticky h-fit ${(profile && !profile.onboarded) || (!hasAccess && profile)
              ? 'top-40'
              : 'top-24'
            }`}>
            <nav className="space-y-1.5">
              <h2 className="text-xs font-medium tracking-wider text-secondary/60 mb-4 px-3 lowercase">
                Filters
              </h2>
              
              <button
                onClick={() => setActiveFilter('all')}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all lowercase ${activeFilter === 'all'
                  ? 'text-foreground bg-gray-100 dark:bg-gray-800'
                  : 'text-secondary/70 hover:text-foreground hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
              >
                {showPersonalizedFeed && !isFallbackFeed ? 'All' : 'Discover'}
              </button>
              
              {categoryFilters.map(filter => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id as FilterType)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all lowercase ${isActive
                      ? 'text-foreground bg-gray-100 dark:bg-gray-800'
                      : 'text-secondary/70 hover:text-foreground hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
              
              {categoryFilters.length > 0 && topicFilters.length > 0 && (
                <div className="my-3 mx-3 border-t border-gray-200 dark:border-gray-700" />
              )}
              
              {topicFilters.map(filter => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id as FilterType)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all lowercase ${isActive
                      ? 'text-foreground bg-gray-100 dark:bg-gray-800'
                      : 'text-secondary/70 hover:text-foreground hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Feed content */}
          <div className="flex-1 w-full">
            {/* Feed generation progress */}
            {isFallbackFeed && feedGenActive && (
              <div className="mb-4 md:mb-6 p-4 md:p-5 bg-linear-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-xl border border-violet-100 dark:border-violet-900/40">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                    <Loader2 size={20} className="text-violet-600 dark:text-violet-400 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Building your personalized feed...
                    </p>
                    <p className="text-xs text-secondary/70 mb-3">
                      Trace is analyzing your interests to find the best content. This usually takes about a minute.
                    </p>
                    <div className="w-full bg-violet-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-violet-500 h-full rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${((90 - feedGenTimeRemaining) / 90) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-mono text-secondary/50 mt-2">
                      {Math.floor(feedGenTimeRemaining / 60)}:{(feedGenTimeRemaining % 60).toString().padStart(2, '0')} remaining
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-secondary/60 mt-3 pl-14 md:pl-16">
                  In the meantime, explore some popular picks below!
                </p>
              </div>
            )}

            {/* Hint about feedback */}
            <AnimatePresence>
              {showPersonalizedFeed && showHint && !isFeedLoading && filteredFeed.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 md:mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-start gap-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Pro tip: Vote on content to personalize your feed!
                    </p>
                    <p className="text-xs text-secondary">
                      Your feedback helps us understand what you like and refine tomorrow&apos;s recommendations.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowHint(false);
                      localStorage.setItem('feed-hint-dismissed', 'true');
                    }}
                    className="text-secondary/60 hover:text-foreground transition-colors shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label="Dismiss hint"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {isFeedLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 md:p-5 rounded-xl bg-gray-50 dark:bg-gray-800/50 animate-pulse">
                    <div className="flex gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 dark:bg-gray-700 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredFeed.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <FeedListItem
                        item={item}
                        onClick={() => handleItemClick(item.id)}
                        showSubscribeCta={!hasAccess && !item.summary?.short_article?.subtitle}
                      />
                      {canShowTraceInsight && index === insightInsertIndex && traceInsights && (
                        <div className="py-3 md:py-4" key="trace-insight-card">
                          <TraceInsightCard
                            insights={traceInsights}
                            variant="compact"
                            onDismiss={dismissTraceInsight}
                            showCta
                          />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {filteredFeed.length === 0 && !feedGenActive && (
                  <div className="py-10 md:py-12 px-4">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#16161e] p-5 md:p-6">
                      <p className="text-sm font-medium text-foreground">
                        Trace is working on finding items for you. Check back soon.
                      </p>
                      <p className="text-xs text-secondary/70 mt-2">
                        Pro tip: You get a more aligned feed if you set up at least 4 interests in your profile.
                      </p>
                    </div>
                  </div>
                )}

                {/* Bottom callout for unsubscribed users */}
                {feedMetadata?.is_preview && filteredFeed.length > 0 && (
                  <div className="mt-6 mb-4 p-5 md:p-6 bg-amber-100 dark:bg-[#1a1a10] rounded-2xl border border-amber-200 dark:border-amber-900/60">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-base font-semibold text-foreground">
                            Want more?
                          </p>
                          <p className="text-sm text-secondary/70 mt-0.5">
                            Unlock the full feed + AI-generated lessons from every article.
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/profile?tab=subscription"
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
                      >
                        <Zap size={16} />
                        Unlock full feed
                      </Link>
                    </div>
                  </div>
                )}

                {/* End of feed indicator */}
                {filteredFeed.length > 0 && (
                  <div className="py-8 md:py-12 text-center border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary/50">You&apos;re all caught up</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FeedPageContent />
    </Suspense>
  );
}
