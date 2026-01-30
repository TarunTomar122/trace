"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
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
  RefreshCw,
  Zap,
  ChevronDown,
  Eye,
  Check,
  Newspaper,
  Flame
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isAlphaMode } from '@/lib/alpha';
import Header from '@/components/Header';
import { getUserPatterns } from '@/lib/firestore';
import { buildTraceInsights, TraceInsights } from '@/lib/traceInsights';
import TraceInsightCard from '@/components/TraceInsightCard';

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

function FeedCard({ item, onUpvote, onDownvote, onStar, initialVote, disabled, onDisabledClick, onVisible, initialBookmarked, isBookmarkLoading }: {
  item: FeedItem;
  onUpvote: (note?: string) => void;
  onDownvote: (note?: string) => void;
  onStar: () => void;
  initialVote?: 'upvote' | 'downvote';
  disabled?: boolean;
  onDisabledClick?: () => void;
  onVisible?: (itemId: string) => void;
  initialBookmarked?: boolean;
  isBookmarkLoading?: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const hasBeenSeen = useRef(false);
  const itemKind = item.type || item.source || 'blog';
  const config = sourceConfig[itemKind] || sourceConfig.blog;
  const Icon = config.icon;
  const [upvoted, setUpvoted] = useState(initialVote === 'upvote');
  const [downvoted, setDownvoted] = useState(initialVote === 'downvote');
  const [bookmarked, setBookmarked] = useState(initialBookmarked || false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const relevance = item.metadata?.why_relevant;

  // Intersection Observer to track when item becomes visible
  useEffect(() => {
    if (!onVisible || hasBeenSeen.current || item._seen) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasBeenSeen.current) {
            hasBeenSeen.current = true;
            onVisible(item.id);
          }
        });
      },
      { threshold: 0.5 } // Item is 50% visible
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [item.id, item._seen, onVisible]);

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
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="group p-4 md:p-5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={(e) => {
        // Only navigate if not clicking on action buttons
        const target = e.target as HTMLElement;
        if (!target.closest('button')) {
          window.open(item.url, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      {/* Top row: icon + source + context */}
      <div className="flex items-start gap-3 md:gap-4">
        {/* Source icon - hidden on mobile, visible on desktop */}
        <div className={`hidden md:flex w-12 h-12 rounded-xl items-center justify-center shrink-0 ${config.bg}`}>
          <Icon size={20} className={config.color} strokeWidth={1.5} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Source label */}
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <span className={`text-[10px] font-medium uppercase tracking-wider ${config.color}`}>{config.label}</span>
            {item.metadata?.is_hot && itemKind !== 'news' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                <Flame size={10} strokeWidth={2} />
                <span className="text-[9px] font-medium uppercase tracking-wider">Hot</span>
              </span>
            )}
          </div>

          {/* Title - the main focus */}
          <div className="mb-2 md:mb-3">
            <h3 className="text-base md:text-lg font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {item.title}
              <ArrowUpRight
                size={14}
                className="inline ml-1 opacity-40 md:opacity-0 group-hover:opacity-60 transition-opacity"
              />
            </h3>
          </div>

          {/* Relevance below title (no clamp) */}
          {relevance && (
            <p className="text-xs text-secondary/70 mb-3 md:mb-4">
              {relevance}
            </p>
          )}

          {/* Actions row - rounded buttons */}
          <div className="flex items-center gap-1 md:gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUpvote();
              }}
              className={`flex items-center gap-1.5 p-2 rounded-lg transition-colors active:scale-95 ${disabled
                  ? 'text-secondary/20 cursor-not-allowed'
                  : upvoted
                    ? 'text-green-500 bg-green-50'
                    : 'text-secondary/40 hover:text-green-500 hover:bg-green-50'
                }`}
              title={disabled ? "Subscribe to interact" : "Upvote"}
            >
              <ThumbsUp size={18} className="md:hidden" fill={upvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
              <ThumbsUp size={16} className="hidden md:block" fill={upvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownvote();
              }}
              className={`flex items-center gap-1.5 p-2 rounded-lg transition-colors active:scale-95 ${disabled
                  ? 'text-secondary/20 cursor-not-allowed'
                  : downvoted
                    ? 'text-red-500 bg-red-50'
                    : 'text-secondary/40 hover:text-red-500 hover:bg-red-50'
                }`}
              title={disabled ? "Subscribe to interact" : "Downvote"}
            >
              <ThumbsDown size={18} className="md:hidden" fill={downvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
              <ThumbsDown size={16} className="hidden md:block" fill={downvoted ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) {
                  onDisabledClick?.();
                  return;
                }
                setShowFeedback(!showFeedback);
              }}
              className={`flex items-center gap-1.5 p-2 rounded-lg transition-colors active:scale-95 ${disabled
                  ? 'text-secondary/20 cursor-not-allowed'
                  : 'text-secondary/40 hover:text-blue-500 hover:bg-blue-50'
                }`}
              title={disabled ? "Subscribe to interact" : "Add feedback"}
            >
              <MessageSquare size={18} className="md:hidden" strokeWidth={1.5} />
              <MessageSquare size={16} className="hidden md:block" strokeWidth={1.5} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) {
                  onDisabledClick?.();
                  return;
                }
                if (isBookmarkLoading) return;
                setBookmarked(!bookmarked);
                onStar();
              }}
              className={`flex items-center gap-1.5 p-2 rounded-lg transition-colors ml-auto active:scale-95 ${disabled
                  ? 'text-secondary/20 cursor-not-allowed'
                  : isBookmarkLoading
                    ? 'text-secondary/40'
                    : bookmarked
                      ? 'text-primary bg-primary/10'
                      : 'text-secondary/40 hover:text-primary hover:bg-primary/10'
                }`}
              title={disabled ? "Subscribe to interact" : "Bookmark"}
              disabled={isBookmarkLoading}
            >
              {isBookmarkLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Bookmark size={18} className="md:hidden" fill={bookmarked ? 'currentColor' : 'none'} strokeWidth={1.5} />
                  <Bookmark size={16} className="hidden md:block" fill={bookmarked ? 'currentColor' : 'none'} strokeWidth={1.5} />
                </>
              )}
            </button>
          </div>

          {/* Feedback input - expandable */}
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 md:mt-4 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFeedbackSubmit()}
                    placeholder="Notes for Trace?"
                    className="flex-1 px-3 md:px-4 py-2.5 md:py-2 text-sm font-mono bg-transparent border border-border focus:border-primary focus:outline-none transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={!feedback.trim()}
                    className="px-6 py-2.5 md:py-2 text-[10px] font-mono uppercase tracking-widest bg-primary text-primary-foreground disabled:opacity-40 transition-opacity active:scale-98"
                  >
                    Send
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
}

