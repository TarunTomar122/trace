"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
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
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';
import { getUserPatterns } from '@/lib/firestore';
import { buildTraceInsights, TraceInsights } from '@/lib/traceInsights';
import TraceInsightCard from '@/components/TraceInsightCard';
import { trackFeedViewed, trackFeedItemUpvoted, trackFeedItemDownvoted, trackFeedItemBookmarked, trackFeedItemClicked } from '@/lib/posthog';
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

const shuffleItems = <T,>(items: T[]): T[] => {
  const shuffled = items.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

type InteractionItem = {
  item_id?: string;
  action?: 'upvote' | 'downvote' | 'remove';
};

const sourceConfig: Record<string, { icon: typeof Youtube; color: string; label: string; accent: string; bg: string }> = {
  video: { icon: Youtube, color: 'text-red-500', label: 'Video', accent: 'bg-red-500', bg: 'bg-red-50' },
  repo: { icon: Github, color: 'text-violet-500', label: 'Repo', accent: 'bg-violet-500', bg: 'bg-violet-50' },
  paper: { icon: BookOpen, color: 'text-blue-500', label: 'Paper', accent: 'bg-blue-500', bg: 'bg-blue-50' },
  blog: { icon: BookOpen, color: 'text-emerald-600', label: 'Article', accent: 'bg-emerald-500', bg: 'bg-emerald-50' },
  discussion: { icon: MessageCircle, color: 'text-amber-600', label: 'Discussion', accent: 'bg-amber-500', bg: 'bg-amber-50' },
  tweet: { icon: MessageCircle, color: 'text-sky-500', label: 'Thread', accent: 'bg-sky-500', bg: 'bg-sky-50' },
  launch: { icon: Sparkles, color: 'text-fuchsia-500', label: 'Launch', accent: 'bg-fuchsia-500', bg: 'bg-fuchsia-50' },
  model: { icon: Sparkles, color: 'text-indigo-500', label: 'Model', accent: 'bg-indigo-500', bg: 'bg-indigo-50' },
  news: { icon: Newspaper, color: 'text-orange-500', label: 'News', accent: 'bg-orange-500', bg: 'bg-orange-50' },
};

/** Strip the "Why this matters for you" personalised section from a summary body. */
const stripPersonalizedSection = (body: string): string => {
  // Remove ## / ### headings containing "why" + "matters" / "care" and everything until the next heading or end
  return body.replace(
    /#{2,3}\s*(?:Why\s+(?:this\s+matters|it\s+matters|you\s+might\s+care)[^\n]*)\n[\s\S]*?(?=\n#{2,3}\s|\n*$)/gi,
    ''
  ).trim();
};

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

// Simple feed item card for the list view
function FeedListItem({ item, onClick, showSubscribeCta }: {
  item: FeedItem;
  onClick: () => void;
  showSubscribeCta?: boolean;
}) {
  const itemKind = item.type || item.source || 'blog';
  const config = sourceConfig[itemKind] || sourceConfig.blog;
  const Icon = config.icon;
  const subtitle = item.summary?.short_article?.subtitle;
  const hasSummary = Boolean(item.summary?.short_article?.body);
  const isSample = item.metadata?.feed_category === 'sample_summary';

  return (
    <article
      className="group p-4 md:p-5 rounded-xl transition-colors cursor-pointer hover:bg-gray-50"
      onClick={onClick}
    >
      <div className="flex items-start gap-3 md:gap-4">
        {/* Source icon - hidden on mobile */}
        <div className={`hidden md:flex w-12 h-12 rounded-xl items-center justify-center shrink-0 ${config.bg}`}>
          <Icon size={20} className={config.color} strokeWidth={1.5} />
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Source label + badges */}
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <span className={`text-[10px] font-medium uppercase tracking-wider ${config.color}`}>{config.label}</span>
            {isSample && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                <Sparkles size={10} strokeWidth={2} />
                <span className="text-[9px] font-medium uppercase tracking-wider">Free summary</span>
              </span>
            )}
            {item.metadata?.is_hot && itemKind !== 'news' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                <Flame size={10} strokeWidth={2} />
                <span className="text-[9px] font-medium uppercase tracking-wider">Hot</span>
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base md:text-lg font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1.5">
            {item.title}
            {hasSummary ? (
              <ChevronRight size={14} className="inline ml-1 opacity-40 group-hover:opacity-70 transition-opacity" />
            ) : (
              <ArrowUpRight size={14} className="inline ml-1 opacity-40 group-hover:opacity-70 transition-opacity" />
            )}
          </h3>

          {/* Subtitle from summary OR subscribe hint */}
          {subtitle ? (
            <p className="text-sm text-secondary/70 line-clamp-2">
              {subtitle}
            </p>
          ) : showSubscribeCta ? (
            <p className="text-xs text-secondary/50 mt-1 italic">
              Subscribe to unlock all summaries
            </p>
          ) : null}
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
        <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
          <Sparkles size={18} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">
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
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-5 border-t border-gray-200">
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
            <div className="py-4 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFeedbackSubmit()}
                  placeholder="Tell Trace what you think about this article..."
                  className="flex-1 px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
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

type FilterType = 'all' | string;

function FeedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedItemId = searchParams.get('item');
  
  const { user, loading, profile } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedDate, setFeedDate] = useState<string>('');
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [interactions, setInteractions] = useState<Record<string, 'upvote' | 'downvote'>>({});
  const [hasAccess, setHasAccess] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [generalFeed, setGeneralFeed] = useState<FeedItem[]>([]);
  const [isLoadingGeneral, setIsLoadingGeneral] = useState(false);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
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
  const showPersonalizedFeed = isOnboarded;
  const isFallbackFeed = showPersonalizedFeed && !isFeedLoading && feed.length === 0;
  const currentFeed = isFallbackFeed ? generalFeed : (!showPersonalizedFeed ? generalFeed : feed);
  
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
    : currentFeed.filter((item) => {
      const tags = item.tags || [];
      return tags.includes(activeFilter);
    });

  // For subscribed users: only show items with summaries
  // For unsubscribed users: bubble up to 3 summary items (different topics) to the top
  const filteredFeed = hasAccess
    ? filteredByTopic.filter((item) => item.summary?.short_article?.body)
    : (() => {
        const items = [...filteredByTopic];
        const promoted: FeedItem[] = [];
        const seenCats = new Set<string>();

        // First pass: one summary item per unique category (up to 3)
        for (let i = 0; i < items.length && promoted.length < 3; i++) {
          if (items[i].summary?.short_article?.body) {
            const cat = items[i].metadata?.feed_category || items[i].tags?.[0] || `_${i}`;
            if (!seenCats.has(cat)) {
              seenCats.add(cat);
              promoted.push(...items.splice(i, 1));
              i--;
            }
          }
        }

        // Second pass: fill remaining slots with any summary items
        for (let i = 0; i < items.length && promoted.length < 3; i++) {
          if (items[i].summary?.short_article?.body) {
            promoted.push(...items.splice(i, 1));
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
    if (!topicFilters.some((filter) => filter.id === activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, topicFilters]);

  useEffect(() => {
    if (profile) {
      const subscriptionStatus = profile.subscriptionStatus || 'none';
      let hasValidAccess = ['trial', 'active'].includes(subscriptionStatus);

      if (hasValidAccess && profile.cancelledAt) {
        const now = new Date();
        const toDate = (ts: Date | { seconds: number } | null | undefined): Date | null => {
          if (!ts) return null;
          if (ts instanceof Date) return ts;
          if (typeof ts === 'object' && 'seconds' in ts) {
            return new Date(ts.seconds * 1000);
          }
          return null;
        };

        const willCancelAt = toDate(profile.willCancelAt);
        const nextBilling = toDate(profile.nextBillingDate);
        const cancelDate = willCancelAt || nextBilling;

        if (cancelDate && now >= cancelDate) {
          hasValidAccess = false;
        }
      }

      setHasAccess(hasValidAccess);
    }
  }, [profile]);

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
    setFeed([]);

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

  const loadGeneralFeed = useCallback(async () => {
    if (!user) return;
    setIsLoadingGeneral(true);
    try {
      const token = await user.getIdToken();
      const limit = 10;
      const response = await fetch(`/api/feed/sample?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setGeneralFeed(shuffleItems(items));
      }
    } catch (error) {
      console.error('Error loading general feed:', error);
    }
    setIsLoadingGeneral(false);
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
    }
    loadGeneralFeed();
  }, [user, loading, showPersonalizedFeed, loadFeed, loadGeneralFeed]);

  useEffect(() => {
    if (!showPersonalizedFeed || !isFallbackFeed || feedGenActive) return;

    setFeedGenActive(true);

    const timer = setInterval(() => {
      setFeedGenTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showPersonalizedFeed, isFallbackFeed, feedGenActive]);

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

    const item = feed.find(i => i.id === itemId) || generalFeed.find(i => i.id === itemId);
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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
            onDisabledClick={() => setShowSubscribePrompt(true)}
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
              onClick={() => setShowSubscribePrompt(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 max-w-md w-full shadow-xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Brain size={22} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Unlock the full feed</h3>
                </div>
                <p className="text-sm text-secondary mb-6">
                  Subscribe to unlock summaries for every article. Your interactions help Trace learn what to curate for you across hundreds of sources.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSubscribePrompt(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-secondary hover:bg-gray-50 transition-colors"
                  >
                    Not now
                  </button>
                  <Link
                    href="/profile?tab=subscription"
                    className="flex-1 px-4 py-3 rounded-xl bg-foreground text-background text-sm font-medium text-center hover:bg-foreground/90 transition-colors"
                  >
                    Unlock full feed
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
        <div className="sticky top-14 md:top-16 z-40 bg-violet-50 border-b border-violet-100">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <Brain size={18} className="text-violet-600" />
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors shrink-0"
              >
                <Sparkles size={14} />
                Personalize my feed
              </Link>
            </div>
          </div>
        </div>
      ) : !hasAccess && profile ? (
        <div className="hidden md:block sticky top-14 md:top-16 z-40 bg-amber-100 border-b border-amber-100">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Brain size={18} className="text-amber-600" />
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors shrink-0"
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
            onClick={() => setShowSubscribePrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 max-w-md w-full shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Brain size={22} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Unlock the full feed</h3>
              </div>
              <p className="text-sm text-secondary mb-6">
                Subscribe to unlock the full daily feed. Your interactions teach Trace what to find and what to skip, so it gets smarter every day.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubscribePrompt(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-secondary hover:bg-gray-50 transition-colors"
                >
                  Not now
                </button>
                <Link
                  href="/profile?tab=subscription"
                  className="flex-1 px-4 py-3 rounded-xl bg-foreground text-background text-sm font-medium text-center hover:bg-foreground/90 transition-colors"
                >
                  Unlock full feed
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
            {[
              { id: 'all', label: showPersonalizedFeed ? 'For you' : 'Discover' },
              ...topicFilters,
            ].map(filter => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as FilterType)}
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${isActive
                      ? 'bg-foreground text-background'
                      : 'bg-gray-100 text-secondary hover:bg-gray-200'
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
          <aside className={`hidden md:block w-48 shrink-0 sticky h-fit ${
            (profile && !profile.onboarded) || (!hasAccess && profile)
              ? 'top-40'
              : 'top-24'
            }`}>
            <nav className="space-y-1.5">
              <h2 className="text-xs font-medium tracking-wider text-secondary/60 mb-4 px-3 lowercase">
                Filters
              </h2>
              {[
                { id: 'all', label: showPersonalizedFeed && !isFallbackFeed ? 'For you' : 'Discover' },
                ...topicFilters,
              ].map(filter => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id as FilterType)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all lowercase ${isActive
                        ? 'text-foreground bg-gray-100'
                        : 'text-secondary/70 hover:text-foreground hover:bg-gray-50'
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
              <div className="mb-4 md:mb-6 p-4 md:p-5 bg-linear-to-r from-violet-50 to-indigo-50 rounded-xl border border-violet-100">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                    <Loader2 size={20} className="text-violet-600 animate-spin" />
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
                  className="mb-4 md:mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3"
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
                    className="text-secondary/60 hover:text-foreground transition-colors shrink-0 p-1 rounded-lg hover:bg-gray-100"
                    aria-label="Dismiss hint"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {((showPersonalizedFeed && isFeedLoading) || (!showPersonalizedFeed && isLoadingGeneral) || (isFallbackFeed && isLoadingGeneral)) ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 md:p-5 rounded-xl bg-gray-50 animate-pulse">
                    <div className="flex gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-3 bg-gray-200 rounded-full w-20" />
                        <div className="h-5 bg-gray-200 rounded-lg w-full" />
                        <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/20">
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

                {filteredFeed.length === 0 && (
                  <div className="py-10 md:py-12 px-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
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
                  <div className="mt-6 mb-4 p-5 md:p-6 bg-amber-100 rounded-2xl border border-amber-100">
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
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shrink-0"
                      >
                        <Zap size={16} />
                        Unlock full feed
                      </Link>
                    </div>
                  </div>
                )}

                {/* End of feed indicator */}
                {filteredFeed.length > 0 && (
                  <div className="py-8 md:py-12 text-center border-t border-border/20">
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