type FilterType = 'all' | string;

export default function FeedPage() {
  const router = useRouter();
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

  // Pagination state
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [feedMetadata, setFeedMetadata] = useState<FeedMetadata | null>(null);
  const cursorRef = useRef(0);
  const isLoadingRef = useRef(false);
  const hasLoadedInitialFeed = useRef(false);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Seen items tracking - batch updates
  const seenItemsBuffer = useRef<Set<string>>(new Set());
  const seenFlushTimeout = useRef<NodeJS.Timeout | null>(null);

  // Check if user has seen the hint before
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

  // Use personalized feed for onboarded users (subscribed or not), otherwise general feed
  const isOnboarded = profile?.onboarded ?? false;
  const showPersonalizedFeed = isOnboarded; // Show feed for ALL onboarded users
  const currentFeed = !showPersonalizedFeed ? generalFeed : feed;
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
  // Use profile filters that match feed tags, fall back to all feed tags if no match
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

  const filteredFeed = activeFilter === 'all'
    ? currentFeed
    : currentFeed.filter((item) => {
      const tags = item.tags || [];
      return tags.includes(activeFilter);
    });

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

  // Check subscription access
  useEffect(() => {
    if (profile) {
      const subscriptionStatus = profile.subscriptionStatus || 'none';

      // Check if they have active/trial status
      let hasValidAccess = ['trial', 'active'].includes(subscriptionStatus);

      // If cancelled but still active, check if cancellation date has passed
      if (hasValidAccess && profile.cancelledAt) {
        const now = new Date();

        // Helper to convert Firestore Timestamp to Date
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

        // Use willCancelAt if available, otherwise nextBillingDate
        const cancelDate = willCancelAt || nextBilling;

        // If cancellation date has passed, revoke access
        if (cancelDate && now >= cancelDate) {
          hasValidAccess = false;
        }
      }

      setHasAccess(hasValidAccess);
    }
  }, [profile]);

  useEffect(() => {
    // Alpha mode check: if not in alpha mode, redirect to waitlist
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

      // Load interactions for this specific feed (by its generation date)
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

  // Flush seen items to server (batched)
  const flushSeenItems = useCallback(async () => {
    if (!user || !feedDate || seenItemsBuffer.current.size === 0) return;

    const itemIds = Array.from(seenItemsBuffer.current);
    seenItemsBuffer.current.clear();

    try {
      const token = await user.getIdToken();
      await fetch('/api/feed/seen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: feedDate,
          item_ids: itemIds,
        }),
      });

      // Update unseen count locally
      setUnseenCount(prev => Math.max(0, prev - itemIds.length));
    } catch (error) {
      console.error('Error marking items as seen:', error);
      // Re-add failed items back to buffer
      itemIds.forEach(id => seenItemsBuffer.current.add(id));
    }
  }, [user, feedDate]);

  // Handle item becoming visible
  const handleItemVisible = useCallback((itemId: string) => {
    seenItemsBuffer.current.add(itemId);

    // Update local feed state to mark as seen
    setFeed(prev => prev.map(item =>
      item.id === itemId ? { ...item, _seen: true } : item
    ));

    // Debounce flush - wait 2 seconds after last seen item
    if (seenFlushTimeout.current) {
      clearTimeout(seenFlushTimeout.current);
    }
    seenFlushTimeout.current = setTimeout(flushSeenItems, 2000);
  }, [flushSeenItems]);

  // Flush on unmount
  useEffect(() => {
    const timeoutRef = seenFlushTimeout.current;
    const bufferRef = seenItemsBuffer.current;

    return () => {
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
      // Sync flush on unmount - copy buffer size to avoid ref access in cleanup
      if (bufferRef.size > 0) {
        flushSeenItems();
      }
    };
  }, [flushSeenItems]);

  // Load paginated feed
  const loadFeed = useCallback(async (uid: string, dateOverride?: string, reset = true) => {
    // Prevent concurrent loads
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    if (reset) {
      setIsFeedLoading(true);
      setFeed([]);
      cursorRef.current = 0;
    } else {
      setIsLoadingMore(true);
    }

    try {
      const token = await user?.getIdToken();
      if (!token) {
        isLoadingRef.current = false;
        return;
      }

      const params = new URLSearchParams();
      if (dateOverride) params.set('date', dateOverride);
      params.set('cursor', reset ? '0' : String(cursorRef.current));
      params.set('limit', '10');

      const response = await fetch(`/api/feed/paginated?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (reset) {
          setFeed(data.items || []);
          setFeedMetadata(data.metadata || null);  // Store feed metadata
        } else {
          setFeed(prev => [...prev, ...(data.items || [])]);
        }

        cursorRef.current = data.cursor || 0;
        setHasMore(data.hasMore || false);
        setFeedDate(data.feedDate || '');
        setTotalItems(data.total || 0);
        setUnseenCount(data.unseenCount || 0);

        // Defer interactions loading - don't block feed render
        if (data.feedDate) {
          // Load interactions in background after feed is displayed
          setTimeout(() => loadInteractions(uid, data.feedDate), 100);
        }
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setIsFeedLoading(false);
      setIsLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [user, loadInteractions]);

  // Load more items
  const loadMore = useCallback(() => {
    if (!user || !hasMore || isLoadingMore) return;
    loadFeed(user.uid, feedDate, false);
  }, [user, hasMore, isLoadingMore, loadFeed, feedDate]);

  // Load general feed for non-onboarded users
  // Sample feed from topics (10 items)
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
        setGeneralFeed(Array.isArray(data.items) ? data.items : []);
      }
    } catch (error) {
      console.error('Error loading general feed:', error);
    }
    setIsLoadingGeneral(false);
  }, [user]);

  // Load bookmarks lazily (only when needed)
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
        const bookmarkIds = new Set<string>(data.bookmarks.map((b: { item_id: string }) => b.item_id));
        setBookmarkedItems(bookmarkIds);
        setBookmarksLoaded(true);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  }, [user, bookmarksLoaded]);

  // Bookmarks are now loaded lazily when user clicks bookmark icon

  useEffect(() => {
    // Load feed for ALL onboarded users (subscribed and unsubscribed)
    // Feed content differs based on subscription (handled by backend)
    if (user && profile?.onboarded && !hasLoadedInitialFeed.current) {
      hasLoadedInitialFeed.current = true;
      loadFeed(user.uid);
    }
  }, [user, profile?.onboarded, loadFeed]);

  // Fallback: Load sample topics feed for non-onboarded users only
  useEffect(() => {
    const isNotOnboarded = profile && !profile.onboarded;
    if (user && isNotOnboarded && generalFeed.length === 0 && feed.length === 0) {
      loadGeneralFeed();
    }
  }, [user, profile, generalFeed.length, feed.length, loadGeneralFeed]);

  // History sidebar removed - just showing today's feed

  const recordInteraction = async (itemId: string, action: 'upvote' | 'downvote' | 'remove', note?: string) => {
    if (!user || !feedDate) return;

    const item = feed.find(i => i.id === itemId);
    if (!item) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: itemId,
          action,
          item_metadata: {
            type: item.type || item.source,
            title: item.title,
            url: item.url,
            description: item.description,
            tags: Array.isArray(item.tags) && item.tags.length
              ? item.tags
              : (item.metadata?.why_relevant ? [item.metadata.why_relevant] : []),
          },
          feed_date: feedDate, // Use the feed's generation date, not today
          note,
        }),
      });

      if (!response.ok) {
        console.error('Failed to record interaction:', await response.text());
      }
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  };

  const handleUpvote = (itemId: string, note?: string) => {
    console.log('Upvoted:', itemId);
    recordInteraction(itemId, 'upvote', note);
    setInteractionCount((prev) => prev + 1);
  };

  const handleDownvote = (itemId: string, note?: string) => {
    console.log('Downvoted:', itemId, note ? `with note: ${note}` : '');
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

  // Submit feedback
  const handleSubmitFeedback = async () => {
    if (!user || !feedbackMessage.trim()) return;

    setIsSubmittingFeedback(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: feedbackMessage.trim(),
          type: 'general',
        }),
      });

      if (response.ok) {
        setFeedbackSubmitted(true);
        setFeedbackMessage('');
        setTimeout(() => {
          setShowFeedback(false);
          setFeedbackSubmitted(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleStar = async (itemId: string) => {
    if (!user) return;

    const item = feed.find(i => i.id === itemId) || generalFeed.find(i => i.id === itemId);
    if (!item) return;

    // Show loading state for this bookmark
    setLoadingBookmarks(prev => new Set(prev).add(itemId));

    try {
      const token = await user.getIdToken();

      // Lazy load bookmarks if not loaded yet
      if (!bookmarksLoaded) {
        await loadBookmarks();
      }

      const isCurrentlyBookmarked = bookmarkedItems.has(itemId);

      if (isCurrentlyBookmarked) {
        // Remove bookmark
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
        // Add bookmark
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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header backHref="/" backLabel="Back" />

      {/* Callout banner - show ONE based on state */}
      {profile && !profile.onboarded ? (
        // Non-onboarded users: Show onboarding callout
        <div className="sticky top-14 md:top-16 z-40 bg-violet-50 border-b border-violet-100">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <Brain size={18} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Complete your profile — tell us what you&apos;re into
                  </p>
                  <p className="text-xs text-secondary/70 mt-0.5">
                    Finish onboarding to get your personalized feed
                  </p>
                </div>
              </div>
              <Link
                href="/onboarding"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors shrink-0"
              >
                <Sparkles size={14} />
                Complete Setup
              </Link>
            </div>
          </div>
        </div>
      ) : !hasAccess && profile ? (
        // Onboarded but not subscribed: Show limited feed callout
        <div className="sticky top-14 md:top-16 z-40 bg-amber-100 border-b border-amber-100">
          <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Brain size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    You&apos;re viewing a limited feed
                  </p>
                  <p className="text-xs text-secondary/70 mt-0.5">
                    Unlock your full personalized feed free for 3 days — no credit card required
                  </p>
                </div>
              </div>
              <Link
                href="/profile?tab=subscription"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors shrink-0"
              >
                <Zap size={14} />
                Start Free Trial
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
                <h3 className="text-lg font-semibold">Subscribe to Unlock</h3>
              </div>
              <p className="text-sm text-secondary mb-6">
                Subscribe to interact with content and help Trace learn from your feedback. Your upvotes, downvotes, and comments help us personalize your daily feed better.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubscribePrompt(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-secondary hover:bg-gray-50 transition-colors"
                >
                  Maybe Later
                </button>
                <Link
                  href="/profile?tab=subscription"
                  className="flex-1 px-4 py-3 rounded-xl bg-foreground text-background text-sm font-medium text-center hover:bg-foreground/90 transition-colors"
                >
                  Subscribe
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full mt-6 md:mt-10">
        {/* Mobile: Feed date with dropdown for history (only for subscribed AND onboarded users) */}
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

        {/* Mobile Feedback Callout - Below date picker */}
        {isOnboarded && !showFeedback && (
          <div className="md:hidden px-4 mb-4">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground mb-0.5">
                    Got feedback?
                  </p>
                  <p className="text-[11px] text-secondary/80 leading-relaxed">
                    Help us improve Trace! Share bugs, feature requests, or feedback.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFeedback(true)}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
              >
                Send Feedback
              </button>
            </div>
          </div>
        )}

        {/* Mobile Feedback Form */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden px-4 mb-4 overflow-hidden"
            >
              <div className="p-4 bg-white rounded-xl border border-gray-200">
                {feedbackSubmitted ? (
                  <div className="flex items-center gap-3 text-green-600">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <Check size={16} />
                    </div>
                    <p className="text-sm font-medium">Thanks! Your feedback has been submitted.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-foreground">Send Feedback</h3>
                      <button
                        onClick={() => setShowFeedback(false)}
                        className="p-1.5 rounded-lg text-secondary/60 hover:text-foreground hover:bg-gray-100 transition-colors"
                        aria-label="Close feedback"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="mb-3">
                      <label className="block text-xs font-medium text-secondary/80 mb-2">Message</label>
                      <textarea
                        value={feedbackMessage}
                        onChange={(e) => setFeedbackMessage(e.target.value)}
                        placeholder="Tell us what's on your mind..."
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-foreground placeholder:text-secondary/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowFeedback(false)}
                        className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-secondary border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitFeedback}
                        disabled={!feedbackMessage.trim() || isSubmittingFeedback}
                        className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmittingFeedback ? 'Sending...' : 'Submit'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile filters - horizontal scroll */}
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

        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 md:flex md:gap-12">
          {/* Filters - left sidebar, sticky (desktop only) */}
          <aside className={`hidden md:block w-48 shrink-0 sticky h-fit ${
            // Add extra top margin when sticky banners are visible
            (profile && !profile.onboarded) || (!hasAccess && profile)
              ? 'top-40'
              : 'top-24'
            }`}>
            <nav className="space-y-1.5">
              <h2 className="text-xs font-medium uppercase tracking-wider text-secondary/60 mb-4 px-3">
                Filters
              </h2>
              {[
                { id: 'all', label: showPersonalizedFeed ? 'For you' : 'Discover' },
                ...topicFilters,
              ].map(filter => {
                const isActive = activeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id as FilterType)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
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
          <div className="flex-1 max-w-2xl mx-auto md:mx-0 w-full">
            {/* Desktop: Feed stats (only for subscribed users) */}
            {/* {hasAccess && feedDate && (
              <div className="hidden md:flex items-center gap-3 text-xs font-mono text-secondary/60 mb-6">
                <span>Feed from: {feedDate}</span>
                {unseenCount > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <Eye size={12} />
                    {unseenCount} new
                  </span>
                )}
                <span className="text-secondary/40">·</span>
                <span>{totalItems} items total</span>
              </div>
            )} */}

            {/* Hint about feedback (only for subscribed AND onboarded users) */}
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


            {((showPersonalizedFeed && isFeedLoading) || (!showPersonalizedFeed && isLoadingGeneral)) ? (
              <div className="space-y-3">
                {/* Skeleton loader - 5 placeholder cards */}
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 md:p-5 rounded-xl bg-gray-50 animate-pulse">
                    <div className="flex gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-200 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-3 bg-gray-200 rounded-full w-20" />
                        <div className="h-5 bg-gray-200 rounded-lg w-full" />
                        <div className="h-5 bg-gray-200 rounded-lg w-3/4" />
                        <div className="h-3 bg-gray-200 rounded-full w-1/2" />
                        <div className="flex gap-2 pt-2">
                          <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                          <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                          <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="divide-y divide-border/20">
                  <AnimatePresence>
                    {filteredFeed.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <FeedCard
                          item={item}
                          onUpvote={(note) => handleUpvote(item.id, note)}
                          onDownvote={(note) => handleDownvote(item.id, note)}
                          onStar={() => handleStar(item.id)}
                          initialVote={interactions[item.id]}
                          initialBookmarked={bookmarkedItems.has(item.id)}
                          isBookmarkLoading={loadingBookmarks.has(item.id)}
                          disabled={!hasAccess}
                          onDisabledClick={() => setShowSubscribePrompt(true)}
                          onVisible={showPersonalizedFeed ? handleItemVisible : undefined}
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
                  </AnimatePresence>
                </div>

                {/* Load More Button */}
                {showPersonalizedFeed && hasMore && filteredFeed.length > 0 && (
                  <div className="py-6 text-center">
                    <button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
                    >
                      {isLoadingMore ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Loading
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          Load More ({totalItems - feed.length} remaining)
                        </>
                      )}
                    </button>
                  </div>
                )}

                {filteredFeed.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 md:py-20 px-4"
                  >
                    {profile?.onboardedAt && activeFilter === 'all' && (() => {
                      const onboardedTimestamp = profile.onboardedAt as { seconds: number } | Date;
                      const onboardedTime = typeof onboardedTimestamp === 'object' && 'seconds' in onboardedTimestamp
                        ? new Date(onboardedTimestamp.seconds * 1000)
                        : new Date(onboardedTimestamp);
                      const now = new Date();
                      const timeSinceOnboarding = now.getTime() - onboardedTime.getTime();
                      const isNewUser = timeSinceOnboarding < 30 * 60 * 1000; // Within 30 minutes

                      if (isNewUser) {
                        return (
                          <>
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-6 relative">
                              <Brain size={32} className="md:hidden" />
                              <Brain size={40} className="hidden md:block" />
                              <motion.div
                                className="absolute inset-0 border-2 border-primary"
                                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                            </div>
                            <p className="text-xl md:text-2xl font-serif mb-3">
                              AI is curating your feed
                            </p>
                            <p className="text-sm font-mono text-secondary mb-6 max-w-md mx-auto leading-relaxed">
                              Our AI agents are analyzing your profile and gathering personalized content from across the web. This usually takes 5-10 minutes.
                            </p>
                            <div className="space-y-3 max-w-sm mx-auto mb-6">
                              {['Analyzing your interests', 'Searching content sources', 'Ranking & filtering'].map((step, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.2 }}
                                  className="flex items-center gap-3 text-sm font-mono text-secondary"
                                >
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                  >
                                    <RefreshCw size={14} className="text-primary" />
                                  </motion.div>
                                  {step}
                                </motion.div>
                              ))}
                            </div>
                            <div className="p-4 bg-blue-500/5 border border-blue-500/20 max-w-md mx-auto">
                              <p className="text-xs font-mono text-secondary leading-relaxed">
                                💡 <span className="text-foreground font-bold">Pro tip:</span> While you wait, you can update your profile or explore your interests to help us curate even better content for you.
                              </p>
                            </div>
                          </>
                        );
                      }
                    })()}

                    {(!profile?.onboardedAt ||
                      (profile?.onboardedAt && (() => {
                        const ts = profile.onboardedAt as { seconds: number } | Date;
                        const time = typeof ts === 'object' && 'seconds' in ts ? new Date(ts.seconds * 1000) : new Date(ts);
                        return new Date().getTime() - time.getTime() >= 30 * 60 * 1000;
                      })()) ||
                      activeFilter !== 'all') && (
                        <>
                          <div className="w-12 h-12 bg-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                            <Sparkles size={24} className="text-primary" />
                          </div>
                          <p className="text-lg font-serif mb-2">
                            {activeFilter === 'all' ? 'Your Feed is Being Generated!!! Check back soon!' : `No ${activeFilter}s yet`}
                          </p>
                          <p className="text-sm font-mono text-secondary mb-4">
                            {activeFilter === 'all'
                              ? "We're curating content for you. Check back soon!"
                              : 'Try a different filter'}
                          </p>
                          {activeFilter !== 'all' && (
                            <button
                              onClick={() => setActiveFilter('all')}
                              className="text-sm font-mono text-primary hover:underline uppercase tracking-wider"
                            >
                              View all content
                            </button>
                          )}
                        </>
                      )}
                  </motion.div>
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
                            This is just a taste. Unlock your full personalized feed with AI-powered recommendations, free for 3 days.
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/profile?tab=subscription"
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shrink-0"
                      >
                        <Zap size={16} />
                        Start Free Trial
                      </Link>
                    </div>
                  </div>
                )}

                {/* End of feed indicator */}
                {filteredFeed.length > 0 && (
                  <div className="py-8 md:py-12 text-center border-t border-border/20">
                    <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary/50">Youre all caught up</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right sidebar (desktop only) - Feedback */}
          <aside className={`hidden md:block w-48 shrink-0 sticky h-fit ${
            (profile && !profile.onboarded) || (!hasAccess && profile) 
              ? 'top-40' 
              : 'top-24'
          }`}>
            {/* Feedback Callout */}
            {isOnboarded && !showFeedback && (
              <div className="mt-6">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground mb-0.5">Feedback/Complaint?</p>
                      <p className="text-[11px] text-secondary/80 leading-relaxed">
                        Help us improve Trace! Share bugs, feature requests, or general feedback.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowFeedback(true)}
                    className="w-full px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
                  >
                    Send Feedback
                  </button>
                </div>
              </div>
            )}

            {/* Feedback Form */}
            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="p-4 bg-white rounded-xl border border-gray-200">
                    {feedbackSubmitted ? (
                      <div className="flex items-center gap-3 text-green-600">
                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                          <Check size={16} />
                        </div>
                        <p className="text-sm font-medium">Thanks! Your feedback has been submitted.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium text-foreground">Send Feedback</h3>
                          <button
                            onClick={() => setShowFeedback(false)}
                            className="p-1.5 rounded-lg text-secondary/60 hover:text-foreground hover:bg-gray-100 transition-colors"
                            aria-label="Close feedback"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="mb-3">
                          <label className="block text-xs font-medium text-secondary/80 mb-2">Message</label>
                          <textarea
                            value={feedbackMessage}
                            onChange={(e) => setFeedbackMessage(e.target.value)}
                            placeholder="Tell us what's on your mind..."
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-foreground placeholder:text-secondary/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                            rows={4}
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowFeedback(false)}
                            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-secondary border border-gray-200 hover:border-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSubmitFeedback}
                            disabled={!feedbackMessage.trim() || isSubmittingFeedback}
                            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmittingFeedback ? 'Sending...' : 'Submit'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showPersonalizedFeed && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Sparkles size={18} className="text-primary" />
                </div>
                <h3 className="text-sm font-medium mb-2">Unlock Your Feed</h3>
                <p className="text-xs text-secondary/70 mb-4">
                  Get personalized content curated daily for your interests.
                </p>
                <Link
                  href="/profile?tab=subscription"
                  className="block w-full px-3 py-2 bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-widest text-center hover:bg-primary/90 transition-colors"
                >
                  Subscribe
                </Link>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
